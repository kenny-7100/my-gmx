import { decodeBase58 } from "ethers";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";

import { connectSolanaMainnet, WalletRpcError } from "./agent-wallet-balance.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const stringify = (value) => JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
const valid = (condition, message) => {
  if (!condition) throw new WalletRpcError("invalid-response", message);
};
const uint = (value) => typeof value === "bigint" && value >= 0n && value <= 18446744073709551615n;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validError = (value) =>
  value === null || (typeof value === "string" && value.length > 0) || (object(value) && Object.keys(value).length > 0);

function validateSignature(signature) {
  let size = 0;
  if (typeof signature === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
    const value = decodeBase58(signature);
    size = signature.match(/^1*/)[0].length + (value === 0n ? 0 : Math.ceil(value.toString(16).length / 2));
  }
  if (size !== 64) throw new WalletRpcError("configuration-error", "Signature must be a base58-encoded 64-byte value.");
}

export async function readTransactionEvidence({ signature, rpcUrl, fetchImpl = fetch }) {
  validateSignature(signature);
  const { genesisHash, rpcOrigin, request } = await connectSolanaMainnet({ rpcUrl, fetchImpl });
  const result = await request("getSignatureStatuses", [[signature], { searchTransactionHistory: true }], 2);
  valid(uint(result?.context?.slot) && result.context.slot > 0n, "Signature status context is invalid.");
  valid(Array.isArray(result.value) && result.value.length === 1, "Expected exactly one signature status.");
  const status = result.value[0];
  const base = {
    checkedAt: new Date().toISOString(),
    network: "solana-mainnet",
    genesisHash,
    rpcOrigin,
    signature,
    scope: "transaction-receipt",
    orderExecution: "not-evaluated",
    statusContextSlot: result.context.slot,
  };
  if (status === null) return { ...base, status: "blocked", code: "signature-not-found", receipt: null };
  valid(uint(status?.slot) && status.slot > 0n, "Signature status slot is invalid.");
  valid(validError(status.err), "Signature status error is invalid.");
  valid(["processed", "confirmed", "finalized"].includes(status.confirmationStatus), "Signature finality is invalid.");
  valid(status.slot <= result.context.slot, "Signature slot exceeds its observation context.");
  if (status.confirmationStatus !== "finalized") {
    return { ...base, status: "blocked", code: "not-finalized", signatureStatus: status, receipt: null };
  }
  valid(status.confirmations === null, "Finalized status must have null confirmations.");
  const receipt = await request(
    "getTransaction",
    [signature, { commitment: "finalized", encoding: "json", maxSupportedTransactionVersion: 0 }],
    3
  );
  if (receipt === null) {
    return { ...base, status: "blocked", code: "receipt-unavailable", signatureStatus: status, receipt: null };
  }
  valid(receipt?.slot === status.slot, "Receipt slot does not match signature status.");
  valid(receipt.version === "legacy" || receipt.version === 0n, "Unsupported transaction version.");
  valid(
    Array.isArray(receipt.transaction?.signatures) && receipt.transaction.signatures[0] === signature,
    "Receipt does not identify the requested transaction."
  );
  valid(object(receipt.transaction.message), "Receipt message is missing.");
  const meta = receipt.meta;
  valid(object(meta) && validError(meta.err), "Receipt metadata or execution result is missing.");
  valid(isDeepStrictEqual(meta.err, status.err), "Receipt error does not match signature status.");
  valid(uint(meta.fee), "Receipt fee is invalid.");
  valid(
    Array.isArray(meta.preBalances) &&
      Array.isArray(meta.postBalances) &&
      meta.preBalances.length > 0 &&
      meta.preBalances.length === meta.postBalances.length &&
      meta.preBalances.every(uint) &&
      meta.postBalances.every(uint),
    "Receipt native balances are invalid."
  );
  const message = receipt.transaction.message;
  const loaded = meta.loadedAddresses;
  valid(
    Array.isArray(message.accountKeys) &&
      message.accountKeys.length > 0 &&
      message.accountKeys.every((key) => typeof key === "string") &&
      Array.isArray(message.instructions),
    "Receipt account keys or instructions are missing."
  );
  if (receipt.version === 0n || loaded !== undefined) {
    valid(
      object(loaded) &&
        Array.isArray(loaded.writable) &&
        Array.isArray(loaded.readonly) &&
        [...loaded.writable, ...loaded.readonly].every((key) => typeof key === "string"),
      "Receipt loaded addresses are missing or invalid."
    );
  }
  const accountCount = message.accountKeys.length + (loaded ? loaded.writable.length + loaded.readonly.length : 0);
  valid(accountCount === meta.preBalances.length, "Receipt balances do not match resolved account keys.");
  valid(receipt.blockTime === null || uint(receipt.blockTime), "Receipt block time is invalid.");
  const receiptJson = stringify(receipt);
  return {
    ...base,
    status: meta.err === null ? "passed" : "failed",
    code: meta.err === null ? "transaction-succeeded" : "transaction-failed",
    commitment: "finalized",
    signatureStatus: status,
    transactionOutcome: meta.err === null ? "succeeded" : "failed",
    feeLamports: meta.fee,
    receiptSha256: createHash("sha256").update(receiptJson).digest("hex"),
    receipt,
  };
}

async function sourceEvidence() {
  const files = [
    "scripts/solana-transaction-evidence.mjs",
    "scripts/agent-wallet-balance.mjs",
    "src/config/solanaRpc.json",
  ];
  const sha256 = {};
  for (const file of files)
    sha256[file] = createHash("sha256")
      .update(await readFile(new URL(`../${file}`, import.meta.url)))
      .digest("hex");
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
    dirty: execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim() !== "",
    sha256,
  };
}

export async function runCli({
  args = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  ...options
} = {}) {
  try {
    let parsed;
    try {
      parsed = parseArgs({
        args,
        options: { signature: { type: "string" }, network: { type: "string" }, help: { type: "boolean", short: "h" } },
      });
    } catch {
      throw new WalletRpcError("configuration-error", "Invalid arguments. Use --help.");
    }
    if (parsed.values.help) {
      stdout.write(
        "Usage: yarn solana:transaction-evidence --network solana-mainnet --signature <signature>\nRead-only finalized transaction evidence. No signing, sending, or order-execution inference.\n"
      );
      return 0;
    }
    if (parsed.values.network !== "solana-mainnet")
      throw new WalletRpcError("configuration-error", "Explicit --network solana-mainnet is required.");
    const report = await readTransactionEvidence({ ...options, signature: parsed.values.signature });
    report.source = await sourceEvidence();
    stdout.write(
      `${JSON.stringify(report, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)}\n`
    );
    return report.status === "passed" ? 0 : report.status === "blocked" ? 2 : 1;
  } catch (error) {
    stderr.write(
      `${JSON.stringify({ status: "failed", code: error instanceof WalletRpcError ? error.code : "internal-error", message: error instanceof WalletRpcError ? error.message : "Transaction evidence collection failed. No request or secret details were logged." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
