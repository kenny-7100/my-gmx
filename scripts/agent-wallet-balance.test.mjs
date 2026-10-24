import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { readSolanaMainnetBalance } from "./agent-wallet-balance.mjs";
import { runCli } from "./agent-wallet.mjs";

const GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const ADDRESS = "11111111111111111111111111111111";
const RPC_URL = "http://127.0.0.1:3030";
const genesisResponse = () => Response.json({ jsonrpc: "2.0", id: 1, result: GENESIS });

test("Mainnet balance reads preserve u64 precision, accept zero and check genesis before reading", async () => {
  for (const [lamports, sol] of [
    ["0", "0.000000000"],
    ["1", "0.000000001"],
    ["1000000000", "1.000000000"],
    ["9007199254740993", "9007199.254740993"],
    ["18446744073709551615", "18446744073.709551615"],
  ]) {
    const requests = [];
    const fetchImpl = async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      return request.method === "getGenesisHash"
        ? genesisResponse()
        : new Response(`{"jsonrpc":"2.0","id":2,"result":{"context":{"slot":9007199254740993},"value":${lamports}}}`);
    };
    const report = await readSolanaMainnetBalance({ address: ADDRESS, rpcUrl: RPC_URL, fetchImpl });
    assert.equal(report.status, "passed");
    assert.equal(report.network, "solana-mainnet");
    assert.equal(report.lamports, lamports);
    assert.equal(report.sol, sol);
    assert.equal(report.slot, "9007199254740993");
    assert.deepEqual(
      requests.map((request) => request.method),
      ["getGenesisHash", "getBalance"]
    );
    assert.deepEqual(requests[1].params, [ADDRESS, { commitment: "confirmed" }]);
  }
  let calls = 0;
  await assert.rejects(
    readSolanaMainnetBalance({
      address: ADDRESS,
      rpcUrl: RPC_URL,
      fetchImpl: async () => {
        calls++;
        return Response.json({ jsonrpc: "2.0", id: 1, result: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1" });
      },
    }),
    { code: "wrong-network" }
  );
  assert.equal(calls, 1);
});

test("RPC failures and invalid balances never become successful zero balances", async () => {
  const scenarios = [
    { code: "network-error", error: new TypeError("private-upstream-detail") },
    { code: "timeout", error: new DOMException("private-upstream-detail", "TimeoutError") },
    { code: "http-error", response: () => new Response("private-upstream-detail", { status: 403 }) },
    { code: "invalid-json", response: () => new Response("private-upstream-detail") },
    {
      code: "rpc-error",
      response: () =>
        Response.json({ jsonrpc: "2.0", id: 2, error: { code: -32600, message: "private-upstream-detail" } }),
    },
    { code: "invalid-response", response: () => Response.json({ jsonrpc: "2.0", id: 99, result: {} }) },
    ...[null, -1, "1", 0.5].map((value) => ({
      code: "invalid-response",
      response: () => Response.json({ jsonrpc: "2.0", id: 2, result: { context: { slot: 1 }, value } }),
    })),
    {
      code: "invalid-response",
      response: () =>
        new Response('{"jsonrpc":"2.0","id":2,"result":{"context":{"slot":1},"value":18446744073709551616}}'),
    },
    {
      code: "invalid-response",
      response: () => Response.json({ jsonrpc: "2.0", id: 2, result: { context: { slot: 0 }, value: 0 } }),
    },
  ];
  for (const scenario of scenarios) {
    const fetchImpl = async (_url, options) => {
      if (JSON.parse(options.body).method === "getGenesisHash") return genesisResponse();
      if (scenario.error) throw scenario.error;
      return scenario.response();
    };
    await assert.rejects(readSolanaMainnetBalance({ address: ADDRESS, rpcUrl: RPC_URL, fetchImpl }), (error) => {
      assert.equal(error.code, scenario.code);
      assert.equal(error.message.includes("private-upstream-detail"), false);
      return true;
    });
  }
});

test("balance CLI requires Mainnet explicitly and returns nonzero without secret or endpoint leakage", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-balance-cli-"));
  const envFile = path.join(dir, ".env.local");
  try {
    await writeFile(
      envFile,
      'AGENT_TEST_WALLET_MNEMONIC="test test test test test test test test test test test junk"'
    );
    for (const [args, code] of [
      [["balances"], "configuration-error"],
      [["balances", "--network", "solana-devnet"], "configuration-error"],
      [["balances", "--network", "solana-mainnet"], "network-error"],
    ]) {
      let output = "";
      let errors = "";
      const exit = await runCli({
        args,
        envFile,
        rpcUrl: "https://user:private-token@example.com/private-token",
        fetchImpl: async () => {
          throw new TypeError("private-token");
        },
        stdout: {
          write: (text) => {
            output += text;
          },
        },
        stderr: {
          write: (text) => {
            errors += text;
          },
        },
      });
      assert.equal(exit, 1);
      assert.equal(output, "");
      assert.equal(JSON.parse(errors).code, code);
      assert.equal((output + errors).includes("test test"), false);
      assert.equal(errors.includes("private-token"), false);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
