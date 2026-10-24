import { encodeBase58, getBytes, HDNodeWallet, Mnemonic } from "ethers";
import { createHmac, createPrivateKey, createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, parseEnv } from "node:util";

const ENV_FILE = fileURLToPath(new URL("../.env.local", import.meta.url));
const MNEMONIC_KEY = "AGENT_TEST_WALLET_MNEMONIC";
const EVM_PATH = "m/44'/60'/0'/0/0";
const SOLANA_INDICES = [44, 501, 0, 0];
const SOLANA_PATH = `m/${SOLANA_INDICES.map((index) => `${index}'`).join("/")}`;
const HARDENED_OFFSET = 0x80000000;
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

class WalletConfigError extends Error {}

export async function readMnemonic(envFile = ENV_FILE) {
  let text;
  try {
    text = await readFile(envFile, "utf8");
  } catch {
    throw new WalletConfigError("Cannot read .env.local. Configure AGENT_TEST_WALLET_MNEMONIC in the repository root.");
  }
  let phrase;
  try {
    phrase = parseEnv(text)[MNEMONIC_KEY];
  } catch {
    throw new WalletConfigError("Cannot parse .env.local. Check the environment file syntax.");
  }
  if (!phrase?.trim()) {
    throw new WalletConfigError("AGENT_TEST_WALLET_MNEMONIC is missing or empty in .env.local.");
  }
  return phrase;
}

// SLIP-0010 Ed25519 supports hardened child derivation only.
export function deriveEd25519PublicKey(seed, indices) {
  let digest = createHmac("sha512", "ed25519 seed").update(seed).digest();
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= HARDENED_OFFSET) {
      throw new Error("Invalid hardened derivation index.");
    }
    const childIndex = Buffer.alloc(4);
    childIndex.writeUInt32BE(index + HARDENED_OFFSET);
    digest = createHmac("sha512", digest.subarray(32))
      .update(Buffer.concat([Buffer.from([0]), digest.subarray(0, 32), childIndex]))
      .digest();
  }
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, digest.subarray(0, 32)]),
    format: "der",
    type: "pkcs8",
  });
  return createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32);
}

export function deriveAddresses(phrase) {
  let mnemonic;
  try {
    mnemonic = Mnemonic.fromPhrase(phrase);
  } catch {
    throw new WalletConfigError("Invalid English BIP-39 mnemonic. Check the words, word count, and checksum.");
  }
  const seed = getBytes(mnemonic.computeSeed());
  try {
    return {
      accountIndex: 0,
      bip39Passphrase: "none",
      wallets: [
        { chain: "evm", path: EVM_PATH, address: HDNodeWallet.fromMnemonic(mnemonic, EVM_PATH).address },
        { chain: "solana", path: SOLANA_PATH, address: encodeBase58(deriveEd25519PublicKey(seed, SOLANA_INDICES)) },
      ],
    };
  } finally {
    seed.fill(0);
  }
}

export async function runCli({
  args = process.argv.slice(2),
  envFile = ENV_FILE,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    let parsed;
    try {
      parsed = parseArgs({ args, allowPositionals: true, options: { help: { type: "boolean", short: "h" } } });
    } catch {
      throw new WalletConfigError(
        "Invalid arguments. Use yarn agent:wallet --help. Never pass a mnemonic as an argument."
      );
    }
    if (parsed.values.help) {
      stdout.write(
        "Usage: yarn agent:wallet addresses\nReads AGENT_TEST_WALLET_MNEMONIC from root .env.local. Outputs public addresses only; no network access.\n"
      );
      return 0;
    }
    if (parsed.positionals.length !== 1 || parsed.positionals[0] !== "addresses") {
      throw new WalletConfigError("Expected the addresses command. Use yarn agent:wallet --help.");
    }
    const report = deriveAddresses(await readMnemonic(envFile));
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (error) {
    stderr.write(
      `${JSON.stringify({
        status: "failed",
        message:
          error instanceof WalletConfigError
            ? error.message
            : "Wallet derivation failed. No secret details were logged.",
      })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
