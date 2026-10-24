import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { deriveAddresses, deriveEd25519PublicKey, runCli } from "./agent-wallet.mjs";

// Public Hardhat development mnemonic. Never fund these addresses.
const PUBLIC_PHRASE = "test test test test test test test test test test test junk";

test("Ed25519 hardened derivation matches independent SLIP-0010 public-key vectors", () => {
  const seed = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
  // https://github.com/satoshilabs/slips/blob/master/slip-0010.md#test-vector-1-for-ed25519
  for (const [indices, publicKey] of [
    [[], "a4b2856bfec510abab89753fac1ac0e1112364e7d250545963f135f2a33188ed"],
    [[0], "8c8a13df77a28f3445213a0f432fde644acaa215fc72dcdf300d5efaa85d350c"],
    [[0, 1], "1932a5270f335bed617d5b935c80aedb1a35bd9fc1e31acafd5372c30f5c1187"],
    [[0, 1, 2, 2, 1000000000], "3c24da049451555d51a7014a37337aa4e12d41e485abccfa46b47dfb2af54b7a"],
  ]) {
    assert.equal(deriveEd25519PublicKey(seed, indices).toString("hex"), publicKey);
  }
  for (const index of [-1, 0.5, 0x80000000]) assert.throws(() => deriveEd25519PublicKey(seed, [index]));
});

test("fixed wallet paths produce public-only reports and reject invalid mnemonic checksums", () => {
  const report = deriveAddresses(PUBLIC_PHRASE);
  assert.equal(report.wallets[0].path, "m/44'/60'/0'/0/0");
  assert.equal(report.wallets[0].address, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  assert.equal(report.wallets[1].path, "m/44'/501'/0'/0'");
  assert.match(report.wallets[1].address, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.deepEqual(report, deriveAddresses(PUBLIC_PHRASE));
  for (const phrase of ["", "invalid words", Array(12).fill("abandon").join(" ")]) {
    assert.throws(() => deriveAddresses(phrase), /Invalid English BIP-39 mnemonic/);
  }
  assert.equal(JSON.stringify(report).includes(PUBLIC_PHRASE), false);
  for (const wallet of report.wallets) assert.deepEqual(Object.keys(wallet).sort(), ["address", "chain", "path"]);
});

test("CLI reads only the chosen file, accepts quoted env values and never echoes invalid secrets", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-agent-wallet-"));
  const envFile = path.join(dir, ".env.local");
  try {
    for (const [content, args, expected] of [
      [undefined, ["addresses"], 1],
      ["OTHER_KEY=value", ["addresses"], 1],
      ['AGENT_TEST_WALLET_MNEMONIC=""', ["addresses"], 1],
      ['AGENT_TEST_WALLET_MNEMONIC="secret-invalid-input"', ["addresses"], 1],
      [`OTHER_KEY=keep\nAGENT_TEST_WALLET_MNEMONIC="${PUBLIC_PHRASE}" # test only`, ["addresses"], 0],
      [undefined, ["--mnemonic", "secret-invalid-input"], 1],
      [undefined, ["--help"], 0],
    ]) {
      if (content !== undefined) await writeFile(envFile, content);
      else await rm(envFile, { force: true });
      let output = "";
      let errors = "";
      const exitCode = await runCli({
        args,
        envFile,
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
      assert.equal(exitCode, expected);
      assert.equal((output + errors).includes(PUBLIC_PHRASE), false);
      assert.equal((output + errors).includes("secret-invalid-input"), false);
      if (expected === 1) assert.equal(output, "");
      if (expected === 0 && args[0] === "addresses")
        assert.deepEqual(JSON.parse(output), deriveAddresses(PUBLIC_PHRASE));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
