import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { readNetworkAudit } from "./lib/agent-network-audit.mjs";
import { runTestProcess } from "./lib/agent-test-process.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_SUITES = [
  "src/utils/__tests__/bigmath.spec.ts",
  "src/utils/__tests__/numbers.spec.ts",
  "src/utils/__tests__/fees.spec.ts",
];
const TOOL_FILES = [
  "scripts/sdk-offline-tests.mjs",
  "scripts/lib/agent-test-process.mjs",
  "scripts/lib/agent-network-audit.mjs",
  "tools/sdk-offline/vitest.config.mjs",
  "tools/sdk-offline/setup.mjs",
  "tools/sdk-offline/discovery.mjs",
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

export async function resolveRelated(sdkDir, requested) {
  assert.ok(requested.length > 0, "Select at least one related SDK source file.");
  const root = await realpath(sdkDir);
  const selected = [];
  for (const file of requested) {
    assert.ok(
      /^src\/[a-zA-Z0-9_./-]+\.(json|tsx?|js)$/.test(file) && path.posix.normalize(file) === file,
      "Use a literal SDK src source path."
    );
    const resolved = await realpath(path.join(root, file));
    assert.equal(resolved, path.join(root, file), "Related source must not traverse symlinks.");
    assert.ok((await stat(resolved)).isFile(), "Select a regular related source file.");
    assert.ok(!selected.includes(file), "Duplicate related source selection.");
    selected.push(file);
  }
  return selected;
}

export async function changedSources(sdkDir, baseRef) {
  assert.ok(typeof baseRef === "string" && baseRef.length > 0, "Use a nonempty --changed-since ref.");
  sdkDir = await realpath(sdkDir);
  let checkoutDir = sdkDir;
  const git = (...args) =>
    execFileSync("git", ["--no-pager", "-c", "diff.autoRefreshIndex=false", "-C", checkoutDir, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
      maxBuffer: 32_000_000,
    });
  checkoutDir = await realpath(git("rev-parse", "--show-toplevel").trim());
  const relativeDir = path.relative(checkoutDir, sdkDir).split(path.sep).join("/");
  const sdkPrefix = relativeDir ? `${relativeDir}/` : "";
  const baseSha = git("rev-parse", "--verify", "--end-of-options", `${baseRef}^{commit}`).trim();
  const head = git("rev-parse", "HEAD").trim();
  const list = (...args) =>
    git(...args)
      .split("\0")
      .filter(Boolean)
      .sort();
  const diff = ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--numstat", "-z"];
  const diffPaths = (...args) =>
    list(...diff, ...args)
      .map((entry) => entry.split("\t").slice(2).join("\t"))
      .sort();
  const worktreePaths = diffPaths(baseSha, "--");
  const indexPaths = diffPaths("--cached", baseSha, "--");
  const untrackedPaths = list("ls-files", "--others", "--exclude-standard", "-z");
  const paths = [...new Set([...worktreePaths, ...indexPaths, ...untrackedPaths])].sort();
  assert.ok(paths.length > 0, "No changed source files; select --suite explicitly if tests are needed.");
  const unsupported = paths.filter(
    (file) =>
      !file.startsWith(sdkPrefix) || !/^src\/[a-zA-Z0-9_./-]+\.(json|tsx?|js)$/.test(file.slice(sdkPrefix.length))
  );
  assert.equal(
    unsupported.length,
    0,
    `Changed paths require explicit --suite selection: ${unsupported.slice(0, 5).join(", ")}`
  );
  let related;
  try {
    related = await resolveRelated(
      sdkDir,
      paths.map((file) => file.slice(sdkPrefix.length))
    );
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error("Changed source was deleted or is missing; review its impact and select --suite explicitly.");
    throw error;
  }
  return { checkoutDir, sdkPrefix, baseRef, baseSha, head, worktreePaths, indexPaths, untrackedPaths, related };
}

export async function sourceEvidence(sdkDir) {
  const files = ["package.json", "yarn.lock", "vitest.config.ts", "tsconfig.json"];
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
    execFileSync("git", ["-C", sdkDir, "-c", "diff.autoRefreshIndex=false", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
  return {
    commit: git("rev-parse", "HEAD"),
    dirty: Boolean(git("status", "--porcelain")),
    sourceSha256: digest.digest("hex"),
    sourceFileCount: files.length,
    lockSha256: createHash("sha256")
      .update(await readFile(path.join(sdkDir, "yarn.lock")))
      .digest("hex"),
  };
}

export async function targetRuntime(sdkDir) {
  const packageFile = path.join(sdkDir, "node_modules/vitest/package.json");
  const target = JSON.parse(await readFile(packageFile, "utf8"));
  const tool = JSON.parse(await readFile(path.join(ROOT, "node_modules/vitest/package.json"), "utf8"));
  assert.equal(target.version, tool.version, "Target Vitest must match the infrastructure runtime version.");
  const executable = await realpath(path.join(sdkDir, "node_modules/vitest/vitest.mjs"));
  return { vitest: target.version, executable };
}

export async function sdkToolHashes() {
  const hashes = {};
  for (const file of [...TOOL_FILES, "yarn.lock"])
    hashes[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  return hashes;
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

export async function runSdkOffline({ sdkDir, suites, related, changedSince, inspectPort }) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  sdkDir = await realpath(sdkDir);
  assert.ok(
    [suites, related, changedSince].filter((value) => value !== undefined).length <= 1,
    "Do not combine --suite, --related and --changed-since."
  );
  assert.ok(changedSince === undefined || inspectPort === undefined, "Use --suite for debugging after Git selection.");
  const changes = changedSince === undefined ? undefined : await changedSources(sdkDir, changedSince);
  if (changes) related = changes.related;
  assert.ok(
    related === undefined || inspectPort === undefined,
    "Use --suite for debugging after related test discovery."
  );
  related = related === undefined ? undefined : await resolveRelated(sdkDir, related);
  suites = related === undefined ? await resolveSuites(sdkDir, suites) : [];
  if (inspectPort !== undefined) {
    assert.ok(
      Number.isInteger(inspectPort) && inspectPort > 0 && inspectPort <= 65535,
      "Use an inspector port from 1 to 65535."
    );
    assert.equal(suites.length, 1, "Debug exactly one SDK suite using --suite.");
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(inspectPort, "127.0.0.1", resolve);
    });
    await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  }
  const runtime = await targetRuntime(sdkDir);
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
    runtime,
    suites,
    ...(related ? { related } : {}),
    ...(changes ? { changes } : {}),
    startedAt: new Date().toISOString(),
    logFile,
    resultsFile,
    reportFile,
    temporaryDirectory: emptyDir,
    excluded: [
      "live services",
      "wallets and transactions",
      "built SDK package compatibility",
      "Solana protocol math parity",
    ],
  };
  let stage = "source-evidence";
  try {
    if (inspectPort !== undefined) {
      report.debug = { inspector: `127.0.0.1:${inspectPort}`, pauseOnStart: true, timeoutMs: 1_800_000 };
      process.stderr.write(`SDK debug session: ${JSON.stringify({ ...report.debug, logFile, reportFile })}\n`);
    }
    report.sourceBefore = await sourceEvidence(sdkDir);
    report.toolSha256 = await sdkToolHashes();
    const optionsFile = path.join(emptyDir, "options.json");
    await writeFile(optionsFile, JSON.stringify({ sdkDir, suites, emptyDir, resultsFile }), { mode: 0o600 });
    const env = {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      TZ: "UTC",
      CI: "true",
      GMX_AGENT_NETWORK_EVENTS_FILE: path.join(runDir, "network-events.log"),
      GMX_SDK_OFFLINE_OPTIONS: optionsFile,
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
          sdkDir,
          related: related.map((file) => path.join(sdkDir, file)),
          emptyDir,
          resultsFile,
        })
      );
      const fd = openSync(discovery.logFile, "wx", 0o600);
      try {
        discovery.exit = await runTestProcess({
          args: [
            "--import",
            path.join(ROOT, "tools/sdk-offline/discovery.mjs"),
            path.join(sdkDir, "node_modules/vitest/vitest.mjs"),
            "list",
            "--filesOnly",
            "--json",
            discovery.filesFile,
            "--config",
            path.join(ROOT, "tools/sdk-offline/vitest.config.mjs"),
            "--root",
            sdkDir,
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
      assert.ok(files.length > 0, "No related SDK tests found; review coverage and select --suite explicitly.");
      suites = await resolveSuites(sdkDir, files.map(({ file }) => path.relative(sdkDir, file)).sort());
      report.suites = suites;
      discovery.status = "passed";
      await writeFile(optionsFile, JSON.stringify({ sdkDir, suites, emptyDir, resultsFile }));
    }
    stage = "vitest";
    const fd = openSync(logFile, "wx", 0o600);
    try {
      report.exit = await runTestProcess({
        args: [
          runtime.executable,
          "run",
          "--config",
          path.join(ROOT, "tools/sdk-offline/vitest.config.mjs"),
          ...(inspectPort === undefined ? [] : [`--inspect-brk=127.0.0.1:${inspectPort}`, "--pool=forks"]),
        ],
        cwd: emptyDir,
        env,
        logFd: fd,
        timeoutMs: report.debug?.timeoutMs ?? 180000,
      });
    } finally {
      closeSync(fd);
    }
    stage = "results";
    if (report.debug) {
      const log = await readFile(logFile, "utf8");
      report.debug.started = log.includes(`Debugger listening on ws://${report.debug.inspector}/`);
      assert.ok(
        report.debug.started && !log.includes("Starting inspector on"),
        "SDK inspector did not start successfully; inspect vitest.log."
      );
    }
    assert.ok(!report.exit.interrupted && !report.exit.timedOut, "SDK check interrupted or timed out.");
    assert.ok(report.exit.cleanup === "passed" && !report.exit.signalError, "SDK test process cleanup failed.");
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
    if (changes) {
      stage = "changed-source-selection";
      report.changesUnchanged = false;
      report.changesAfter = await changedSources(sdkDir, changes.baseSha);
      report.changesAfter.baseRef = changes.baseRef;
      report.changesUnchanged = JSON.stringify(changes) === JSON.stringify(report.changesAfter);
      assert.ok(report.changesUnchanged, "SDK Git change selection changed during testing; rerun the check.");
    }
    stage = "source-evidence";
    assert.ok(report.sourceUnchanged, "SDK source changed during the check.");
    stage = "network-audit";
    report.network = await readNetworkAudit(path.join(runDir, "network-events.log"), suites.length);
    assert.equal(report.network.status, "passed", "Offline network audit did not pass; inspect network-events.log.");
    stage = "results";
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
        related: { type: "string", multiple: true },
        "changed-since": { type: "string" },
        "inspect-port": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn sdk:test-offline [--sdk-dir PATH] [--suite src/...spec.ts ... | --related src/...ts ... | --changed-since REF] [--inspect-port 9238]\nRuns existing SDK source tests using the target SDK's installed Vitest (must match the infrastructure version), an empty environment directory and a Node network guard. Defaults to BigInt, numbers and fees. --related discovers tests from the target dependency graph before exact offline execution; no matches fails. --changed-since pins the target Git base and selects SDK source changes; mixed changes require explicit --suite selection. No SDK build, services or business source changes. Debug mode requires exactly one suite, pauses a single fork on loopback and allows 30 minutes; see the emitted session log path.\n"
      );
      return 0;
    }
    const report = await runSdkOffline({
      sdkDir: values["sdk-dir"],
      suites: values.suite,
      related: values.related,
      changedSince: values["changed-since"],
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
      `${JSON.stringify({ status: "failed", code: "sdk-offline-prerequisite", message: error.message.split("\n")[0].slice(0, 240) })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
