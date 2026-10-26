import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_SUITES = [
  "src/utils/__tests__/bigmath.spec.ts",
  "src/utils/__tests__/numbers.spec.ts",
  "src/utils/__tests__/fees.spec.ts",
];
const TOOL_FILES = [
  "scripts/sdk-offline-tests.mjs",
  "tools/sdk-offline/vitest.config.mjs",
  "tools/sdk-offline/setup.mjs",
  "tools/gmx-api-offline/network-guard.cjs",
];

export async function resolveSuites(sdkDir, requested = DEFAULT_SUITES) {
  assert.ok(requested.length > 0, "Select at least one SDK test file.");
  const root = await realpath(sdkDir);
  const selected = [];
  for (const file of requested) {
    assert.ok(/^src\/[a-zA-Z0-9_./-]+\.(spec|test)\.tsx?$/.test(file), "Use a literal SDK src test path.");
    const resolved = await realpath(path.resolve(root, file));
    const relative = path.relative(root, resolved);
    assert.ok(relative.startsWith(`src${path.sep}`), "SDK test must remain inside src.");
    assert.ok(/\.(spec|test)\.tsx?$/.test(relative), "Resolved path must be an SDK test file.");
    assert.ok((await stat(resolved)).isFile(), "Select a regular test file.");
    assert.ok(!selected.includes(relative), "Duplicate SDK test selection.");
    selected.push(relative);
  }
  return selected;
}

async function sourceEvidence(sdkDir) {
  const files = ["package.json", "vitest.config.ts", "tsconfig.json"];
  const walk = async (dir) => {
    for (const entry of await readdir(path.join(sdkDir, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      assert.ok(!entry.isSymbolicLink(), "SDK source symlinks require explicit review.");
      if (entry.isDirectory()) await walk(relative);
      else if (/\.(ts|tsx|js|json)$/.test(relative)) files.push(relative);
    }
  };
  await walk("src");
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    digest
      .update(file)
      .update("\0")
      .update(
        createHash("sha256")
          .update(await readFile(path.join(sdkDir, file)))
          .digest()
      );
  }
  const git = (...args) =>
    execFileSync("git", ["-C", sdkDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return {
    commit: git("rev-parse", "HEAD"),
    dirty: Boolean(git("status", "--porcelain")),
    sourceSha256: digest.digest("hex"),
    sourceFileCount: files.length,
  };
}

export function passedResults(result, suites, exit) {
  const files = result?.testResults ?? [];
  return (
    exit.code === 0 &&
    !exit.signal &&
    result?.success === true &&
    result.numPassedTests > 0 &&
    result.numPassedTests === result.numTotalTests &&
    result.numPendingTests === 0 &&
    result.numTodoTests === 0 &&
    files.length === suites.length &&
    files.every(
      (file) =>
        file.status === "passed" &&
        file.assertionResults.length > 0 &&
        file.assertionResults.every((entry) => entry.status === "passed")
    ) &&
    suites.every((suite) => files.some((file) => file.name === suite))
  );
}

export async function runSdkOffline({ sdkDir, suites }) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  sdkDir = await realpath(sdkDir);
  suites = await resolveSuites(sdkDir, suites);
  const output = path.join(ROOT, ".local/acceptance/sdk-offline");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "run-"));
  const emptyDir = await mkdtemp(path.join(tmpdir(), "gmx-sdk-offline-"));
  const resultsFile = path.join(runDir, "vitest-results.json");
  const logFile = path.join(runDir, "vitest.log");
  const reportFile = path.join(runDir, "report.json");
  const report = {
    schemaVersion: 1,
    status: "failed",
    mode: "sdk-source-offline",
    sdkDir,
    suites,
    startedAt: new Date().toISOString(),
    logFile,
    resultsFile,
    reportFile,
    excluded: [
      "live services",
      "wallets and transactions",
      "built SDK package compatibility",
      "Solana protocol math parity",
    ],
  };
  let child;
  let interrupted = false;
  const killGroup = (signal) => {
    if (!child?.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const stop = () => {
    interrupted = true;
    killGroup("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  let stage = "source-evidence";
  try {
    report.sourceBefore = await sourceEvidence(sdkDir);
    report.toolSha256 = {};
    for (const file of [...TOOL_FILES, "yarn.lock"])
      report.toolSha256[file] = createHash("sha256")
        .update(await readFile(path.join(ROOT, file)))
        .digest("hex");
    const optionsFile = path.join(emptyDir, "options.json");
    await writeFile(optionsFile, JSON.stringify({ sdkDir, suites, emptyDir, resultsFile }), { mode: 0o600 });
    stage = "vitest";
    assert.ok(!interrupted, "SDK check interrupted.");
    const fd = openSync(logFile, "wx", 0o600);
    let timer;
    try {
      child = spawn(
        process.execPath,
        [
          path.join(ROOT, "node_modules/vitest/vitest.mjs"),
          "run",
          "--config",
          path.join(ROOT, "tools/sdk-offline/vitest.config.mjs"),
        ],
        {
          cwd: emptyDir,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "test",
            TZ: "UTC",
            CI: "true",
            GMX_SDK_OFFLINE_OPTIONS: optionsFile,
          },
          stdio: ["ignore", fd, fd],
          detached: true,
        }
      );
      timer = setTimeout(() => killGroup("SIGKILL"), 180000);
      report.exit = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });
    } finally {
      clearTimeout(timer);
      killGroup("SIGKILL");
      closeSync(fd);
    }
    stage = "results";
    const result = JSON.parse(await readFile(resultsFile, "utf8"));
    report.counts = {
      passed: result.numPassedTests,
      failed: result.numFailedTests,
      skipped: result.numPendingTests,
      total: result.numTotalTests,
      files: result.testResults?.length,
    };
    report.sourceAfter = await sourceEvidence(sdkDir);
    report.sourceUnchanged = report.sourceAfter.sourceSha256 === report.sourceBefore.sourceSha256;
    assert.ok(!interrupted, "SDK check interrupted.");
    assert.ok(report.sourceUnchanged, "SDK source changed during the check.");
    assert.ok(
      passedResults(
        result,
        suites.map((file) => path.join(sdkDir, file)),
        report.exit
      ),
      "Selected SDK tests did not all pass; inspect vitest.log and vitest-results.json."
    );
    report.status = "passed";
  } catch (error) {
    report.failureStage = stage;
    report.error = { name: error.name, message: error.message.split("\n")[0].slice(0, 240) };
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await rm(emptyDir, { recursive: true, force: true });
    report.temporaryDirectoryCleanup = "passed";
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
        "sdk-dir": { type: "string", default: path.join(ROOT, "sdk") },
        suite: { type: "string", multiple: true },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn sdk:test-offline [--sdk-dir PATH] [--suite src/...spec.ts ...]\nRuns existing SDK source tests with an empty environment directory and a Node network guard. Defaults to BigInt, numbers and fees. No SDK build, services or business source changes.\n"
      );
      return 0;
    }
    const report = await runSdkOffline({ sdkDir: values["sdk-dir"], suites: values.suite });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "sdk-offline-prerequisite", message: error.message.split("\n")[0].slice(0, 240) })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
