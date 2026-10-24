import assert from "node:assert/strict";
import test from "node:test";

import { interpretIndex, queryIndex, readIndexConfig, runCli } from "./solana-index-preflight.mjs";

const now = Date.parse("2026-10-25T00:00:00.000Z");
const options = { maxAgeSeconds: 900, now };
const record = {
  id: "event-1",
  marketToken: "11111111111111111111111111111111",
  timestamp: "2026-10-24T23:59:59.000000Z",
  volume: "184467440737095516151234567890",
};
const body = (row = record) => ({ data: { squidStatus: { height: 461000000 }, volumeRecords: row ? [row] : [] } });

test("preserves precise index records and distinguishes event age from index readiness", () => {
  const result = interpretIndex(body(), options);
  assert.equal(result.status, "passed");
  assert.equal(result.latestRecord.volume, record.volume);
  assert.equal(result.latestEventAgeSeconds, 1);
  assert.equal(result.indexHeight, "461000000");
  assert.equal(result.processingLag, "not-evaluated");
  for (const [age, status, code] of [
    [0, "passed", "recent-volume-record"],
    [900, "passed", "recent-volume-record"],
    [900.001, "blocked", "stale-volume-record"],
    [-0.001, "blocked", "future-volume-record"],
  ]) {
    const result = interpretIndex(body({ ...record, timestamp: new Date(now - age * 1000).toISOString() }), options);
    assert.equal(result.status, status);
    assert.equal(result.code, code);
  }
  assert.equal(interpretIndex(body(null), options).code, "no-volume-record");
});

test("rejects GraphQL partial errors, malformed amounts, addresses, dates and index shape", () => {
  for (const value of [
    { ...body(), errors: [{ message: "secret-body" }] },
    { ...body(), errors: {} },
    { data: null },
    { data: { squidStatus: { height: 1.5 }, volumeRecords: [] } },
    { data: { squidStatus: { height: 1 }, volumeRecords: [record, record] } },
  ])
    assert.throws(() => interpretIndex(value, options));
  for (const change of [
    { volume: 123 },
    { volume: "1.5" },
    { volume: "-1" },
    { volume: "01" },
    { marketToken: "invalid-address" },
    { marketToken: "1".repeat(33) },
    { timestamp: "2026-02-30T00:00:00Z" },
    { timestamp: "2026-10-24" },
    { timestamp: null },
    { id: "" },
  ])
    assert.throws(() => interpretIndex(body({ ...record, ...change }), options));
  for (const timestamp of ["2026-10-24T23:59:59Z", "2026-10-24T23:59:59.123456Z"]) {
    assert.equal(interpretIndex(body({ ...record, timestamp }), options).status, "passed");
  }
});

test("CLI uses the real API defaults, retains blocked state and sanitizes query failures", async () => {
  const config = await readIndexConfig();
  assert.equal(config.maxAgeSeconds, 900);
  assert.equal(config.endpoint, "https://gmx-solana-sqd.squids.live/gmx-solana-base:prod/api/graphql");
  for (const [response, exitCode] of [
    [body(), 0],
    [body(null), 2],
    [{ ...body(), errors: [{ message: "secret-body" }] }, 1],
  ]) {
    let output = "";
    let error = "";
    const code = await runCli({
      args: [],
      now: () => now,
      query: async (url) => {
        assert.equal(url, config.endpoint);
        return response;
      },
      stdout: {
        write: (s) => {
          output += s;
        },
      },
      stderr: {
        write: (s) => {
          error += s;
        },
      },
    });
    assert.equal(code, exitCode);
    assert.ok(!(output + error).includes("secret-body"));
    assert.equal(JSON.parse(output || error).status, exitCode === 0 ? "passed" : exitCode === 2 ? "blocked" : "failed");
  }
  for (const code of [22, 28, "ETIMEDOUT"]) {
    await assert.rejects(
      queryIndex(config.endpoint, undefined, async () => {
        throw Object.assign(new Error("secret-body"), { code });
      }),
      { code: "request-failed" }
    );
  }
  await assert.rejects(
    queryIndex(config.endpoint, undefined, async () => ({ stdout: "secret-invalid-json" })),
    { code: "invalid-json" }
  );
  let error = "";
  assert.equal(
    await runCli({
      args: [],
      query: async () => {
        throw new Error("secret-url");
      },
      stderr: {
        write: (s) => {
          error += s;
        },
      },
    }),
    1
  );
  assert.ok(!error.includes("secret-url"));
});
