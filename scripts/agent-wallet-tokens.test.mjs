import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTokenAccounts, readSolanaTokenInventory, TOKEN_PROGRAMS } from "./agent-wallet-tokens.mjs";

const OWNER = "5YWh3pxkfA1eXaHuGhjB8nD6un2K8BuhhMzLQpFfYhEb";
const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const entry = (program, amount = "1", decimals = 6n) => ({
  pubkey: "11111111111111111111111111111111",
  account: {
    owner: program.address,
    executable: false,
    data: {
      parsed: {
        type: "account",
        info: {
          owner: OWNER,
          mint: MINT,
          state: "initialized",
          isNative: false,
          tokenAmount: { amount, decimals, uiAmount: 999999 },
        },
      },
    },
  },
});
const parse = (entries, program = TOKEN_PROGRAMS[0], slot = 1n) =>
  parseTokenAccounts({ result: { context: { slot }, value: entries }, owner: OWNER, program });

test("token inventory keeps exact per-account amounts across programs, decimals, zero and frozen states", () => {
  for (const program of TOKEN_PROGRAMS) {
    for (const [raw, decimals, amount] of [
      ["0", 0n, "0"],
      ["1", 6n, "0.000001"],
      ["9007199254740993", 9n, "9007199.254740993"],
      ["18446744073709551615", 0n, "18446744073709551615"],
    ]) {
      const account = entry(program, raw, decimals);
      account.account.data.parsed.info.state = "frozen";
      const report = parse([account], program, 9007199254740993n);
      assert.equal(report.accounts[0].rawAmount, raw);
      assert.equal(report.accounts[0].amount, amount);
      assert.equal(report.accounts[0].state, "frozen");
      assert.equal(report.slot, "9007199254740993");
    }
    assert.deepEqual(parse([], program).accounts, []);
  }
});

test("invalid ownership, amounts, states, duplicate accounts and unsupported parsing fail instead of disappearing", () => {
  for (const mutate of [
    (e) => {
      e.account.owner = TOKEN_PROGRAMS[1].address;
    },
    (e) => {
      e.account.data.parsed.info.owner = MINT;
    },
    (e) => {
      e.account.data.parsed.info.mint = "1".repeat(33);
    },
    (e) => {
      e.account.data = ["base64-data", "base64"];
    },
    (e) => {
      e.account.data.parsed.info.tokenAmount.amount = "18446744073709551616";
    },
    ...["-1", "1.1", "01", "NaN"].map((value) => (e) => {
      e.account.data.parsed.info.tokenAmount.amount = value;
    }),
    ...[-1n, 256n, "6"].map((value) => (e) => {
      e.account.data.parsed.info.tokenAmount.decimals = value;
    }),
  ]) {
    const account = entry(TOKEN_PROGRAMS[0]);
    mutate(account);
    assert.throws(() => parse([account]), { code: "invalid-response" });
  }
  const account = entry(TOKEN_PROGRAMS[0]);
  assert.throws(() => parse([account, account]), { code: "invalid-response" });
});

test("Mainnet genesis precedes both program reads and a second-program error never yields partial success", async () => {
  for (const failSecond of [false, true]) {
    const calls = [];
    const report = readSolanaTokenInventory({
      address: OWNER,
      rpcUrl: "http://127.0.0.1:3030",
      fetchImpl: async (_url, options) => {
        const request = JSON.parse(options.body);
        calls.push(request);
        if (request.method === "getGenesisHash")
          return Response.json({ jsonrpc: "2.0", id: request.id, result: GENESIS });
        if (failSecond && request.id === 3)
          return Response.json({ jsonrpc: "2.0", id: 3, error: { code: -32600, message: "private-upstream-detail" } });
        return Response.json({ jsonrpc: "2.0", id: request.id, result: { context: { slot: 1 }, value: [] } });
      },
    });
    if (failSecond) await assert.rejects(report, { code: "rpc-error" });
    else assert.equal((await report).accountCount, 0);
    assert.equal(calls[0].method, "getGenesisHash");
    assert.deepEqual(
      calls.slice(1).map((c) => c.params),
      TOKEN_PROGRAMS.map((p) => [OWNER, { programId: p.address }, { encoding: "jsonParsed", commitment: "confirmed" }])
    );
  }
});
