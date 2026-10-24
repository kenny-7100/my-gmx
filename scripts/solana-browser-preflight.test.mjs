import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { packEvidence, verifyEvidence } from "./agent-evidence.mjs";
import { checkDiscovery, preflight, runCli } from "./solana-browser-preflight.mjs";

const discovery = () => ({
  config: { metadata: { scope: "solana-local-read-only-network-smoke", target: "http://127.0.0.1:3010" } },
  suites: [{ suites: [{ specs: [{ tests: [{ results: [] }, { results: [] }] }] }] }],
  errors: [],
});
const ready = () => ({
  resolveDependency: async () => ({ version: "1.58.2", cli: "unused" }),
  platform: "darwin",
  checkExecutable: async () => undefined,
  readRuntime: async () => ({ status: "passed", scope: "local-artifacts", chain: { code: "local-only" } }),
  discover: async () => discovery(),
});
const unavailable = async () => {
  throw new Error("private-input-must-not-be-logged");
};

test("preserves prerequisite failures and exit codes without inferring browser or requirement success", async () => {
  for (const [changes, status, code] of [
    [{}, "passed", 0],
    [{ resolveDependency: unavailable }, "blocked", 2],
    [{ checkExecutable: unavailable }, "blocked", 2],
    [{ platform: "unsupported" }, "blocked", 2],
    [{ readRuntime: unavailable }, "blocked", 2],
    [{ readRuntime: async () => ({ status: "passed", scope: "local-artifacts-and-mainnet-program" }) }, "blocked", 2],
    [{ discover: unavailable }, "failed", 1],
    [{ checkExecutable: unavailable, discover: unavailable }, "failed", 1],
  ]) {
    const report = await preflight({ ...ready(), ...changes });
    assert.equal(report.status, status);
    assert.equal(report.browserExecution, "not-run");
    assert.equal(report.serverReadiness, "not-evaluated");
    assert.equal(report.requirementAcceptance, "not-evaluated");
    if (changes.resolveDependency)
      assert.deepEqual(report.checks.at(-1), { name: "discovery", status: "not-run", code: "playwright-required" });
    let output = "";
    assert.equal(
      await runCli({
        args: [],
        runner: async () => report,
        stdout: {
          write: (value) => {
            output += value;
          },
        },
      }),
      code
    );
    assert.equal(JSON.parse(output).status, status);
    assert.ok(!output.includes("private-input"));
  }
});

test("rejects discovery errors, wrong test counts and reports containing executed tests", () => {
  assert.equal(checkDiscovery(discovery()).count, 2);
  for (const mutate of [
    (report) => {
      report.errors.push({ message: "load failed" });
    },
    (report) => {
      report.config.metadata.scope = "other";
    },
    (report) => {
      report.suites = [];
    },
    (report) => {
      report.suites[0].suites[0].specs[0].tests.pop();
    },
    (report) => {
      report.suites[0].suites[0].specs[0].tests[0].results.push({ status: "passed" });
    },
  ]) {
    const report = discovery();
    mutate(report);
    assert.throws(() => checkDiscovery(report));
  }
});

test("archives preparation reports unchanged and sanitizes fatal CLI errors", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-browser-preflight-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const changes of [{}, { checkExecutable: unavailable }, { discover: unavailable }]) {
    const report = await preflight({ ...ready(), ...changes });
    const file = path.join(dir, `${report.status}.json`);
    await writeFile(file, JSON.stringify(report));
    const outDir = path.join(dir, report.status);
    const packed = await packEvidence({ issue: "FESOL-55", reports: [{ name: "browser", file }], outDir });
    const verified = await verifyEvidence({ dir: outDir, expectedManifestSha256: packed.manifestSha256 });
    assert.equal(verified.manifestIdentity, "matched");
    assert.equal(verified.requirementAcceptance, "not-evaluated");
    assert.deepEqual(await readFile(path.join(outDir, "browser.json")), await readFile(file));
  }
  for (const args of [[], ["--unknown"]]) {
    let output = "";
    assert.equal(
      await runCli({
        args,
        runner: unavailable,
        stdout: {
          write: (value) => {
            output += value;
          },
        },
      }),
      1
    );
    assert.equal(JSON.parse(output).code, "browser-preflight-failed");
    assert.ok(!output.includes("private-input"));
  }
});
