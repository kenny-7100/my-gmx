import { decodeBase58 } from "ethers";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  checkSdkBytes,
  findWasmReference,
  parseProgramAccount,
  parseProgramData,
  readProgramRuntime,
  readLocalRuntime,
} from "./solana-runtime-preflight.mjs";

const LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const ADDRESS = "CSp2sB68THdrJP6N7Au4Y5u89VJ1E1ebaqZ2soHhQvav";
const GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const program = () => ({
  context: { slot: 1001n },
  value: { owner: LOADER, executable: true, data: { parsed: { type: "program", info: { programData: ADDRESS } } } },
});
function header(slot = 1000n, authority = true) {
  const bytes = Buffer.alloc(45);
  bytes.writeUInt32LE(3);
  bytes.writeBigUInt64LE(slot, 4);
  bytes[12] = authority ? 1 : 0;
  Buffer.from(decodeBase58(ADDRESS).toString(16).padStart(64, "0"), "hex").copy(bytes, 13);
  return bytes;
}
const account = (bytes = header(), space = 53n, slot = 1001n) => ({
  context: { slot },
  value: { owner: LOADER, executable: false, space, data: [bytes.toString("base64"), "base64"] },
});

test("SDK checks use actual pinned config and reject changed versions, bytes or ambiguous asset references", async () => {
  const { GMSOL_SDK_WASM_SHA256 } = await import("../src/config/gmsol/sdk.ts");
  const require = createRequire(import.meta.url);
  const bytes = await readFile(require.resolve("@gmsol-labs/gmsol-sdk/index_bg.wasm"));
  const manifest = JSON.parse(await readFile(require.resolve("@gmsol-labs/gmsol-sdk/package.json"), "utf8"));
  const input = {
    declaredVersion: manifest.version,
    installedVersion: manifest.version,
    approvedHash: GMSOL_SDK_WASM_SHA256,
    installedWasm: bytes,
    builtWasm: bytes,
  };
  assert.equal(checkSdkBytes(input).builtWasmSha256, GMSOL_SDK_WASM_SHA256);
  for (const patch of [
    { installedVersion: "0.0.0" },
    { declaredVersion: `^${manifest.version}` },
    { installedWasm: bytes.subarray(1) },
    { builtWasm: bytes.subarray(1) },
  ])
    assert.throws(() => checkSdkBytes({ ...input, ...patch }));
  assert.equal(findWasmReference('new URL("assets/sdk.wasm?init",import.meta.url)'), "assets/sdk.wasm");
  for (const source of [
    "",
    'new URL("../sdk.wasm",import.meta.url)',
    'new URL("https://example.com/sdk.wasm",import.meta.url)',
    'new URL("assets/a.wasm",import.meta.url);new URL("assets/b.wasm",import.meta.url)',
  ])
    assert.throws(() => findWasmReference(source), { code: "invalid-artifact" });
});

test("missing local artifacts fail without building or accessing RPC", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gmx-runtime-missing-"));
  try {
    await assert.rejects(readLocalRuntime({ root }), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ProgramData headers preserve deployment slots and reject wrong types, owners and malformed slices", () => {
  assert.equal(parseProgramAccount(program()).programDataAddress, ADDRESS);
  for (const authority of [true, false]) {
    const parsed = parseProgramData(account(header(9007199254740992n, authority), 53n, 9007199254740993n));
    assert.equal(parsed.deploymentSlot, "9007199254740992");
    assert.equal(parsed.upgradeAuthority, authority ? ADDRESS : null);
  }
  for (const mutate of [
    (r) => {
      r.value.owner = ADDRESS;
    },
    (r) => {
      r.value.executable = true;
    },
    (r) => {
      r.value.space = 45n;
    },
    (r) => {
      r.value.data = ["not-base64", "base64"];
    },
    (r) => {
      r.value.data[0] = header(1001n).toString("base64");
    },
    (r) => {
      const b = header();
      b[0] = 2;
      r.value.data[0] = b.toString("base64");
    },
    (r) => {
      const b = header();
      b[12] = 2;
      r.value.data[0] = b.toString("base64");
    },
    (r) => {
      r.value.data[0] = header().subarray(1).toString("base64");
    },
  ]) {
    const result = account();
    mutate(result);
    assert.throws(() => parseProgramData(result), { code: "invalid-program-data" });
  }
  const invalid = program();
  invalid.value.executable = false;
  assert.throws(() => parseProgramAccount(invalid), { code: "invalid-program-account" });
});

test("chain reads hash all chunks and reject wrong networks, RPC errors, truncation and deployment changes", async () => {
  const code = Buffer.alloc(256 * 1024 + 17, 0x42);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]).copy(code);
  const full = Buffer.concat([header(), code]);
  for (const failure of ["wrong-network", "rpc-error", "changed", "truncated", "none"]) {
    const requests = [];
    const pending = readProgramRuntime({
      rpcUrl: "http://127.0.0.1:3030",
      fetchImpl: async (_url, options) => {
        const request = JSON.parse(options.body);
        requests.push(request);
        if (request.id === 1)
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            result: failure === "wrong-network" ? "other-network" : GENESIS,
          });
        if (failure === "rpc-error" && request.id === 3)
          return Response.json({ jsonrpc: "2.0", id: 3, error: { code: -32600, message: "private-upstream-detail" } });
        let result = program();
        if (request.id >= 3) {
          const { offset, length } = request.params[1].dataSlice;
          let slice = full.subarray(offset, offset + length);
          if (failure === "changed" && request.id === 6) slice = header(999n);
          if (failure === "truncated" && request.id === 5) slice = slice.subarray(1);
          result = account(slice, BigInt(full.length));
        }
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: request.id, result }, (_key, value) =>
            typeof value === "bigint" ? Number(value) : value
          )
        );
      },
    });
    if (failure === "none") {
      const report = await pending;
      assert.equal(report.chunks, 2);
      assert.equal(report.programSha256, createHash("sha256").update(code).digest("hex"));
      assert.equal(requests[2].params[0], ADDRESS);
    } else
      await assert.rejects(pending, (error) => {
        assert.equal(
          error.code,
          failure === "changed" ? "unstable-program-data" : failure === "truncated" ? "invalid-program-data" : failure
        );
        assert.equal(error.message.includes("private-upstream-detail"), false);
        return true;
      });
    if (failure === "wrong-network") assert.equal(requests.length, 1);
  }
});
