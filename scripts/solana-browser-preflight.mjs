import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const execute = promisify(execFile);
const CHROME = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/opt/google/chrome/chrome",
};

export async function browserDependency() {
  const manifestPath = require.resolve("@playwright/test/package.json");
  const installed = JSON.parse(await readFile(manifestPath, "utf8"));
  const declared = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")).devDependencies[
    "@playwright/test"
  ];
  require.resolve("@playwright/test");
  if (installed.version !== declared) throw new Error("Playwright version mismatch.");
  return { version: installed.version, cli: path.join(path.dirname(manifestPath), "cli.js") };
}

export async function checkChromeExecutable(file = CHROME[process.platform]) {
  if (!(await stat(file)).isFile()) throw new Error("Expected a browser executable file.");
  await access(file, constants.X_OK);
}

async function runJson(args) {
  const { stdout } = await execute(process.execPath, args, {
    cwd: ROOT,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: process.env,
  });
  return JSON.parse(stdout);
}

export function checkDiscovery(report) {
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) tests.push(...spec.tests);
    for (const child of suite.suites ?? []) walk(child);
  };
  if (report?.config?.metadata?.scope !== "solana-local-read-only-network-smoke")
    throw new Error("Unexpected discovery scope.");
  for (const suite of report.suites) walk(suite);
  if (report.errors?.length || tests.length !== 2 || tests.some((test) => test.results.length !== 0))
    throw new Error("Expected two discovered tests without execution.");
  return {
    count: tests.length,
    target: report.config.metadata.target,
    repository: {
      commit: report.config.metadata.checkoutCommit,
      dirty: report.config.metadata.checkoutDirty,
    },
  };
}

export async function preflight({
  resolveDependency = browserDependency,
  platform = process.platform,
  checkExecutable = checkChromeExecutable,
  readRuntime = () => runJson([require.resolve("tsx/cli"), "scripts/solana-runtime-preflight.mjs", "--local-only"]),
  discover = (cli) => runJson([cli, "test", "-c", "playwright-solana-readonly.config.ts", "--list", "--reporter=json"]),
} = {}) {
  const checks = [];
  let installed;
  let runtime;
  let discovery;
  try {
    installed = await resolveDependency();
    checks.push({ name: "playwright", status: "passed", code: "locked-package-resolved", version: installed.version });
  } catch {
    checks.push({ name: "playwright", status: "blocked", code: "playwright-missing-or-version-mismatch" });
  }
  try {
    if (!CHROME[platform]) throw new Error("Unsupported platform.");
    await checkExecutable(CHROME[platform]);
    checks.push({ name: "chrome", status: "passed", code: "chrome-executable-accessible" });
  } catch {
    checks.push({
      name: "chrome",
      status: "blocked",
      code: CHROME[platform] ? "chrome-unavailable" : "unsupported-platform",
    });
  }
  try {
    runtime = await readRuntime();
    if (runtime.status !== "passed" || runtime.scope !== "local-artifacts" || runtime.chain?.code !== "local-only")
      throw new Error("Unexpected runtime report.");
    checks.push({ name: "sdk", status: "passed", code: "local-runtime-passed" });
  } catch {
    runtime = undefined;
    checks.push({ name: "sdk", status: "blocked", code: "local-runtime-unavailable" });
  }
  if (installed) {
    try {
      discovery = checkDiscovery(await discover(installed.cli));
      checks.push({ name: "discovery", status: "passed", code: "two-tests-discovered", count: discovery.count });
    } catch {
      checks.push({ name: "discovery", status: "failed", code: "test-discovery-failed" });
    }
  } else {
    checks.push({ name: "discovery", status: "not-run", code: "playwright-required" });
  }
  const status = checks.some((item) => item.status === "failed")
    ? "failed"
    : checks.every((item) => item.status === "passed")
      ? "passed"
      : "blocked";
  const sha256 = await browserPreflightHashes();
  return {
    status,
    scope: "solana-browser-prerequisites",
    checkedAt: new Date().toISOString(),
    checks,
    discovery,
    runtime,
    source: { sha256 },
    nodeVersion: process.version,
    browserExecution: "not-run",
    serverReadiness: "not-evaluated",
    requirementAcceptance: "not-evaluated",
  };
}

export async function browserPreflightHashes() {
  const files = [
    "scripts/solana-browser-preflight.mjs",
    "playwright-solana-readonly.config.ts",
    "autotests/regression/solana-read-only/network.spec.ts",
    "autotests/regression/fixtures/browser.ts",
    "src/config/ab.ts",
    "src/config/env.ts",
    "package.json",
    "yarn.lock",
  ];
  const sha256 = {};
  for (const file of files)
    sha256[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  return sha256;
}

export async function runCli({ args = process.argv.slice(2), stdout = process.stdout, runner = preflight } = {}) {
  try {
    const { values } = parseArgs({ args, options: { help: { type: "boolean", short: "h" } } });
    if (values.help) {
      stdout.write(
        "Usage: yarn solana:browser-preflight\nLocal dependencies, Chrome access, SDK fingerprints and test discovery only. No browser, server, wallet or network.\n"
      );
      return 0;
    }
    const report = await runner();
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : report.status === "blocked" ? 2 : 1;
  } catch {
    stdout.write(
      `${JSON.stringify({ status: "failed", scope: "solana-browser-prerequisites", checkedAt: new Date().toISOString(), code: "browser-preflight-failed", browserExecution: "not-run", requirementAcceptance: "not-evaluated" })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
