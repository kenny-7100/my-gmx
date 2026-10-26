import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { passedResults } from "./sdk-offline-tests.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_SUITES = [
  "src/lib/dates.spec.ts",
  "src/lib/pwa/appUpdateDecision.spec.ts",
  "src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts",
];
const TOOL_FILES = [
  "scripts/frontend-offline-tests.mjs",
  "scripts/sdk-offline-tests.mjs",
  "tools/frontend-offline/vitest.config.mjs",
  "tools/frontend-offline/setup.mjs",
  "tools/gmx-api-offline/network-guard.cjs",
];

export async function resolveSuites(projectDir, requested = DEFAULT_SUITES) {
  assert.ok(requested.length > 0, "Select at least one frontend test file.");
  const root = await realpath(projectDir);
  const selected = [];
  for (const file of requested) {
    assert.ok(
      /^(src|landing)\/[a-zA-Z0-9_./-]+\.(spec|test)\.[jt]sx?$/.test(file),
      "Use a literal src or landing test path."
    );
    const resolved = await realpath(path.resolve(root, file));
    const relative = path.relative(root, resolved);
    assert.ok(
      relative.startsWith(`src${path.sep}`) || relative.startsWith(`landing${path.sep}`),
      "frontend test must remain inside src or landing."
    );
    assert.ok(/\.(spec|test)\.[jt]sx?$/.test(relative), "Resolved path must be a frontend test file.");
    assert.ok((await stat(resolved)).isFile(), "Select a regular test file.");
    assert.ok(!selected.includes(relative), "Duplicate frontend test selection.");
    selected.push(relative);
  }
  return selected;
}

async function sourceEvidence(projectDir) {
  const files = [
    "package.json",
    "yarn.lock",
    "vite.config.ts",
    ".linguirc",
    "vitest.global-setup.js",
    "tsconfig.json",
    "landing/tsconfig.json",
    "sdk/tsconfig.json",
  ];
  const walk = async (dir) => {
    for (const entry of await readdir(path.join(projectDir, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      assert.ok(!entry.isSymbolicLink(), "frontend source symlinks require explicit review.");
      if (entry.isDirectory()) await walk(relative);
      else if (/\.(ts|tsx|js|jsx|json)$/.test(relative)) files.push(relative);
    }
  };
  await walk("src");
  await walk("landing");
  await walk("sdk/src");
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    digest
      .update(file)
      .update("\0")
      .update(
        createHash("sha256")
          .update(await readFile(path.join(projectDir, file)))
          .digest()
      );
  }
  const git = (...args) =>
    execFileSync("git", ["-C", projectDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return {
    commit: git("rev-parse", "HEAD"),
    dirty: Boolean(git("status", "--porcelain")),
    sourceSha256: digest.digest("hex"),
    sourceFileCount: files.length,
  };
}

export async function runFrontendOffline({ suites }) {
  const projectDir = await realpath(ROOT);
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  suites = await resolveSuites(projectDir, suites);
  const output = path.join(ROOT, ".local/acceptance/frontend-offline");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "run-"));
  const emptyDir = await mkdtemp(path.join(tmpdir(), "gmx-frontend-offline-"));
  const resultsFile = path.join(runDir, "vitest-results.json");
  const logFile = path.join(runDir, "vitest.log");
  const reportFile = path.join(runDir, "report.json");
  const report = {
    schemaVersion: 1,
    status: "failed",
    mode: "frontend-source-offline",
    projectDir,
    suites,
    startedAt: new Date().toISOString(),
    logFile,
    resultsFile,
    reportFile,
    temporaryDirectory: emptyDir,
    excluded: [
      "live services",
      "wallets and transactions",
      "production build compatibility",
      "real browser and live data acceptance",
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
    report.sourceBefore = await sourceEvidence(projectDir);
    report.toolSha256 = {};
    for (const file of [...TOOL_FILES, "yarn.lock"])
      report.toolSha256[file] = createHash("sha256")
        .update(await readFile(path.join(ROOT, file)))
        .digest("hex");
    await symlink(path.join(ROOT, "node_modules"), path.join(emptyDir, "node_modules"), "dir");
    const optionsFile = path.join(emptyDir, "options.json");
    await writeFile(optionsFile, JSON.stringify({ projectDir, suites, emptyDir, resultsFile }), { mode: 0o600 });
    stage = "vitest";
    assert.ok(!interrupted, "frontend check interrupted.");
    const fd = openSync(logFile, "wx", 0o600);
    let timer;
    try {
      child = spawn(
        process.execPath,
        [
          path.join(ROOT, "node_modules/vitest/vitest.mjs"),
          "run",
          "--config",
          path.join(ROOT, "tools/frontend-offline/vitest.config.mjs"),
          "--root",
          projectDir,
        ],
        {
          cwd: emptyDir,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "test",
            TZ: "UTC",
            CI: "true",
            GMX_FRONTEND_OFFLINE_OPTIONS: optionsFile,
            LINGUI_CONFIG: path.join(ROOT, ".linguirc"),
            VITE_APP_PWA_GENERATION: `${execFileSync("git", ["-C", ROOT, "show", "-s", "--format=%ct", "HEAD"], { encoding: "utf8" }).trim()}000`,
          },
          stdio: ["ignore", fd, fd],
          detached: true,
        }
      );
      report.processGroup = child.pid;
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
    report.sourceAfter = await sourceEvidence(projectDir);
    report.sourceUnchanged = report.sourceAfter.sourceSha256 === report.sourceBefore.sourceSha256;
    assert.ok(!interrupted, "frontend check interrupted.");
    assert.ok(report.sourceUnchanged, "frontend source changed during the check.");
    assert.ok(
      passedResults(
        result,
        suites.map((file) => path.join(projectDir, file)),
        report.exit
      ),
      "Selected frontend tests did not all pass; inspect vitest.log and vitest-results.json."
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
        suite: { type: "string", multiple: true },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn frontend:test-offline [--suite src/...spec.ts ...]\nRuns existing frontend source tests with an empty environment directory and a Node network guard. Defaults to date, PWA decision and Solana flag suites. No build, services or business source changes.\n"
      );
      return 0;
    }
    const report = await runFrontendOffline({ suites: values.suite });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "frontend-offline-prerequisite", message: error.message.split("\n")[0].slice(0, 240) })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
