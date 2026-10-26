import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { sourceEvidence } from "./frontend-offline-tests.mjs";
import { browserPreflightHashes, preflight } from "./solana-browser-preflight.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const execute = promisify(execFile);

export async function portAvailable(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export function passedBrowserResults(result, baseUrl, exit) {
  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) tests.push({ spec, test });
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of result?.suites ?? []) walk(suite);
  return (
    exit.code === 0 &&
    !exit.signal &&
    result?.config?.metadata?.scope === "solana-local-read-only-network-smoke" &&
    result.config.metadata.target === baseUrl &&
    !result.errors?.length &&
    tests.length === 2 &&
    result.stats?.expected === 2 &&
    result.stats.unexpected === 0 &&
    result.stats.flaky === 0 &&
    result.stats.skipped === 0 &&
    tests.every(
      ({ spec, test }) =>
        spec.file === "network.spec.ts" &&
        spec.ok === true &&
        test.expectedStatus === "passed" &&
        test.status === "expected" &&
        test.results.length === 1 &&
        test.results[0].status === "passed" &&
        test.results[0].retry === 0 &&
        !test.results[0].errors?.length
    )
  );
}

async function hashes(files) {
  const result = {};
  for (const file of files)
    result[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  return result;
}

export async function browserToolHashes() {
  return {
    ...(await browserPreflightHashes()),
    ...(await hashes([
      "scripts/solana-browser-check.mjs",
      "scripts/frontend-offline-tests.mjs",
      "tools/solana-browser/playwright.config.ts",
      "vite.config.ts",
    ])),
  };
}

export async function browserTarget(projectDir, localRuntime) {
  projectDir = await realpath(projectDir);
  const { stdout } = await execute("git", ["rev-parse", "--show-toplevel"], {
    cwd: projectDir,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  assert.equal(await realpath(stdout.trim()), projectDir, "Select the frontend checkout root.");
  const installed = async (root, name) =>
    JSON.parse(await readFile(path.join(root, "node_modules", name, "package.json"), "utf8"));
  const vite = await installed(projectDir, "vite");
  assert.equal(
    vite.version,
    (await installed(ROOT, "vite")).version,
    "Target Vite must match the infrastructure runtime version."
  );
  const sdk = await installed(projectDir, "@gmsol-labs/gmsol-sdk");
  const manifest = JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8"));
  assert.equal(sdk.version, localRuntime.version, "Target Solana SDK version is incompatible.");
  assert.equal(
    manifest.dependencies["@gmsol-labs/gmsol-sdk"],
    sdk.version,
    "Target Solana SDK is not the declared version."
  );
  const files = [
    "src/config/gmsol/sdk.ts",
    `public/${localRuntime.assetPath}/entry.js`,
    `public/${localRuntime.assetPath}/${localRuntime.wasmAsset}`,
    "node_modules/@gmsol-labs/gmsol-sdk/index_bg.js",
    "node_modules/@gmsol-labs/gmsol-sdk/index_bg.wasm",
  ];
  const assets = {};
  for (const file of files) {
    const bytes = await readFile(path.join(projectDir, file));
    assert.deepEqual(
      bytes,
      await readFile(path.join(ROOT, file)),
      "Target SDK configuration and prepared assets must match the approved infrastructure runtime."
    );
    assets[file] = createHash("sha256").update(bytes).digest("hex");
  }
  return {
    projectDir,
    source: await sourceEvidence(projectDir),
    runtime: {
      vite: vite.version,
      sdk: sdk.version,
      viteExecutable: await realpath(path.join(projectDir, "node_modules/vite/bin/vite.js")),
    },
    assets,
  };
}

export async function checkBrowser(port, { projectDir = ROOT } = {}) {
  const output = path.join(ROOT, ".local/acceptance/solana-browser");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "managed-"));
  const reportFile = path.join(runDir, "report.json");
  const resultsFile = path.join(runDir, "playwright-results.json");
  const logFile = path.join(runDir, "playwright.log");
  const baseUrl = `http://127.0.0.1:${port}`;
  projectDir = await realpath(projectDir);
  const env = {
    ...process.env,
    REGRESSION_BASE_URL: baseUrl,
    AGENT_SOLANA_BROWSER_RUN_DIR: runDir,
    AGENT_SOLANA_BROWSER_PROJECT_DIR: projectDir,
  };
  const report = {
    schemaVersion: 1,
    status: "failed",
    scope: "solana-managed-browser-smoke",
    startedAt: new Date().toISOString(),
    baseUrl,
    projectDir,
    reportFile,
    resultsFile,
    logFile,
    htmlReport: path.join(runDir, "html/index.html"),
    coverage: "Existing network selection UI only; wallets, balances and transactions are not covered.",
  };
  let stage = "preflight";
  let initiallyFree = false;
  let child;
  let interrupted = false;
  const stop = () => {
    interrupted = true;
    // Playwright's test runner handles SIGINT to tear down webServer and browser workers.
    child?.kill("SIGINT");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    const preparation = await preflight({
      discover: async (cli) => {
        const { stdout } = await execute(
          process.execPath,
          [cli, "test", "-c", "playwright-solana-readonly.config.ts", "--list", "--reporter=json"],
          {
            cwd: ROOT,
            env,
            timeout: 30000,
            maxBuffer: 1024 * 1024,
          }
        );
        return JSON.parse(stdout);
      },
    });
    report.preflightFile = path.join(runDir, "preflight.json");
    await writeFile(report.preflightFile, `${JSON.stringify(preparation, null, 2)}\n`, { mode: 0o600 });
    if (preparation.status !== "passed") {
      report.status = preparation.status;
      throw new Error("Browser prerequisites did not pass; inspect preflight.json.");
    }
    stage = "target";
    report.targetBefore = await browserTarget(projectDir, preparation.runtime.local);
    report.sourceBefore = await browserToolHashes();
    stage = "port";
    await portAvailable(port);
    initiallyFree = true;
    stage = "playwright";
    assert.ok(!interrupted, "Browser check interrupted.");
    const cli = path.join(path.dirname(require.resolve("@playwright/test/package.json")), "cli.js");
    const fd = openSync(logFile, "wx", 0o600);
    let timer;
    let forceTimer;
    try {
      child = spawn(process.execPath, [cli, "test", "-c", "tools/solana-browser/playwright.config.ts"], {
        cwd: ROOT,
        env,
        stdio: ["ignore", fd, fd],
      });
      timer = setTimeout(() => {
        interrupted = true;
        child.kill("SIGINT");
        forceTimer = setTimeout(() => child.kill("SIGKILL"), 15000);
      }, 240000);
      report.exit = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });
    } finally {
      clearTimeout(timer);
      clearTimeout(forceTimer);
      closeSync(fd);
    }
    stage = "results";
    const result = JSON.parse(await readFile(resultsFile, "utf8"));
    report.stats = result.stats;
    report.checkout = result.config?.metadata;
    report.sourceAfter = await browserToolHashes();
    report.targetAfter = await browserTarget(projectDir, preparation.runtime.local);
    assert.deepEqual(report.targetAfter, report.targetBefore, "Target checkout changed during the run.");
    assert.equal(
      report.checkout.checkoutCommit,
      report.targetBefore.source.commit,
      "Browser metadata targets another commit."
    );
    assert.equal(
      report.checkout.checkoutDirty,
      report.targetBefore.source.dirty,
      "Browser metadata targets another worktree state."
    );
    assert.deepEqual(report.sourceAfter, report.sourceBefore, "Relevant source changed during the run.");
    assert.ok(!interrupted, "Browser check interrupted.");
    assert.ok(
      passedBrowserResults(result, baseUrl, report.exit),
      "Both expected browser tests must execute and pass without retries; inspect the native report."
    );
    report.status = "passed";
  } catch (error) {
    report.failureStage = stage;
    report.error = { name: error.name, message: error.message.split("\n")[0].slice(0, 240) };
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    if (initiallyFree) {
      try {
        await portAvailable(port);
        report.serviceCleanup = "port-released";
      } catch {
        report.serviceCleanup = "failed-port-still-occupied";
        report.status = "failed";
      }
    } else report.serviceCleanup = "not-started";
    report.finishedAt = new Date().toISOString();
    await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  return report;
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        port: { type: "string", default: "3015" },
        "project-dir": { type: "string", default: ROOT },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:browser-check [--port 3015] [--project-dir PATH]\nPreflights dependencies, starts an owned Vite via Playwright, runs the two existing Chrome network smoke tests, saves independent reports and stops Vite. No builds, wallet injection or business data replacement.\n"
      );
      return 0;
    }
    assert.ok(/^\d+$/.test(values.port) && Number(values.port) > 0 && Number(values.port) <= 65535, "Invalid port.");
    const report = await checkBrowser(Number(values.port), { projectDir: values["project-dir"] });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : report.status === "blocked" ? 2 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: "failed", message: error.message.split("\n")[0] })}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
