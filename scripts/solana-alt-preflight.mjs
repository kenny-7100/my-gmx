import { encodeBase58 } from "ethers";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { connectSolanaMainnet, WalletRpcError } from "./agent-wallet-balance.mjs";

const ALT_PROGRAM = "AddressLookupTab1e1111111111111111111111111";
const META_BYTES = 56;
const U64_MAX = 18446744073709551615n;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export class AltCheckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
function requireValid(condition, message) {
  if (!condition) throw new AltCheckError("invalid-alt-account", message);
}

export function parseLookupTable({ address, account, slot }) {
  requireValid(typeof slot === "bigint" && slot > 0n && slot <= U64_MAX, "ALT response slot is invalid.");
  requireValid(
    account?.owner === ALT_PROGRAM && account.executable === false,
    "Configured ALT is missing or has an unexpected owner or executable flag."
  );
  const encoded = account.data;
  requireValid(
    Array.isArray(encoded) && encoded.length === 2 && typeof encoded[0] === "string" && encoded[1] === "base64",
    "Expected base64 ALT data."
  );
  const bytes = Buffer.from(encoded[0], "base64");
  requireValid(
    bytes.toString("base64") === encoded[0] &&
      bytes.length >= META_BYTES &&
      (bytes.length - META_BYTES) % 32 === 0 &&
      bytes.length <= META_BYTES + 256 * 32,
    "ALT data length or base64 encoding is invalid."
  );
  requireValid(bytes.readUInt32LE(0) === 1 && [0, 1].includes(bytes[21]), "ALT type or authority option is invalid.");
  const deactivationSlot = bytes.readBigUInt64LE(4);
  const lastExtendedSlot = bytes.readBigUInt64LE(12);
  const startIndex = bytes[20];
  const count = (bytes.length - META_BYTES) / 32;
  requireValid(
    lastExtendedSlot <= slot && startIndex <= count && (deactivationSlot === U64_MAX || deactivationSlot <= slot),
    "ALT slot metadata or extension index is invalid."
  );
  const addresses = [];
  for (let offset = META_BYTES; offset < bytes.length; offset += 32)
    addresses.push(encodeBase58(bytes.subarray(offset, offset + 32)));
  const activeAddressCount = lastExtendedSlot === slot ? startIndex : count;
  const code =
    deactivationSlot !== U64_MAX
      ? "deactivation-requested"
      : count === 0
        ? "empty-table"
        : activeAddressCount < count
          ? "extension-warming-up"
          : "active-table";
  return {
    address,
    status: code === "active-table" ? "passed" : "blocked",
    code,
    owner: ALT_PROGRAM,
    deactivationSlot: deactivationSlot.toString(),
    lastExtendedSlot: lastExtendedSlot.toString(),
    lastExtendedSlotStartIndex: startIndex,
    authority: bytes[21] === 1 ? encodeBase58(bytes.subarray(22, 54)) : null,
    addressCount: count,
    activeAddressCount,
    addresses,
    accountBytes: bytes.length,
    dataSha256: sha256(bytes),
  };
}

export async function readLookupTables({ rpcUrl, fetchImpl = fetch } = {}) {
  const { GMSOL_LOOKUP_TABLE_ADDRESSES } = await import("../src/config/gmsol/lookupTables.ts");
  const configured = GMSOL_LOOKUP_TABLE_ADDRESSES;
  if (!configured.length || configured.length > 100 || new Set(configured).size !== configured.length)
    throw new AltCheckError("invalid-alt-configuration", "Expected between 1 and 100 unique configured lookup tables.");
  const configBytes = await readFile(new URL("../src/config/gmsol/lookupTables.ts", import.meta.url));
  const { genesisHash, rpcOrigin, request } = await connectSolanaMainnet({ rpcUrl, fetchImpl });
  const result = await request("getMultipleAccounts", [configured, { encoding: "base64", commitment: "confirmed" }], 2);
  requireValid(
    Array.isArray(result?.value) && result.value.length === configured.length,
    "ALT batch response does not match configured tables."
  );
  const tables = configured.map((address, index) =>
    parseLookupTable({ address, account: result.value[index], slot: result.context?.slot })
  );
  const exitCode = tables.some((table) => table.status !== "passed") ? 2 : 0;
  return {
    status: exitCode === 0 ? "passed" : "blocked",
    exitCode,
    scope: "configured-mainnet-lookup-tables",
    checkedAt: new Date().toISOString(),
    network: "solana-mainnet",
    genesisHash,
    rpcOrigin,
    commitment: "confirmed",
    slot: result.context.slot.toString(),
    configSha256: sha256(configBytes),
    checkerSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    tables,
  };
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({ args, options: { help: { type: "boolean", short: "h" } } });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:alt-preflight\nChecks configured Mainnet lookup tables through the existing RPC proxy. No wallet access, account changes or transactions. Exit: 0 active, 1 failed, 2 blocked.\n"
      );
      return 0;
    }
    const report = await readLookupTables();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.exitCode;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: error instanceof AltCheckError || error instanceof WalletRpcError ? error.code : "configuration-or-internal-error", message: error instanceof AltCheckError || error instanceof WalletRpcError ? error.message : "Check arguments, configured lookup tables, dependencies and RPC service." })}\n`
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
