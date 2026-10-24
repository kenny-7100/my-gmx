import { readFile } from "node:fs/promises";

const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const U64_MAX = 18446744073709551615n;
const REQUEST_TIMEOUT_MS = 25_000;

export class WalletRpcError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function requireValid(condition, message) {
  if (!condition) throw new WalletRpcError("invalid-response", message);
}

function isU64(value) {
  return typeof value === "bigint" && value >= 0n && value <= U64_MAX;
}

async function rpcRequest({ rpcUrl, method, params, id, fetchImpl }) {
  let response;
  let text;
  try {
    response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    text = await response.text();
  } catch (error) {
    const timedOut = ["TimeoutError", "AbortError"].includes(error?.name);
    throw new WalletRpcError(timedOut ? "timeout" : "network-error", `RPC ${method} failed before receiving its body.`);
  }
  if (!response.ok) throw new WalletRpcError("http-error", `RPC ${method} returned HTTP ${response.status}.`);
  let data;
  try {
    // Node 22 exposes the original numeric token, before IEEE-754 rounding.
    data = JSON.parse(text, (_key, value, context) =>
      typeof value === "number" && /^-?\d+$/.test(context?.source ?? "") ? BigInt(context.source) : value
    );
  } catch {
    throw new WalletRpcError("invalid-json", `RPC ${method} returned invalid JSON.`);
  }
  requireValid(data?.jsonrpc === "2.0" && data.id === BigInt(id), `RPC ${method} returned an invalid envelope.`);
  if (Object.prototype.hasOwnProperty.call(data, "error")) {
    throw new WalletRpcError("rpc-error", `RPC ${method} returned a JSON-RPC error.`);
  }
  return data.result;
}

export async function connectSolanaMainnet({ rpcUrl, fetchImpl = fetch }) {
  if (!rpcUrl) {
    const config = JSON.parse(await readFile(new URL("../src/config/solanaRpc.json", import.meta.url), "utf8"));
    rpcUrl = process.env.SOLANA_RPC_PROXY_URL ?? config.localUrl;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(rpcUrl);
  } catch {
    throw new WalletRpcError("configuration-error", "SOLANA_RPC_PROXY_URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new WalletRpcError("configuration-error", "SOLANA_RPC_PROXY_URL must use HTTP(S).");
  }
  const genesisHash = await rpcRequest({ rpcUrl, method: "getGenesisHash", params: [], id: 1, fetchImpl });
  if (genesisHash !== MAINNET_GENESIS) {
    throw new WalletRpcError("wrong-network", "RPC genesis does not match Solana Mainnet. Balance was not requested.");
  }
  return {
    genesisHash,
    rpcOrigin: parsedUrl.origin,
    request: (method, params, id) => rpcRequest({ rpcUrl, method, params, id, fetchImpl }),
  };
}

export async function readSolanaMainnetBalance({ address, rpcUrl, fetchImpl = fetch }) {
  const { genesisHash, rpcOrigin, request } = await connectSolanaMainnet({ rpcUrl, fetchImpl });
  const result = await request("getBalance", [address, { commitment: "confirmed" }], 2);
  requireValid(isU64(result?.value), "RPC balance must be an unsigned 64-bit integer in lamports.");
  requireValid(
    isU64(result?.context?.slot) && result.context.slot > 0n,
    "RPC balance context must contain a positive slot."
  );
  const lamports = result.value;
  const sol = `${lamports / 1_000_000_000n}.${(lamports % 1_000_000_000n).toString().padStart(9, "0")}`;
  return {
    status: "passed",
    checkedAt: new Date().toISOString(),
    network: "solana-mainnet",
    genesisHash,
    rpcOrigin,
    address,
    commitment: "confirmed",
    slot: result.context.slot.toString(),
    asset: "SOL",
    lamports: lamports.toString(),
    sol,
  };
}
