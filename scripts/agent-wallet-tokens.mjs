import { decodeBase58, encodeBase58 } from "ethers";

import { connectSolanaMainnet, WalletRpcError } from "./agent-wallet-balance.mjs";

export const TOKEN_PROGRAMS = [
  { name: "spl-token", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
  { name: "token-2022", address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" },
];
const U64_MAX = 18446744073709551615n;

function requireValid(condition) {
  if (!condition)
    throw new WalletRpcError("invalid-response", "RPC returned invalid token account data. Inventory is incomplete.");
}

function isAddress(value) {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const integer = decodeBase58(value);
  return integer < 1n << 256n && encodeBase58(Buffer.from(integer.toString(16).padStart(64, "0"), "hex")) === value;
}

export function parseTokenAccounts({ result, owner, program, seen = new Set() }) {
  requireValid(typeof result?.context?.slot === "bigint" && result.context.slot > 0n && result.context.slot <= U64_MAX);
  requireValid(Array.isArray(result.value));
  const accounts = result.value.map((entry) => {
    const account = entry?.account;
    const data = account?.data;
    const info = data?.parsed?.info;
    const tokenAmount = info?.tokenAmount;
    requireValid(isAddress(entry?.pubkey) && !seen.has(entry.pubkey));
    requireValid(account?.owner === program.address && account.executable === false);
    requireValid(data?.parsed?.type === "account");
    requireValid(info?.owner === owner && isAddress(info?.mint));
    requireValid(["initialized", "frozen"].includes(info.state) && typeof info.isNative === "boolean");
    requireValid(typeof tokenAmount?.amount === "string" && /^(0|[1-9]\d{0,19})$/.test(tokenAmount.amount));
    const amount = BigInt(tokenAmount.amount);
    requireValid(amount <= U64_MAX);
    requireValid(
      typeof tokenAmount.decimals === "bigint" && tokenAmount.decimals >= 0n && tokenAmount.decimals <= 255n
    );
    const decimals = Number(tokenAmount.decimals);
    const scale = 10n ** tokenAmount.decimals;
    const formattedAmount =
      decimals === 0 ? amount.toString() : `${amount / scale}.${(amount % scale).toString().padStart(decimals, "0")}`;
    seen.add(entry.pubkey);
    return {
      address: entry.pubkey,
      mint: info.mint,
      rawAmount: amount.toString(),
      decimals,
      amount: formattedAmount,
      state: info.state,
      isNative: info.isNative,
    };
  });
  accounts.sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
  return { program: program.name, programId: program.address, slot: result.context.slot.toString(), accounts };
}

export async function readSolanaTokenInventory({ address, rpcUrl, fetchImpl = fetch }) {
  const { genesisHash, rpcOrigin, request } = await connectSolanaMainnet({ rpcUrl, fetchImpl });
  const programs = [];
  const seen = new Set();
  for (const [index, program] of TOKEN_PROGRAMS.entries()) {
    const result = await request(
      "getTokenAccountsByOwner",
      [address, { programId: program.address }, { encoding: "jsonParsed", commitment: "confirmed" }],
      index + 2
    );
    programs.push(parseTokenAccounts({ result, owner: address, program, seen }));
  }
  return {
    status: "passed",
    checkedAt: new Date().toISOString(),
    network: "solana-mainnet",
    genesisHash,
    rpcOrigin,
    address,
    commitment: "confirmed",
    accountCount: programs.reduce((sum, program) => sum + program.accounts.length, 0),
    programs,
  };
}
