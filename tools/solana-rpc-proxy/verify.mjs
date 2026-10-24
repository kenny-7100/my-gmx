import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../../src/config/solanaRpc.json", import.meta.url), "utf8"));
const url = process.env.SOLANA_RPC_PROXY_URL || config.localUrl;
const program = "Gmso1uvJnLbawvw7yezdfCDcPydwW2s2iqG3w6MDucLo";
const rpc = (method, params = []) => ({ jsonrpc: "2.0", id: 1, method, params });

async function request({ payload, origin, method = "POST" }) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: method === "POST" ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
}

async function read(payload) {
  const response = await request({ payload });
  assert.equal(response.status, 200);
  const data = await response.json();
  for (const item of Array.isArray(data) ? data : [data]) {
    assert.equal(item.error, undefined, "Upstream returned a JSON-RPC error");
    assert.ok("result" in item);
  }
  return data;
}

try {
  const slot = await read(rpc("getSlot", [{ commitment: "confirmed" }]));
  assert.ok(Number.isInteger(slot.result) && slot.result > 0);
  const batch = await read([rpc("getGenesisHash"), { ...rpc("getVersion"), id: 2 }]);
  assert.equal(batch.find((item) => item.id === 1)?.result, "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  const accounts = await read(
    rpc("getMultipleAccounts", [
      Array(100).fill(program),
      { encoding: "base64", dataSlice: { offset: 0, length: 0 }, commitment: "confirmed" },
    ])
  );
  assert.equal(accounts.result.value.length, 100);
  assert.ok(accounts.result.value.every((account) => account?.executable === true));
  const preflight = await request({ method: "OPTIONS", origin: "http://localhost:3010" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:3010");
  const forbidden = await request({ payload: rpc("getSlot"), origin: "https://example.com" });
  assert.equal(forbidden.status, 403);
  const blocked = await request({ payload: [rpc("getSlot"), rpc("sendTransaction", ["invalid"])] });
  assert.equal(blocked.status, 403);
  const invalid = await request({ payload: rpc("getBalance", ["invalid-address"]) });
  assert.equal(invalid.status, 200);
  assert.equal((await invalid.json()).error.code, -32602);
  console.log("PASS: mainnet slot, batch, 100-account read, local CORS, origin/write guards and upstream errors");
} catch (error) {
  console.error(`FAIL: ${error instanceof assert.AssertionError ? error.message : "RPC proxy request failed"}`);
  process.exitCode = 1;
}
