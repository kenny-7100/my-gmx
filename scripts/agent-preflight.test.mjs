import assert from "node:assert/strict";
import { test } from "node:test";

import { interpretResult, runCommand, runPreflight, summarize } from "./agent-preflight.mjs";

const source = { commit: "a".repeat(40), dirty: true, sha256: {} };
const jsonResult = (data, exitCode = 0) => ({
  exitCode,
  stdout: JSON.stringify(data),
  stderr: "private-upstream-detail",
});

test("aggregate status preserves failed, blocked and required not-run across result combinations", () => {
  for (const first of ["passed", "failed", "blocked", "not-run"]) {
    for (const second of ["passed", "failed", "blocked", "not-run"]) {
      const expected = [first, second].includes("failed") ? 1 : [first, second].every((s) => s === "passed") ? 0 : 2;
      assert.equal(summarize([{ status: first }, { status: second }]).exitCode, expected);
    }
  }
  assert.equal(summarize([{ status: "passed" }, { status: "not-run", code: "not-selected" }]).exitCode, 0);
  assert.equal(summarize([{ status: "not-run", code: "not-selected" }]).exitCode, 2);
});

test("checker reports preserve business blockers and reject invalid or contradictory success without raw output", () => {
  const blocked = {
    status: "blocked",
    exitCode: 2,
    checks: [{ name: "solanaTrading", status: "blocked", code: "flag-missing" }],
  };
  const api = {
    status: "passed",
    mode: "sample",
    checks: ["ping"],
    expectedSource: { commit: source.commit, dirty: false, sha256: { "src/solanaApp.ts": "b".repeat(64) } },
  };
  for (const [name, input, expected] of [
    ["rpc", { exitCode: 0, stdout: "PASS: checks" }, "passed"],
    ["rpc", { exitCode: 0, stdout: "private-upstream-detail" }, "failed"],
    ["keeper", jsonResult(blocked, 2), "blocked"],
    ["keeper", jsonResult({ ...blocked, status: "passed", exitCode: 0 }), "failed"],
    ["keeper", jsonResult({ ...blocked, checks: [] }, 2), "failed"],
    [
      "keeper",
      jsonResult({
        status: "passed",
        exitCode: 0,
        checks: [
          { name: "ui-flags", status: "passed", code: "flags-readable" },
          { name: "solanaTrading", status: "failed", code: "not-selected" },
        ],
      }),
      "failed",
    ],
    ["api", jsonResult(api), "passed"],
    ["api", jsonResult({ ...api, mode: "real" }), "failed"],
    ["api", jsonResult({ ...api, expectedSource: {} }), "failed"],
    ["wallet", jsonResult({ status: "passed", network: "solana-devnet" }), "failed"],
    ["api", { exitCode: 0, stdout: "private-upstream-detail" }, "failed"],
    [
      "wallet",
      {
        exitCode: 1,
        stderr: JSON.stringify({ status: "failed", code: "network-error", message: "private-upstream-detail" }),
      },
      "failed",
    ],
    ["keeper", { errorCode: "timeout" }, "failed"],
  ]) {
    const report = interpretResult(name, input);
    assert.equal(report.status, expected);
    assert.equal(JSON.stringify(report).includes("private-upstream-detail"), false);
  }
});

test("selected checks continue after failures and exceptions while unselected wallet stays not-run", async () => {
  for (const failure of ["throw", "invalid-json", "timeout"]) {
    const queue = [
      { exitCode: 1, stdout: "", stderr: "private-upstream-detail" },
      jsonResult(
        {
          status: "blocked",
          exitCode: 2,
          checks: [{ name: "solanaTrading", status: "blocked", code: "flag-missing" }],
        },
        2
      ),
      failure === "timeout" ? { errorCode: "timeout" } : { exitCode: 0, stdout: "private-upstream-detail" },
    ];
    const report = await runPreflight({
      evidenceReader: async () => source,
      runner: async () => {
        const result = queue.shift();
        if (failure === "throw" && queue.length === 0) throw new Error("private-upstream-detail");
        return result;
      },
    });
    assert.equal(report.exitCode, 1);
    assert.deepEqual(
      report.results.map(({ status }) => status),
      ["failed", "blocked", "failed", "not-run"]
    );
    assert.equal(JSON.stringify(report).includes("private-upstream-detail"), false);
  }
  for (const selected of [[], ["wallet", "wallet"], ["unknown"]]) {
    await assert.rejects(runPreflight({ selected, evidenceReader: async () => source }));
  }
});

test("subprocess timeout and nonzero exits cannot become passing checker results", async () => {
  const timeout = await runCommand({ args: ["-e", "setTimeout(() => {}, 10000)"], timeout: 100 });
  assert.equal(timeout.errorCode, "timeout");
  assert.equal(interpretResult("rpc", timeout).status, "failed");
  const failure = await runCommand({
    args: ["-e", "process.stderr.write('private-upstream-detail');process.exitCode=1"],
    timeout: 5000,
  });
  assert.equal(failure.exitCode, 1);
  assert.equal(interpretResult("api", failure).code, "invalid-checker-report");
});
