import { encodeBase58 } from "ethers";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { connectSolanaMainnet, WalletRpcError } from "./agent-wallet-balance.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isAddress = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const isSlot = (value) => typeof value === "bigint" && value > 0n && value <= 18446744073709551615n;

export class RuntimeCheckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function requireValid(condition, code, message) {
  if (!condition) throw new RuntimeCheckError(code, message);
}

export function findWasmReference(entry) {
  const references = [...entry.matchAll(/new URL\(["']([^"']+\.wasm(?:\?[^"']*)?)["'],\s*import\.meta\.url\s*\)/g)].map(
    (match) => match[1]
  );
  requireValid(
    references.length === 1 && /^assets\/[A-Za-z0-9._-]+\.wasm(?:\?init)?$/.test(references[0]),
    "invalid-artifact",
    "Expected one local WASM asset reference in the SDK entry."
  );
  return references[0].split("?")[0];
}

export function checkSdkBytes({ declaredVersion, installedVersion, approvedHash, installedWasm, builtWasm }) {
  requireValid(
    typeof declaredVersion === "string" &&
      /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(declaredVersion) &&
      installedVersion === declaredVersion,
    "sdk-version-mismatch",
    "Installed SDK must match the exact declared version."
  );
  const installedWasmSha256 = sha256(installedWasm);
  const builtWasmSha256 = sha256(builtWasm);
  requireValid(
    installedWasmSha256 === approvedHash && builtWasmSha256 === approvedHash,
    "wasm-hash-mismatch",
    "Installed and built WASM must match the configured approved SHA-256."
  );
  return { version: installedVersion, approvedWasmSha256: approvedHash, installedWasmSha256, builtWasmSha256 };
}

export async function readLocalRuntime({ root = ROOT } = {}) {
  const { GMSOL_SDK_ASSET_PATH, GMSOL_SDK_WASM_SHA256 } = await import("../src/config/gmsol/sdk.ts");
  const packageDir = path.dirname(require.resolve("@gmsol-labs/gmsol-sdk/index_bg.wasm"));
  const manifestBytes = await readFile(path.join(root, "package.json"));
  const installedManifestBytes = await readFile(path.join(packageDir, "package.json"));
  const entryPath = `public/${GMSOL_SDK_ASSET_PATH}/entry.js`;
  const entryBytes = await readFile(path.join(root, entryPath));
  const wasmAsset = findWasmReference(entryBytes.toString("utf8"));
  const builtWasm = await readFile(path.join(root, "public", GMSOL_SDK_ASSET_PATH, wasmAsset));
  const installedWasm = await readFile(path.join(packageDir, "index_bg.wasm"));
  const sdk = checkSdkBytes({
    declaredVersion: JSON.parse(manifestBytes).dependencies["@gmsol-labs/gmsol-sdk"],
    installedVersion: JSON.parse(installedManifestBytes).version,
    approvedHash: GMSOL_SDK_WASM_SHA256,
    installedWasm,
    builtWasm,
  });
  const files = [
    "src/config/gmsol/sdk.ts",
    "src/config/gmsol/program.ts",
    "src/domain/gmsol/sdk-entry.js",
    "vite.gmsol.config.ts",
    "yarn.lock",
    "scripts/solana-runtime-preflight.mjs",
    "scripts/agent-wallet-balance.mjs",
  ];
  const hashes = {
    "package.json": sha256(manifestBytes),
    [entryPath]: sha256(entryBytes),
    "installed-sdk/package.json": sha256(installedManifestBytes),
    "installed-sdk/index_bg.js": sha256(await readFile(path.join(packageDir, "index_bg.js"))),
  };
  for (const file of files) hashes[file] = sha256(await readFile(path.join(root, file)));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  return {
    status: "passed",
    repository: { commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain").length > 0 },
    nodeVersion: process.version,
    ...sdk,
    assetPath: GMSOL_SDK_ASSET_PATH,
    wasmAsset,
    entryProvenance: "fingerprint-only",
    sha256: hashes,
  };
}

export function parseProgramAccount(result) {
  const account = result?.value;
  requireValid(
    isSlot(result?.context?.slot) &&
      account?.owner === LOADER &&
      account.executable === true &&
      account.data?.parsed?.type === "program",
    "invalid-program-account",
    "Expected an executable upgradeable-loader program account."
  );
  const programDataAddress = account.data.parsed.info?.programData;
  requireValid(isAddress(programDataAddress), "invalid-program-account", "ProgramData address is missing or invalid.");
  return { programDataAddress, programReadSlot: result.context.slot.toString() };
}

const PROGRAM_DATA_HEADER_BYTES = 45;
const CHUNK_BYTES = 256 * 1024;

function readAccountBytes(result, expectedLength) {
  const account = result?.value;
  const data = account?.data;
  requireValid(
    isSlot(result?.context?.slot) && account?.owner === LOADER && account.executable === false,
    "invalid-program-data",
    "Expected non-executable loader-owned ProgramData."
  );
  requireValid(
    typeof account.space === "bigint" && account.space > 45n && account.space <= 10_485_760n,
    "invalid-program-data",
    "ProgramData space is invalid."
  );
  requireValid(
    Array.isArray(data) && data.length === 2 && typeof data[0] === "string" && data[1] === "base64",
    "invalid-program-data",
    "Expected base64 ProgramData bytes."
  );
  const bytes = Buffer.from(data[0], "base64");
  requireValid(
    bytes.toString("base64") === data[0] && bytes.length === expectedLength,
    "invalid-program-data",
    "ProgramData slice is truncated or invalid."
  );
  return bytes;
}

export function parseProgramData(result) {
  const bytes = readAccountBytes(result, PROGRAM_DATA_HEADER_BYTES);
  const deploymentSlot = bytes.readBigUInt64LE(4);
  requireValid(
    bytes.readUInt32LE(0) === 3 &&
      isSlot(deploymentSlot) &&
      deploymentSlot < result.context.slot &&
      [0, 1].includes(bytes[12]),
    "invalid-program-data",
    "ProgramData header or deployment slot is invalid or not yet stable."
  );
  return {
    programDataReadSlot: result.context.slot.toString(),
    deploymentSlot: deploymentSlot.toString(),
    upgradeAuthority: bytes[12] === 1 ? encodeBase58(bytes.subarray(13, 45)) : null,
    accountBytes: Number(result.value.space),
    headerSha256: sha256(bytes),
  };
}

export async function readProgramRuntime({ rpcUrl, fetchImpl = fetch } = {}) {
  const { GMSOL_STORE_PROGRAM_ID } = await import("../src/config/gmsol/program.ts");
  const { genesisHash, rpcOrigin, request } = await connectSolanaMainnet({ rpcUrl, fetchImpl });
  const commitment = "finalized";
  const program = parseProgramAccount(
    await request("getAccountInfo", [GMSOL_STORE_PROGRAM_ID, { encoding: "jsonParsed", commitment }], 2)
  );
  let id = 3;
  const readSlice = (offset, length) =>
    request(
      "getAccountInfo",
      [program.programDataAddress, { encoding: "base64", commitment, dataSlice: { offset, length } }],
      id++
    );
  const initial = await readSlice(0, PROGRAM_DATA_HEADER_BYTES);
  const header = parseProgramData(initial);
  requireValid(
    initial.context.slot >= BigInt(program.programReadSlot),
    "unstable-program-data",
    "ProgramData read is older than the program account read."
  );
  let lastReadSlot = initial.context.slot;
  const hasher = createHash("sha256");
  const programBytes = header.accountBytes - PROGRAM_DATA_HEADER_BYTES;
  let chunks = 0;
  for (let offset = 0; offset < programBytes; offset += CHUNK_BYTES) {
    const length = Math.min(CHUNK_BYTES, programBytes - offset);
    const result = await readSlice(PROGRAM_DATA_HEADER_BYTES + offset, length);
    const bytes = readAccountBytes(result, length);
    requireValid(
      result.value.space === initial.value.space && result.context.slot >= lastReadSlot,
      "unstable-program-data",
      "ProgramData size or read slot changed unexpectedly."
    );
    if (offset === 0)
      requireValid(
        bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])),
        "invalid-program-data",
        "Expected ELF program bytes."
      );
    lastReadSlot = result.context.slot;
    hasher.update(bytes);
    chunks++;
  }
  const final = await readSlice(0, PROGRAM_DATA_HEADER_BYTES);
  const finalHeader = parseProgramData(final);
  requireValid(
    finalHeader.headerSha256 === header.headerSha256 &&
      finalHeader.accountBytes === header.accountBytes &&
      final.context.slot >= lastReadSlot,
    "unstable-program-data",
    "Program deployment changed during the read. No fingerprint was accepted."
  );
  return {
    status: "passed",
    network: "solana-mainnet",
    genesisHash,
    rpcOrigin,
    programId: GMSOL_STORE_PROGRAM_ID,
    loader: LOADER,
    commitment,
    ...program,
    ...header,
    finalReadSlot: final.context.slot.toString(),
    programBytes,
    chunks,
    programSha256: hasher.digest("hex"),
  };
}

