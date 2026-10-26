import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { safeApiPath } from "./lib/agent-request-path.mjs";
import { checkContracts, differences, shape } from "./lib/solana-dev-contracts.mjs";

test("request records omit query values and unknown path segments", () => {
  for (const [input, prefix, expected] of [
    ["/v1/positions?address=private&key=private", "", "/v1/positions"],
    ["/private-wallet/orders?token=private", "", "/<unmatched>"],
    ["/__agent/solana-api/v1/orders?address=private", "/__agent/solana-api", "/__agent/solana-api/v1/orders"],
    ["/__agent/solana-api/private-secret", "/__agent/solana-api", "/__agent/solana-api/<unmatched>"],
  ])
    assert.equal(safeApiPath(input, prefix), expected);
});

test("sample shape drift reports field and lexical changes without exposing values", () => {
  const expected = shape([{ size: "123456789012345678901234567890", enabled: true, nested: { key: "placeholder" } }]);
  for (const [value, code] of [
    [[{ size: 123, enabled: true, nested: { key: "placeholder" } }], "type-changed"],
    [[{ enabled: true, nested: { key: "placeholder" } }], "field-missing"],
    [[{ size: "123", enabled: true, nested: { key: "placeholder" }, secret: "do-not-report" }], "field-added"],
    [[{ size: "invalid-secret", enabled: true, nested: { key: "placeholder" } }], "type-changed"],
  ]) {
    const errors = differences(expected, value);
    assert.ok(errors.some((error) => error.code === code));
    assert.ok(!JSON.stringify(errors).includes("do-not-report"));
    assert.ok(!JSON.stringify(errors).includes("invalid-secret"));
  }
  assert.deepEqual(differences(expected, [{ size: "-999", enabled: false, nested: { key: "other" } }]), []);
  // A shape baseline intentionally establishes no business rule for empty states.
  assert.deepEqual(differences(expected, []), []);
});

test("unchanged sample baselines remain partial and source drift cannot pass", async () => {
  const report = await checkContracts();
  assert.equal(report.structuralCheck, "passed");
  assert.equal(report.status, "partial");
  assert.equal(report.baselineReview, "unreviewed-source-samples");
  assert.ok(report.gaps.length > 0);
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-contract-baseline-"));
  try {
    await mkdir(path.join(dir, "src/domain/solana"), { recursive: true });
    await cp(
      new URL("../gmx-api/src/domain/solana/samples", import.meta.url),
      path.join(dir, "src/domain/solana/samples"),
      { recursive: true }
    );
    const file = path.join(dir, "src/domain/solana/samples/markets-config.json");
    const value = JSON.parse(await readFile(file, "utf8"));
    value[0].isDisabled = !value[0].isDisabled;
    await writeFile(file, JSON.stringify(value));
    const changed = await checkContracts({ apiDir: dir });
    assert.equal(changed.status, "failed");
    assert.equal(changed.checks[0].sourceMatches, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("browser capture selects local API requests, awaits metadata and preserves capture failures", async () => {
  const { EventEmitter } = await import("node:events");
  const { attachApiDiagnostics } = await import("./lib/agent-browser-diagnostics.mjs");
  const page = new EventEmitter();
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-request-capture-"));
  const capture = attachApiDiagnostics(page, "http://127.0.0.1:3010/__agent/solana-api");
  const req = (url) => ({ url: () => url, method: () => "GET" });
  try {
    const local = req("http://127.0.0.1:3010/__agent/solana-api/v1/positions?key=secret-value");
    page.emit("request", local);
    page.emit("response", {
      request: () => local,
      status: () => 400,
      allHeaders: async () => ({ "x-trace-id": "capture-trace", authorization: "secret-value" }),
    });
    page.emit("requestfailed", req("https://example.com/private-secret"));
    page.emit("requestfailed", req("http://127.0.0.1:3010/__agent/solana-api/private-secret"));
    const first = await capture.save(path.join(dir, "requests.json"));
    assert.equal(first.records.length, 2);
    assert.ok(!JSON.stringify(first).includes("secret-value"));
    assert.ok(!JSON.stringify(first).includes("private-secret"));
    assert.equal(first.records.find((record) => record.status === 400).traceId, "capture-trace");
    page.emit("response", {
      request: () => local,
      allHeaders: async () => {
        throw Error("Closed response");
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    const failed = await capture.save(path.join(dir, "failed.json"));
    assert.equal(failed.status, "failed");
    assert.deepEqual(failed.captureErrors, ["response-capture-failed"]);
  } finally {
    capture.detach();
    await rm(dir, { recursive: true, force: true });
  }
});
