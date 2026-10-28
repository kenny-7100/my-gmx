import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { readLocalRuntime } from "./solana-runtime-preflight.mjs";

const require = createRequire(import.meta.url);
const VECTOR_FILE = "tools/solana-sdk-vectors/apply-factor.json";
const U128_MAX = (1n << 128n) - 1n;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const valid = (condition) => {
  if (!condition) throw new Error("Invalid SDK reference vectors.");
};
const integer = (value) =>
  typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 39 && BigInt(value) <= U128_MAX;

export function evaluateVectors(fixture, applyFactor) {
  valid(
    fixture?.schemaVersion === 1 &&
      fixture.operation === "apply_factor" &&
      fixture.factorDecimals === 20 &&
      fixture.rounding === "floor" &&
      fixture.overflow === "undefined-above-u128"
  );
  valid(Array.isArray(fixture.vectors) && fixture.vectors.length > 0 && fixture.vectors.length <= 100);
  const names = new Set();
  for (const item of fixture.vectors) {
    valid(typeof item.name === "string" && /^[a-z][a-z0-9-]{0,60}$/.test(item.name) && !names.has(item.name));
    names.add(item.name);
    valid(integer(item.value) && integer(item.factor) && (item.expected === null || integer(item.expected)));
  }
  return fixture.vectors.map((item) => {
    const result = applyFactor(BigInt(item.value), BigInt(item.factor));
    valid(result === undefined || (typeof result === "bigint" && result >= 0n && result <= U128_MAX));
    const actual = result === undefined ? null : result.toString();
    return { ...item, actual, status: actual === item.expected ? "passed" : "failed" };
  });
}

let sdkLoadPromise;

export function loadPinnedSdk() {
  // wasm-bindgen's wrapper caches memory views; bind it to one instance per process.
  if (!sdkLoadPromise) sdkLoadPromise = initializePinnedSdk();
  return sdkLoadPromise;
}

async function initializePinnedSdk() {
  const local = await readLocalRuntime();
  const bytes = await readFile(require.resolve("@gmsol-labs/gmsol-sdk/index_bg.wasm"));
  // Hash the exact bytes about to be instantiated, including after the shared preflight.
  valid(hash(bytes) === local.approvedWasmSha256);
  const wrapperPath = require.resolve("@gmsol-labs/gmsol-sdk/index_bg.js");
  const wrapper = await readFile(wrapperPath);
  valid(hash(wrapper) === local.sha256["installed-sdk/index_bg.js"]);
  const sdk = await import(pathToFileURL(wrapperPath).href);
  const { instance } = await WebAssembly.instantiate(bytes, { "./index_bg.js": sdk });
  sdk.__wbg_set_wasm(instance.exports);
  instance.exports.__wbindgen_start();
  return { sdk, local };
}

export async function runVectors() {
  const { sdk, local } = await loadPinnedSdk();
  const vectorBytes = await readFile(new URL(`../${VECTOR_FILE}`, import.meta.url));
  const vectors = evaluateVectors(JSON.parse(vectorBytes.toString("utf8")), sdk.apply_factor);
  const status = vectors.every((row) => row.status === "passed") ? "passed" : "failed";
  return {
    status,
    scope: "real-wasm-reference-vectors",
    checkedAt: new Date().toISOString(),
    operation: "apply_factor",
    runtime: "node-webassembly",
    local,
    vectorFile: VECTOR_FILE,
    vectorSha256: hash(vectorBytes),
    generatorSha256: hash(await readFile(new URL("../tools/solana-sdk-vectors/generate.py", import.meta.url))),
    checkerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    programCompatibility: "not-evaluated",
    browserLoading: "not-run",
    businessMath: "not-evaluated",
    vectors,
  };
}

export async function runCli({
  args = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  runner = runVectors,
} = {}) {
  try {
    const { values } = parseArgs({ args, options: { help: { type: "boolean", short: "h" } } });
    if (values.help) {
      stdout.write(
        "Usage: yarn solana:sdk-vectors\nOffline real pinned WASM and apply_factor reference vectors. No network, wallet, build, or transactions.\n"
      );
      return 0;
    }
    const report = await runner();
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch {
    stderr.write(
      `${JSON.stringify({ status: "failed", code: "sdk-vectors-failed", message: "Check pinned SDK artifacts, vector format and WASM initialization. No input or secret details were logged." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
