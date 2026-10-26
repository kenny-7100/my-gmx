import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { readNetworkAudit } from "./lib/agent-network-audit.mjs";
import { runTestProcess } from "./lib/agent-test-process.mjs";
import { passedResults } from "./sdk-offline-tests.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_SUITES = [
  "src/lib/dates.spec.ts",
  "src/lib/pwa/appUpdateDecision.spec.ts",
  "src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts",
];
const TOOL_FILES = [
  "scripts/frontend-offline-tests.mjs",
  "scripts/lib/agent-test-process.mjs",
  "scripts/lib/agent-network-audit.mjs",
  "scripts/sdk-offline-tests.mjs",
  "tools/frontend-offline/vitest.config.mjs",
  "tools/frontend-offline/setup.mjs",
  "tools/frontend-offline/discovery.mjs",
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

export async function resolveRelated(projectDir, requested) {
  assert.ok(requested.length > 0, "Select at least one related frontend source file.");
  const root = await realpath(projectDir);
  const selected = [];
  for (const file of requested) {
    assert.ok(
      /^(src|landing)\/[a-zA-Z0-9_./-]+\.(json|[jt]sx?)$/.test(file) && path.posix.normalize(file) === file,
      "Use a literal src or landing source path."
    );
    const resolved = await realpath(path.join(root, file));
    assert.equal(resolved, path.join(root, file), "Related source must not traverse symlinks.");
    assert.ok((await stat(resolved)).isFile(), "Select a regular related source file.");
    assert.ok(!selected.includes(file), "Duplicate related source selection.");
    selected.push(file);
  }
  return selected;
}

export async function sourceEvidence(projectDir) {
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
    execFileSync("git", ["-C", projectDir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
  return {
    commit: git("rev-parse", "HEAD"),
    dirty: Boolean(git("status", "--porcelain")),
    sourceSha256: digest.digest("hex"),
    sourceFileCount: files.length,
  };
}

export async function frontendToolHashes() {
  const hashes = {};
  for (const file of [...TOOL_FILES, "yarn.lock"])
    hashes[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  return hashes;
}

export async function runFrontendOffline({ suites, related, inspectPort, projectDir = ROOT }) {
  projectDir = await realpath(projectDir);
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  assert.ok(related === undefined || suites === undefined, "Do not combine --related with --suite.");
  assert.ok(
    related === undefined || inspectPort === undefined,
    "Use --suite for debugging after related test discovery."
  );
  related = related === undefined ? undefined : await resolveRelated(projectDir, related);
  suites = related === undefined ? await resolveSuites(projectDir, suites) : [];

  if (inspectPort !== undefined) {
    assert.ok(
      Number.isInteger(inspectPort) && inspectPort > 0 && inspectPort <= 65535,
      "Use an inspector port from 1 to 65535."
    );
    assert.equal(suites.length, 1, "Debug exactly one frontend suite using --suite.");
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(inspectPort, "127.0.0.1", resolve);
    });
    await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  }
  const runtime = {};
  for (const name of ["vite", "vitest"]) {
    const target = JSON.parse(await readFile(path.join(projectDir, "node_modules", name, "package.json"), "utf8"));
    const tool = JSON.parse(await readFile(path.join(ROOT, "node_modules", name, "package.json"), "utf8"));
    assert.equal(target.version, tool.version, `Target ${name} must match the infrastructure runtime version.`);
    runtime[name] = target.version;
  }
  const gitRoot = execFileSync("git", ["-C", projectDir, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  assert.equal(await realpath(gitRoot), projectDir, "Select the frontend checkout root.");
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
    runtime,
    suites,
    ...(related ? { related } : {}),
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
  let stage = "source-evidence";
  try {
    if (inspectPort !== undefined) {
      report.debug = { inspector: `127.0.0.1:${inspectPort}`, pauseOnStart: true, timeoutMs: 1_800_000 };
      process.stderr.write(`Frontend debug session: ${JSON.stringify({ ...report.debug, logFile, reportFile })}\n`);
    }
    report.sourceBefore = await sourceEvidence(projectDir);
    report.toolSha256 = await frontendToolHashes();
    await symlink(path.join(projectDir, "node_modules"), path.join(emptyDir, "node_modules"), "dir");
    const optionsFile = path.join(emptyDir, "options.json");
    await writeFile(optionsFile, JSON.stringify({ projectDir, suites, emptyDir, resultsFile }), { mode: 0o600 });
    const env = {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      TZ: "UTC",
      CI: "true",
      GMX_AGENT_NETWORK_EVENTS_FILE: path.join(runDir, "network-events.log"),
      GMX_FRONTEND_OFFLINE_OPTIONS: optionsFile,
      LINGUI_CONFIG: path.join(projectDir, ".linguirc"),
      VITE_APP_PWA_GENERATION: `${execFileSync("git", ["-C", projectDir, "show", "-s", "--format=%ct", "HEAD"], { encoding: "utf8" }).trim()}000`,
    };
    if (related) {
      stage = "related-discovery";
      const discovery = {
        status: "failed",
        logFile: path.join(runDir, "discovery.log"),
        filesFile: path.join(runDir, "discovery-files.json"),
      };
      report.discovery = discovery;
      await writeFile(
        optionsFile,
        JSON.stringify({
          projectDir,
          related: related.map((file) => path.join(projectDir, file)),
          emptyDir,
          resultsFile,
        })
      );
      const fd = openSync(discovery.logFile, "wx", 0o600);
      try {
        discovery.exit = await runTestProcess({
          args: [
            "--import",
            path.join(ROOT, "tools/frontend-offline/discovery.mjs"),
            path.join(projectDir, "node_modules/vitest/vitest.mjs"),
            "list",
            "--filesOnly",
            "--json",
            discovery.filesFile,
            "--config",
            path.join(ROOT, "tools/frontend-offline/vitest.config.mjs"),
            "--root",
            projectDir,
          ],
          cwd: emptyDir,
          env: { ...env, GMX_AGENT_NETWORK_EVENTS_FILE: path.join(runDir, "discovery-network-events.log") },
          logFd: fd,
          timeoutMs: 180000,
        });
      } finally {
        closeSync(fd);
      }
      discovery.network = await readNetworkAudit(path.join(runDir, "discovery-network-events.log"), 1);
      assert.ok(
        discovery.exit.code === 0 &&
          !discovery.exit.signal &&
          !discovery.exit.interrupted &&
          !discovery.exit.timedOut &&
          !discovery.exit.signalError &&
          discovery.exit.cleanup === "passed",
        "Related test discovery failed or was interrupted; inspect discovery.log."
      );
      assert.equal(discovery.network.status, "passed", "Related test discovery network audit did not pass.");
      const files = JSON.parse(await readFile(discovery.filesFile, "utf8"));
      assert.ok(Array.isArray(files), "Invalid Vitest discovery result.");
      suites = await resolveSuites(projectDir, files.map(({ file }) => path.relative(projectDir, file)).sort());
      report.suites = suites;
      discovery.status = "passed";
      await writeFile(optionsFile, JSON.stringify({ projectDir, suites, emptyDir, resultsFile }));
    }
    stage = "vitest";
    const fd = openSync(logFile, "wx", 0o600);
    try {
      report.exit = await runTestProcess({
        args: [
          path.join(projectDir, "node_modules/vitest/vitest.mjs"),
          "run",
          "--config",
          path.join(ROOT, "tools/frontend-offline/vitest.config.mjs"),
          "--root",
          projectDir,
          ...(inspectPort === undefined ? [] : [`--inspect-brk=127.0.0.1:${inspectPort}`, "--pool=forks"]),
        ],
        cwd: emptyDir,
        env,
        logFd: fd,
        timeoutMs: report.debug?.timeoutMs ?? 180000,
      });
      report.processGroup = report.exit.processGroup;
    } finally {
      closeSync(fd);
    }
    stage = "results";
    if (report.debug) {
      const log = await readFile(logFile, "utf8");
      report.debug.started =
        log.includes(`Debugger listening on ws://${report.debug.inspector}/`) && !log.includes("Starting inspector on");
      assert.ok(report.debug.started, "Frontend inspector did not start successfully; inspect vitest.log.");
    }
    assert.ok(!report.exit.interrupted && !report.exit.timedOut, "Frontend check interrupted or timed out.");
    assert.ok(report.exit.cleanup === "passed" && !report.exit.signalError, "Frontend test process cleanup failed.");
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
    assert.ok(report.sourceUnchanged, "frontend source changed during the check.");
    stage = "network-audit";
    report.network = await readNetworkAudit(path.join(runDir, "network-events.log"), suites.length);
    assert.equal(report.network.status, "passed", "Offline network audit did not pass; inspect network-events.log.");
    stage = "results";
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
        related: { type: "string", multiple: true },
        "project-dir": { type: "string", default: ROOT },
        "inspect-port": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn frontend:test-offline [--project-dir PATH] [--suite src/...spec.ts ... | --related src/...ts ...] [--inspect-port 9240]\nRuns existing frontend source tests with an empty environment directory and a Node network guard. Defaults to date, PWA decision and Solana flag suites. No build, services or business source changes. Debug mode requires one suite, pauses a single fork on loopback and allows 30 minutes.\n"
      );
      return 0;
    }
    const report = await runFrontendOffline({
      projectDir: values["project-dir"],
      suites: values.suite,
      related: values.related,
      inspectPort:
        values["inspect-port"] === undefined
          ? undefined
          : /^\d+$/.test(values["inspect-port"])
            ? Number(values["inspect-port"])
            : NaN,
    });
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
