import { encodeBase58 } from "ethers";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { readTransactionEvidence } from "./solana-transaction-evidence.mjs";

const signature = encodeBase58(new Uint8Array(64).fill(7));
const genesis = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
function scenario({ err = null, version = "legacy", mutate = (state) => state, network = genesis } = {}) {
  const status = { slot: 12, confirmations: null, confirmationStatus: "finalized", err };
  const receipt = {
    slot: 12,
    version,
    blockTime: null,
    transaction: {
      signatures: [signature],
      message: { accountKeys: ["11111111111111111111111111111111"], instructions: [] },
    },
    meta: { err, fee: 5000, preBalances: [10000], postBalances: [5000] },
  };
  if (version === 0) receipt.meta.loadedAddresses = { writable: [], readonly: [] };
  const state = { status, receipt, contextSlot: 13 };
  mutate(state);
  const methods = [];
  const fetchImpl = async (_url, options) => {
    const { method, id, params } = JSON.parse(options.body);
    methods.push(method);
    let result;
    if (method === "getGenesisHash") result = network;
    if (method === "getSignatureStatuses") {
      assert.deepEqual(params, [[signature], { searchTransactionHistory: true }]);
      result = { context: { slot: state.contextSlot }, value: [state.status] };
    }
    if (method === "getTransaction") {
      assert.deepEqual(params, [
        signature,
        { commitment: "finalized", encoding: "json", maxSupportedTransactionVersion: 0 },
      ]);
      result = state.receipt;
    }
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id, result }).replace(
        '"preBalances":[10000]',
        '"preBalances":[18446744073709551615]'
      )
    );
  };
  return { signature, rpcUrl: "http://127.0.0.1:3030", fetchImpl, methods };
}

test("preserves exact receipts and distinguishes transaction success from failure across versions", async () => {
  for (const version of ["legacy", 0]) {
    for (const err of [null, { InstructionError: [0, "InvalidArgument"] }, "AccountNotFound"]) {
      const report = await readTransactionEvidence(scenario({ err, version }));
      assert.equal(report.status, err === null ? "passed" : "failed");
      assert.equal(report.transactionOutcome, err === null ? "succeeded" : "failed");
      assert.equal(report.receipt.meta.preBalances[0], 18446744073709551615n);
      assert.equal(report.orderExecution, "not-evaluated");
      const text = JSON.stringify(report.receipt, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      );
      assert.equal(report.receiptSha256, createHash("sha256").update(text).digest("hex"));
    }
  }
});

test("blocks missing, pending and unavailable receipts without inferring success", async () => {
  for (const [mutate, code, count] of [
    [
      (s) => {
        s.status = null;
      },
      "signature-not-found",
      2,
    ],
    [
      (s) => {
        s.status.confirmationStatus = "processed";
        s.status.confirmations = 1;
      },
      "not-finalized",
      2,
    ],
    [
      (s) => {
        s.status.confirmationStatus = "confirmed";
        s.status.confirmations = 2;
      },
      "not-finalized",
      2,
    ],
    [
      (s) => {
        s.receipt = null;
      },
      "receipt-unavailable",
      3,
    ],
  ]) {
    const input = scenario({ mutate });
    const report = await readTransactionEvidence(input);
    assert.equal(report.status, "blocked");
    assert.equal(report.code, code);
    assert.equal(report.receipt, null);
    assert.equal(input.methods.length, count);
  }
});

test("rejects conflicting or malformed evidence and stops on the wrong network", async () => {
  const changes = [
    (s) => {
      s.receipt.transaction.message.accountKeys = [];
    },
    (s) => {
      s.receipt.transaction.message.instructions = null;
    },
    (s) => {
      s.receipt.meta.loadedAddresses = {};
    },
    (s) => {
      s.receipt.slot = 11;
    },
    (s) => {
      s.receipt.transaction.signatures = ["wrong"];
    },
    (s) => {
      s.receipt.meta.err = "AccountNotFound";
    },
    (s) => {
      s.receipt.meta = null;
    },
    (s) => {
      delete s.status.err;
    },
    (s) => {
      s.status.slot = 14;
    },
    (s) => {
      s.status.confirmations = 0;
    },
    (s) => {
      s.status.confirmationStatus = "invalid";
    },
    (s) => {
      s.receipt.version = 1;
    },
    (s) => {
      s.receipt.meta.fee = -1;
    },
    (s) => {
      s.receipt.meta.postBalances = [];
    },
    (s) => {
      s.receipt.meta.preBalances = [0.5];
    },
    (s) => {
      delete s.receipt.transaction.message;
    },
    (s) => {
      s.contextSlot = 0;
    },
    (s) => {
      s.receipt.blockTime = -1;
    },
  ];
  for (const mutate of changes)
    await assert.rejects(readTransactionEvidence(scenario({ mutate })), { code: "invalid-response" });
  const input = scenario({ network: "devnet" });
  await assert.rejects(readTransactionEvidence(input), { code: "wrong-network" });
  assert.deepEqual(input.methods, ["getGenesisHash"]);
});
