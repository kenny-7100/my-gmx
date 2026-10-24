import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateVectors, runCli, runVectors } from "./solana-sdk-vectors.mjs";

const fixture = JSON.parse(readFileSync(new URL("../tools/solana-sdk-vectors/apply-factor.json", import.meta.url)));

test("runs the actual pinned WASM against independently generated exact boundary vectors", async () => {
  const generated = JSON.parse(
    execFileSync("python3", [fileURLToPath(new URL("../tools/solana-sdk-vectors/generate.py", import.meta.url))], {
      encoding: "utf8",
    })
  );
  assert.deepEqual(generated, fixture);
  const report = await runVectors();
  assert.equal(report.status, "passed");
  assert.equal(report.vectors.length, 12);
  assert.ok(report.vectors.every((row) => row.status === "passed"));
  assert.equal(report.vectors.find((row) => row.name === "max-identity").actual, ((1n << 128n) - 1n).toString());
  assert.equal(report.vectors.find((row) => row.name === "max-product").actual, null);
  assert.equal(report.businessMath, "not-evaluated");
  assert.equal(report.browserLoading, "not-run");
});

test("rejects invalid vector inputs before invoking SDK and reports mismatches explicitly", () => {
  const vector = fixture.vectors[0];
  for (const change of [
    { value: "-1" },
    { value: (1n << 128n).toString() },
    { factor: "1.5" },
    { expected: 0 },
    { value: "01" },
    { name: "invalid name" },
  ]) {
    let invoked = false;
    assert.throws(() =>
      evaluateVectors({ ...fixture, vectors: [{ ...vector, ...change }] }, () => {
        invoked = true;
      })
    );
    assert.equal(invoked, false);
  }
  for (const changes of [
    { factorDecimals: 30 },
    { rounding: "ceil" },
    { vectors: [] },
    { vectors: [vector, vector] },
  ]) {
    assert.throws(() => evaluateVectors({ ...fixture, ...changes }, () => 0n));
  }
  const mismatch = evaluateVectors({ ...fixture, vectors: [{ ...vector, expected: "1" }] }, () => 0n);
  assert.equal(mismatch[0].status, "failed");
  for (const invalid of [0, -1n, 1n << 128n, null]) {
    assert.throws(() => evaluateVectors({ ...fixture, vectors: [vector] }, () => invalid));
  }
});

test("CLI preserves failed reports and never reports an initialization error as success", async () => {
  let output = "";
  assert.equal(
    await runCli({
      args: [],
      runner: async () => ({ status: "failed", scope: "real-wasm-reference-vectors", vectors: [] }),
      stdout: {
        write: (s) => {
          output += s;
        },
      },
    }),
    1
  );
  assert.equal(JSON.parse(output).status, "failed");
  for (const args of [[], ["--unknown", "secret-value"]]) {
    let out = "";
    let error = "";
    const code = await runCli({
      args,
      runner: async () => {
        throw new Error("secret-initialization-error");
      },
      stdout: {
        write: (s) => {
          out += s;
        },
      },
      stderr: {
        write: (s) => {
          error += s;
        },
      },
    });
    assert.equal(code, 1);
    assert.equal(out, "");
    assert.equal(JSON.parse(error).code, "sdk-vectors-failed");
    assert.ok(!error.includes("secret-"));
  }
});
