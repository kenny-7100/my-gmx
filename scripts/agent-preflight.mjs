import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TASKS = {
  rpc: { args: ["tools/solana-rpc-proxy/verify.mjs"], timeout: 240_000 },
  keeper: { args: ["node_modules/tsx/dist/cli.mjs", "scripts/keeper-preflight.ts"], timeout: 90_000 },
  api: { args: ["scripts/solana-api-local.mjs", "verify"], timeout: 100_000 },
  wallet: { args: ["scripts/agent-wallet.mjs", "balances", "--network", "solana-mainnet"], timeout: 60_000 },
};
const SUPPORTING_FILES = {
  rpc: ["src/config/solanaRpc.json"],
  keeper: ["sdk/src/configs/oracleKeeper.ts", "sdk/src/configs/tokens.ts", "sdk/src/configs/chains.ts"],
  api: [],
  wallet: ["scripts/agent-wallet-balance.mjs", "scripts/agent-wallet-tokens.mjs", "src/config/solanaRpc.json"],
};
const STATUSES = ["passed", "failed", "blocked", "not-run"];
const validCode = (value) => typeof value === "string" && /^[a-z0-9-]{1,80}$/.test(value);
const isCommit = (value) => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);

export function summarize(results) {
  const selected = results.filter((result) => result.code !== "not-selected");
  if (selected.some((result) => result.status === "failed")) return { status: "failed", exitCode: 1 };
  if (!selected.length || selected.some((result) => result.status !== "passed"))
    return { status: "blocked", exitCode: 2 };
  return { status: "passed", exitCode: 0 };
}

export function runCommand({ args, timeout }) {
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd: ROOT, timeout, maxBuffer: 1_048_576 }, (error, stdout, stderr) => {
      resolve({
        exitCode: error ? (typeof error.code === "number" ? error.code : undefined) : 0,
        errorCode:
          error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
            ? "output-too-large"
            : error?.killed
              ? "timeout"
              : error && typeof error.code !== "number"
                ? "execution-error"
                : undefined,
        stdout,
        stderr,
      });
    });
  });
}

function requireValid(condition) {
  if (!condition) throw new Error("Invalid checker report.");
}

export function interpretResult(name, result) {
  if (result.errorCode) return { status: "failed", code: result.errorCode };
  if (name === "rpc") {
    return result.exitCode === 0 && result.stdout.startsWith("PASS: ")
      ? { status: "passed", code: "rpc-verifier-passed" }
      : { status: "failed", code: "rpc-verifier-failed" };
  }
  try {
    const data = JSON.parse(
      result.exitCode === 0 || (name === "keeper" && [1, 2].includes(result.exitCode)) ? result.stdout : result.stderr
    );
    if (name === "keeper") {
      requireValid(Array.isArray(data.checks) && data.checks.length > 0);
      const checks = data.checks.map(({ name, status, code }) => {
        requireValid(
          typeof name === "string" && /^[A-Za-z0-9:-]{1,80}$/.test(name) && STATUSES.includes(status) && validCode(code)
        );
        return { name, status, code };
      });
      const summary = summarize(checks.map(({ status }) => ({ status })));
      requireValid(
        data.status === summary.status && data.exitCode === summary.exitCode && result.exitCode === summary.exitCode
      );
      return { status: summary.status, code: "keeper-report", checks };
    }
    if (result.exitCode !== 0) {
      requireValid(result.exitCode === 1 && data.status === "failed" && validCode(data.code));
      return { status: "failed", code: data.code };
    }
    requireValid(data.status === "passed");
    if (name === "api") {
      requireValid(
        data.mode === "sample" &&
          Array.isArray(data.checks) &&
          data.checks.length > 0 &&
          data.checks.every((check) => typeof check === "string" && /^[A-Za-z0-9:/-]{1,100}$/.test(check))
      );
      requireValid(isCommit(data.expectedSource?.commit) && typeof data.expectedSource?.dirty === "boolean");
      requireValid(
        data.expectedSource.sha256 &&
          Object.entries(data.expectedSource.sha256).length > 0 &&
          Object.entries(data.expectedSource.sha256).every(
            ([file, hash]) => /^[A-Za-z0-9./-]{1,160}$/.test(file) && /^[a-f0-9]{64}$/.test(hash)
          )
      );
      return {
        status: "passed",
        code: "sample-api-verified",
        mode: "sample",
        checkCount: data.checks.length,
        expectedApiCommit: data.expectedSource.commit,
        expectedApiDirty: data.expectedSource.dirty,
        expectedApiHashes: data.expectedSource.sha256,
      };
    }
    requireValid(name === "wallet" && data.network === "solana-mainnet" && data.asset === "SOL");
    requireValid(typeof data.address === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.address));
    requireValid(typeof data.lamports === "string" && /^\d{1,20}$/.test(data.lamports));
    requireValid(typeof data.sol === "string" && /^\d{1,11}\.\d{9}$/.test(data.sol));
    requireValid(typeof data.slot === "string" && /^\d{1,20}$/.test(data.slot));
    return {
      status: "passed",
      code: "mainnet-sol-read",
      network: data.network,
      address: data.address,
      lamports: data.lamports,
      sol: data.sol,
      slot: data.slot,
    };
  } catch {
    return { status: "failed", code: "invalid-checker-report" };
  }
}