export async function runCli(args = process.argv.slice(2)) {
  let stage = "configuration";
  try {
    const { values } = parseArgs({
      args,
      options: { "local-only": { type: "boolean" }, help: { type: "boolean", short: "h" } },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:runtime-preflight [--local-only]\nChecks local SDK/WASM fingerprints and, by default, Mainnet program deployment evidence. No build, wallet access, signing or sending.\n"
      );
      return 0;
    }
    stage = "local-artifacts";
    const local = await readLocalRuntime();
    stage = "mainnet-program";
    const chain = values["local-only"] ? { status: "not-run", code: "local-only" } : await readProgramRuntime();
    process.stdout.write(
      `${JSON.stringify({ status: "passed", scope: values["local-only"] ? "local-artifacts" : "local-artifacts-and-mainnet-program", checkedAt: new Date().toISOString(), local, chain }, null, 2)}\n`
    );
    return 0;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", stage, code: error instanceof RuntimeCheckError || error instanceof WalletRpcError ? error.code : error?.code === "ENOENT" || error?.code === "MODULE_NOT_FOUND" ? "missing-artifact" : "configuration-or-internal-error", message: error instanceof RuntimeCheckError || error instanceof WalletRpcError ? error.message : "Check arguments, installed dependencies, local SDK artifacts and RPC service. No artifacts were rebuilt." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
