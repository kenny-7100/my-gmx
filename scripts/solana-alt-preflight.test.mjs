import assert from "node:assert/strict";
import { test } from "node:test";

import { parseLookupTable, readLookupTables } from "./solana-alt-preflight.mjs";

const OWNER = "AddressLookupTab1e1111111111111111111111111";
const GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const MAX = 18446744073709551615n;
function bytes({ count = 2, deactivation = MAX, extended = 10n, index = 1, authority = 1 } = {}) {
  const data = Buffer.alloc(56 + count * 32);
  data.writeUInt32LE(1);
  data.writeBigUInt64LE(deactivation, 4);
  data.writeBigUInt64LE(extended, 12);
  data[20] = index;
  data[21] = authority;
  data.fill(1, 22, 54);
  for (let i = 0; i < count; i++) data.fill(i % 256, 56 + i * 32, 88 + i * 32);
  return data;
}
const account = (data) => ({ owner: OWNER, executable: false, data: [data.toString("base64"), "base64"] });
const parse = (data, slot = 11n) => parseLookupTable({ address: "configured-table", account: account(data), slot });

test("ALT lifecycle distinguishes ready, warmup, empty and deactivation without losing u64 precision", () => {
  for (const [options, slot, status, code, active] of [
    [{}, 11n, "passed", "active-table", 2],
    [{}, 10n, "blocked", "extension-warming-up", 1],
    [{ count: 0, index: 0 }, 11n, "blocked", "empty-table", 0],
    [{ deactivation: 10n }, 11n, "blocked", "deactivation-requested", 2],
    [
      { authority: 0, count: 256, index: 255, extended: 9007199254740992n },
      9007199254740993n,
      "passed",
      "active-table",
      256,
    ],
  ]) {
    const report = parse(bytes(options), slot);
    assert.equal(report.status, status);
    assert.equal(report.code, code);
    assert.equal(report.activeAddressCount, active);
    assert.equal(report.deactivationSlot, (options.deactivation ?? MAX).toString());
    assert.equal(report.addresses.length, options.count ?? 2);
    assert.equal(report.authority === null, options.authority === 0);
  }
  const report = parse(bytes());
  assert.equal(report.addresses[0], "11111111111111111111111111111111");
  assert.equal(report.dataSha256.length, 64);
});

test("missing, foreign, truncated and malformed table data fail rather than disappearing", () => {
  for (const value of [
    null,
    { ...account(bytes()), owner: "other" },
    { ...account(bytes()), executable: true },
    { ...account(bytes()), data: ["invalid", "base64"] },
    account(bytes().subarray(1)),
    account(Buffer.alloc(55)),
    account(bytes({ count: 257 })),
    account(bytes({ index: 3 })),
    account(bytes({ extended: 12n })),
    account(bytes({ deactivation: 12n })),
    account(bytes({ authority: 2 })),
  ]) {
    assert.throws(() => parseLookupTable({ address: "table", account: value, slot: 11n }), {
      code: "invalid-alt-account",
    });
  }
  const wrongType = bytes();
  wrongType.writeUInt32LE(0);
  assert.throws(() => parse(wrongType), { code: "invalid-alt-account" });
  for (const slot of [0n, -1n, MAX + 1n, "11"])
    assert.throws(() => parse(bytes(), slot), { code: "invalid-alt-account" });
});

test("configured table batch follows Mainnet validation and reports blockers while rejecting incomplete RPC results", async () => {
  const { GMSOL_LOOKUP_TABLE_ADDRESSES } = await import("../src/config/gmsol/lookupTables.ts");
  for (const scenario of ["passed", "blocked", "wrong-network", "rpc-error", "missing", "short-batch"]) {
    const requests = [];
    const pending = readLookupTables({
      rpcUrl: "http://127.0.0.1:3030",
      fetchImpl: async (_url, options) => {
        const request = JSON.parse(options.body);
        requests.push(request);
        if (request.id === 1)
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            result: scenario === "wrong-network" ? "other-network" : GENESIS,
          });
        if (scenario === "rpc-error")
          return Response.json({ jsonrpc: "2.0", id: 2, error: { code: -32600, message: "private-upstream-detail" } });
        let values = GMSOL_LOOKUP_TABLE_ADDRESSES.map(() =>
          account(bytes(scenario === "blocked" ? { deactivation: 10n } : {}))
        );
        if (scenario === "missing") values[0] = null;
        if (scenario === "short-batch") values = values.slice(1);
        return Response.json({ jsonrpc: "2.0", id: 2, result: { context: { slot: 11 }, value: values } });
      },
    });
    if (["passed", "blocked"].includes(scenario)) {
      const report = await pending;
      assert.equal(report.status, scenario);
      assert.equal(report.exitCode, scenario === "passed" ? 0 : 2);
      assert.deepEqual(requests[1].params, [
        GMSOL_LOOKUP_TABLE_ADDRESSES,
        { encoding: "base64", commitment: "confirmed" },
      ]);
    } else
      await assert.rejects(pending, (error) => {
        assert.equal(error.code, ["missing", "short-batch"].includes(scenario) ? "invalid-alt-account" : scenario);
        assert.equal(error.message.includes("private-upstream-detail"), false);
        return true;
      });
    if (scenario === "wrong-network") assert.equal(requests.length, 1);
  }
});
