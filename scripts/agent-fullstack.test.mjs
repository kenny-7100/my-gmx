import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runPlan } from "./agent-test-run.mjs";
import { changeSelection, failureDetails, loadTargets } from "./lib/agent-fullstack-tests.mjs";
import { collectTargetEnvironment } from "./lib/agent-target-environment.mjs";

async function checkout(t) {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), "gmx-fullstack-")));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" })
      .toString()
      .trim();
  git("init", "-q");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "Infrastructure fixture");
  git("config", "commit.gpgsign", "false");
  await mkdir(path.join(dir, "src"));
  await writeFile(path.join(dir, "src/source.ts"), "export const value = 1;\n");
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ packageManager: "yarn@4.12.0" }));
  await writeFile(path.join(dir, "yarn.lock"), "fixture\n");
  await writeFile(path.join(dir, ".yarnrc.yml"), "nodeLinker: node-modules\n");
  git("add", ".");
  git("commit", "-qm", "Initialize fixture");
  return { dir, git };
}

test("Git selection retains mixed, staged, deleted and unusual paths and detects content drift", async (t) => {
  const { dir, git } = await checkout(t);
  await rm(path.join(dir, "src/source.ts"));
  await writeFile(path.join(dir, "config with\ttab.json"), "{}\n");
  git("add", "config with\ttab.json");
  await writeFile(path.join(dir, "untracked.json"), "1\n");
  const selection = await changeSelection(dir, "HEAD");
  assert.deepEqual(selection.paths, ["config with\ttab.json", "src/source.ts", "untracked.json"]);
  assert.equal(selection.contents["src/source.ts"], "missing");
  assert.ok(selection.indexPaths.includes("config with\ttab.json"));
  await writeFile(path.join(dir, "untracked.json"), "2\n");
  const next = await changeSelection(dir, "HEAD");
  assert.deepEqual(next.paths, selection.paths);
  assert.notEqual(next.contents["untracked.json"], selection.contents["untracked.json"]);
  assert.equal((await changeSelection(dir, selection.baseSha)).head, selection.head);
});

test("target configuration rejects ambiguous or unknown selection without modifying the checkout", async (t) => {
  const { dir, git } = await checkout(t);
  const file = path.join(dir, "targets.json");
  for (const config of [
    { frontend: { directory: dir, base: "HEAD", related: ["src/source.ts"] } },
    { frontend: { directory: dir } },
    { frontend: { directory: dir, related: ["src/source.ts", "src/source.ts"] } },
    { api: { directory: dir, base: "HEAD", profiles: { guessed: [] } } },
    { frontend: { directory: dir, base: "HEAD", command: "ignored" } },
    { unknown: {} },
    { frontend: null, api: { directory: dir, base: "HEAD" } },
  ]) {
    await writeFile(file, JSON.stringify(config));
    const before = git("status", "--porcelain");
    await assert.rejects(loadTargets(file));
    assert.equal(git("status", "--porcelain"), before);
  }
  await writeFile(file, JSON.stringify({ api: { directory: ".", base: "HEAD" } }));
  assert.equal((await loadTargets(file)).config.api.directory, dir);
});

test("target inventory distinguishes actual missing dependencies from unselected prerequisites", async (t) => {
  const { dir, git } = await checkout(t);
  const before = git("status", "--porcelain");
  const report = await collectTargetEnvironment({ apiDir: dir, selected: ["node", "yarn", "api"] });
  assert.equal(report.status, "blocked");
  assert.equal(report.resources.find((entry) => entry.name === "api").status, "blocked");
  assert.equal(report.resources.find((entry) => entry.name === "database").status, "not-checked");
  assert.equal(report.resources.find((entry) => entry.name === "yarn").status, "ready");
  assert.equal(report.sourceBefore.api.directory, dir);
  assert.equal(report.sdkConsumption.api.installed, null);
  assert.equal(report.sourceUnchanged, true);
  assert.deepEqual(
    report.resources.find((entry) => entry.name === "api").problems.map((entry) => entry.package),
    ["jest", "ts-jest", "tsx", "typescript"]
  );
  assert.equal(git("status", "--porcelain"), before);
  for (const selected of [[], ["api", "api"], ["wallet"]])
    await assert.rejects(collectTargetEnvironment({ apiDir: dir, selected }));
});

test("failure summaries retain native assertion failures and distinguish missing result artifacts", async (t) => {
  const { dir } = await checkout(t);
  const file = path.join(dir, "native.json");
  await writeFile(
    file,
    JSON.stringify({
      testResults: [
        {
          name: "src/math.test.ts",
          status: "failed",
          assertionResults: [
            { status: "failed", fullName: "rejects invalid input", failureMessages: ["Expected error"] },
          ],
        },
      ],
    })
  );
  const report = await failureDetails({ resultsFile: file, errorCode: "network-access-forbidden" });
  assert.equal(report.stage, "network-access-forbidden");
  for (const [input, stage] of [
    [{ sourceUnchanged: false }, "source-identity"],
    [{ toolingUnchanged: false }, "tooling-identity"],
    [{ network: { status: "failed" } }, "network-audit"],
    [{ exit: { timedOut: true } }, "timeout"],
    [{ exit: { cleanup: "failed" } }, "cleanup"],
  ])
    assert.equal((await failureDetails(input)).stage, stage);
  assert.equal(report.failures[0].test, "rejects invalid input");
  assert.deepEqual(report.failures[0].messages, ["Expected error"]);
  await rm(file);
  assert.equal((await failureDetails({ resultsFile: file })).failures[0].code, "missing");
  assert.equal((await readFile(path.join(dir, "src/source.ts"), "utf8")).includes("value = 1"), true);
});

test("the public executor routes schema 2 scopes and rejects invalid plans before execution", async (t) => {
  const { dir } = await checkout(t);
  const file = path.join(dir, "plan.json");
  await writeFile(
    file,
    JSON.stringify({
      schemaVersion: 2,
      mode: "agent-test-plan",
      status: "failed",
      scopes: { "api-offline": { suites: ["src/value.test.ts"] } },
    })
  );
  await assert.rejects(runPlan({ planFile: file, scope: "all" }), /valid discovery-only plan/);
  await assert.rejects(runPlan({ planFile: file, scope: "api-offline" }), /valid discovery-only plan/);
  await assert.rejects(runPlan({ planFile: file, scope: "api-offline,api-offline" }), /explicit existing scopes/);
  await writeFile(file, JSON.stringify({ schemaVersion: 1 }));
  await assert.rejects(runPlan({ planFile: file, scope: "all" }), /sdk, frontend or both/);
});