async function readEvidence(selected) {
  const gitCommand = (...args) =>
    new Promise((resolve, reject) => {
      execFile("git", args, { cwd: ROOT, timeout: 10_000 }, (error, stdout) =>
        error ? reject(new Error("Cannot read repository evidence.")) : resolve(stdout.trim())
      );
    });
  const files = [
    "scripts/agent-preflight.mjs",
    "package.json",
    "yarn.lock",
    ...selected
      .flatMap((name) => TASKS[name].args.filter((arg) => arg.endsWith(".mjs") || arg.endsWith(".ts")))
      .filter((file) => !file.startsWith("node_modules/")),
  ];
  const sha256 = {};
  files.push(...selected.flatMap((name) => SUPPORTING_FILES[name]));
  for (const file of new Set(files))
    sha256[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  return {
    commit: await gitCommand("rev-parse", "HEAD"),
    dirty: (await gitCommand("status", "--porcelain")).length > 0,
    sha256,
  };
}

export async function runPreflight({
  selected = ["rpc", "keeper", "api"],
  runner = runCommand,
  evidenceReader = readEvidence,
} = {}) {
  requireValid(
    selected.length > 0 &&
      new Set(selected).size === selected.length &&
      selected.every((name) => Object.prototype.hasOwnProperty.call(TASKS, name))
  );
  const startedAt = new Date().toISOString();
  const source = await evidenceReader(selected);
  const results = [];
  for (const [name, task] of Object.entries(TASKS)) {
    if (!selected.includes(name)) {
      results.push({ name, status: "not-run", code: "not-selected" });
      continue;
    }
    const start = Date.now();
    let report;
    try {
      report = interpretResult(name, await runner(task));
    } catch {
      report = { status: "failed", code: "execution-error" };
    }
    results.push({ name, ...report, durationMs: Date.now() - start });
  }
  return {
    schemaVersion: 1,
    scope: "local-read-only-infrastructure",
    startedAt,
    finishedAt: new Date().toISOString(),
    selected,
    source,
    ...summarize(results),
    results,
  };
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args,
      options: { checks: { type: "string", default: "rpc,keeper,api" }, help: { type: "boolean", short: "h" } },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn agent:preflight [--checks rpc,keeper,api,wallet]\nDefault: rpc,keeper,api. Wallet reads require explicit selection. Start required services separately. No signing or sending. Exit: 0 passed, 1 failed, 2 blocked, 3 configuration/internal error.\n"
      );
      return 0;
    }
    const report = await runPreflight({ selected: values.checks.split(",") });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.exitCode;
  } catch {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "configuration-or-evidence-error", message: "Check selected checks, repository checkout and installed dependencies. Use --help." })}\n`
    );
    return 3;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
