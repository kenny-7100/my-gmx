import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { createProxyHandler } from "./proxy.mjs";

async function request({ payload, origin, fetchImpl, method = "POST", url = "/" }) {
  const req = Readable.from([Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload ?? {}))]);
  Object.assign(req, { method, url, headers: origin ? { origin } : {} });
  const res = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(status, headers) {
      this.status = status;
      Object.assign(this.headers, headers);
    },
    end(body) {
      this.body = body;
    },
  };
  await createProxyHandler({ key: "test-key", fetchImpl })(req, res);
  return res;
}

test("forwards single and batch reads without changing numeric precision or upstream errors", async () => {
  for (const payload of [
    { jsonrpc: "2.0", id: 1, method: "getSlot", params: [] },
    [
      { jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [["11111111111111111111111111111111"]] },
      { jsonrpc: "2.0", id: 2, method: "simulateTransaction", params: ["encoded-transaction"] },
    ],
  ]) {
    for (const status of [200, 403, 429]) {
      const body = status === 200 ? '{"result":18446744073709551615}' : '{"error":{"code":-32600,"message":"Denied"}}';
      const res = await request({
        payload,
        origin: "http://localhost:3010",
        fetchImpl: async (url, options) => {
          assert.equal(url, "https://solana-mainnet.g.alchemy.com/v2/test-key");
          assert.equal(options.headers.Origin, "https://app.gmx.io");
          assert.equal(options.body, JSON.stringify(payload));
          return new Response(body, { status, headers: { "Content-Type": "application/json" } });
        },
      });
      assert.equal(res.status, status);
      assert.equal(res.body, body);
      assert.equal(res.headers["Access-Control-Allow-Origin"], "http://localhost:3010");
    }
  }
});

test("rejects foreign origins, writes and mixed batches before forwarding; permits local preflight", async () => {
  const read = { jsonrpc: "2.0", id: 1, method: "getSlot" };
  const write = { jsonrpc: "2.0", id: 2, method: "sendTransaction", params: ["signed"] };
  const fetchImpl = () => assert.fail("Rejected requests must not reach upstream");
  for (const input of [
    { payload: read, origin: "https://example.com", status: 403 },
    { payload: read, origin: "http://localhost.example.com", status: 403 },
    { payload: write, status: 403 },
    { payload: [read, write], status: 403 },
    { payload: [], status: 400 },
    { payload: "invalid-json", status: 400 },
    { payload: " ".repeat(1024 * 1024 + 1), status: 413 },
    { method: "OPTIONS", origin: "http://127.0.0.1:3010", status: 204 },
  ]) {
    const res = await request({ ...input, fetchImpl });
    assert.equal(res.status, input.status);
  }
});

test("exposes upstream failure categories without leaking the key", async () => {
  const payload = { jsonrpc: "2.0", id: 1, method: "getSlot" };
  for (const name of ["TypeError", "TimeoutError"]) {
    const res = await request({
      payload,
      fetchImpl: async () => {
        throw Object.assign(new Error("https://upstream/test-key"), { name });
      },
    });
    assert.equal(res.status, name === "TimeoutError" ? 504 : 502);
    assert.ok(!res.body.includes("test-key"));
  }
  const res = await request({
    payload,
    fetchImpl: async () => new Response('{"message":"test-key"}', { status: 403 }),
  });
  assert.equal(res.body, '{"message":"[REDACTED]"}');
});
