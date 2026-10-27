import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { collectEnvironment, packageState, runCli } from "./agent-environment.mjs";

test("package inventory distinguishes matched versions, drift and missing or malformed prerequisites", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gmx-environment-"));
  try {
    await mkdir(path.join(directory, "node_modules/vitest"), { recursive: true });
    for (const [declared, installed, lock, expected] of [
      ["4.1.11", "4.1.11", true, "ready"],
      ["4.1.11", "4.1.10", true, "stale"],
      ["^4.1.11", "4.1.11", true, undefined],
      ["4.1.11", "private-invalid-version", true, undefined],
      ["4.1.11", "4.1.11", false, undefined],
    ]) {
      await writeFile(path.join(directory, "package.json"), JSON.stringify({ devDependencies: { vitest: declared } }));
      await writeFile(path.join(directory, "node_modules/vitest/package.json"), JSON.stringify({ version: installed }));
      if (lock) await writeFile(path.join(directory, "yarn.lock"), "fixture lock");
      else await rm(path.join(directory, "yarn.lock"));
      const run = () => packageState({ directory, names: ["vitest"] });
      if (expected) {
        const result = await run();
        assert.equal(result.status, expected);
        assert.deepEqual(result.packages, [{ name: "vitest", declared, installed }]);
      } else await assert.rejects(run);
    }
    await writeFile(path.join(directory, "yarn.lock"), "fixture lock");
    await rm(path.join(directory, "node_modules/vitest/package.json"));
    await assert.rejects(packageState({ directory, names: ["vitest"] }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("local inventory preserves blockers and unknown resources without leaking probe errors", async () => {
  const identity = { projectDir: "/fixture", commit: "a".repeat(40), dirty: false, sha256: {} };
  for (const state of ["ready", "blocked", "stale", "invalid", "throw"]) {
    const report = await collectEnvironment({
      selected: ["node", "api"],
      source: async () => identity,
      check: async (name) => {
        if (name === "api" && state === "throw") throw new Error("private-probe-error");
        return { status: name === "node" ? "ready" : state, code: "fixture-result" };
      },
    });
    assert.equal(report.status, state === "ready" ? "ready" : "blocked");
    assert.equal(
      report.resources.find((item) => item.name === "api").status,
      ["invalid", "throw"].includes(state) ? "blocked" : state
    );
    for (const name of [
      "wallet",
      "remote-api",
      "program-version",
      "rpc",
      "keeper",
      "docker-daemon-and-image",
      "chrome",
    ])
      assert.equal(report.resources.find((item) => item.name === name).status, "not-checked");
    assert.ok(
      report.resources.filter((item) => item.status === "not-checked").every((item) => item.checkedAt === null)
    );
    assert.ok(
      report.resources
        .filter((item) => item.status !== "not-checked")
        .every((item) => !Number.isNaN(Date.parse(item.checkedAt)))
    );
    assert.equal(report.requirementAcceptance, "not-evaluated");
    assert.equal(report.environmentReadiness, "not-evaluated");
    assert.equal(JSON.stringify(report).includes("private-probe-error"), false);
  }
  let reads = 0;
  const changed = await collectEnvironment({
    selected: ["node"],
    check: async () => ({ status: "ready" }),
    source: async () => ({ ...identity, dirty: reads++ > 0 }),
  });
  assert.equal(changed.status, "blocked");
  assert.equal(changed.sourceUnchanged, false);
  for (const selected of [[], ["node", "node"], ["__proto__"], ["wallet"]])
    await assert.rejects(collectEnvironment({ selected, source: async () => identity }));
});

test("CLI rejects unknown selection and evidence failures while preserving exit codes", async () => {
  for (const [args, collect, expected] of [
    [["--checks", "node"], async () => ({ status: "ready" }), 0],
    [["--checks", "node"], async () => ({ status: "blocked" }), 2],
    [["--checks", "unknown"], undefined, 1],
    [["--checks", ""], undefined, 1],
    [["--unknown", "private-input"], undefined, 1],
    [
      [],
      async () => {
        throw new Error("private-evidence-error");
      },
      1,
    ],
  ]) {
    let output = "";
    assert.equal(
      await runCli({
        args,
        collect,
        stdout: {
          write: (bytes) => {
            output += bytes;
          },
        },
      }),
      expected
    );
    assert.equal(output.includes("private-"), false);
    assert.ok(JSON.parse(output).status);
  }
  let invoked = false;
  assert.equal(
    await runCli({
      args: ["--help"],
      stdout: { write: (bytes) => bytes.length },
      collect: () => {
        invoked = true;
      },
    }),
    0
  );
  assert.equal(invoked, false);
});
