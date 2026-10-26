import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { resolveSuites } from "./gmx-api-integration-tests.mjs";
import { readNetworkAudit } from "./lib/agent-network-audit.mjs";
import { runTestProcess } from "./lib/agent-test-process.mjs";
import { apiTestTooling, readApiTestSource, sourceInputs } from "./lib/gmx-api-source.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export async function resolveApiRelated(apiDir, files) {
  assert.ok(Array.isArray(files) && files.length > 0, "Select at least one --related API source file.");
  apiDir = await realpath(apiDir);
  for (const file of files) {
    assert.ok(
      typeof file === "string" &&
        /^src\/[a-zA-Z0-9_./-]+\.(json|[jt]s)$/.test(file) &&
        path.posix.normalize(file) === file,
      "Use a literal src source path relative to the API checkout."
    );
    const resolved = await realpath(path.join(apiDir, file));
    assert.equal(resolved, path.join(apiDir, file), "API related source must not traverse symlinks.");
    assert.ok((await stat(resolved)).isFile(), "Select a regular API source file.");
  }
  assert.equal(new Set(files).size, files.length, "Duplicate API related source selection.");
  return [...files];
}

export async function changedSources(apiDir, baseRef) {
  assert.ok(typeof baseRef === "string" && baseRef.length > 0, "Use a nonempty --changed-since ref.");
  apiDir = await realpath(apiDir);
  const git = (...args) =>
    execFileSync("git", ["--no-pager", "-c", "diff.autoRefreshIndex=false", "-C", apiDir, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
      maxBuffer: 32_000_000,
    });
  assert.equal(await realpath(git("rev-parse", "--show-toplevel").trim()), apiDir, "Select the API checkout root.");
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
  assert.ok(paths.length > 0, "No changed source files; select --related explicitly if tests are needed.");
  const unsupported = paths.filter((file) => !/^src\/[a-zA-Z0-9_./-]+\.(json|[jt]s)$/.test(file));
  assert.equal(
    unsupported.length,
    0,
    `Changed paths require explicit --related selection: ${unsupported.slice(0, 5).join(", ")}`
  );
  let related;
  try {
    related = await resolveApiRelated(apiDir, paths);
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error("Changed source was deleted or is missing; review its impact and select --related explicitly.");
    throw error;
  }
  return { baseRef, baseSha, head, worktreePaths, indexPaths, untrackedPaths, related };
}

async function tooling(apiDir) {
  const result = await apiTestTooling(apiDir, "offline-fixtures");
  for (const file of ["scripts/gmx-api-discover-tests.mjs", "tools/gmx-api-offline/discovery.mjs"])
    result.toolSha256[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  return result;
}

export async function discoverApiTests({ apiDir, related, changedSince }) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  apiDir = await realpath(apiDir);
  assert.ok(related === undefined || changedSince === undefined, "Do not combine --related and --changed-since.");
  const changes = changedSince === undefined ? undefined : await changedSources(apiDir, changedSince);
  related = await resolveApiRelated(apiDir, changes?.related ?? related);
  const sourceBefore = await readApiTestSource(apiDir, ["jest.config.ts"]);
  const sourceInputsBefore = await sourceInputs(apiDir);
  const toolingBefore = await tooling(apiDir);
  const output = path.join(ROOT, ".local/acceptance/solana-api-local");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "discovery-"));
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "gmx-api-discovery-"));
  const report = {
    schemaVersion: 1,
    mode: "api-jest-related-discovery",
    status: "failed",
    apiDir,
    related,
    ...(changes ? { changes } : {}),
    checkedAt: new Date().toISOString(),
    sourceBefore,
    sourceInputsBefore,
    toolingBefore,
    suites: [],
    logFile: path.join(runDir, "discovery.log"),
    resultsFile: path.join(runDir, "discovery-files.json"),
    reportFile: path.join(runDir, "report.json"),
    temporaryDirectory,
  };
  let stage = "jest-discovery";
  try {
    const fd = openSync(report.logFile, "wx", 0o600);
    try {
      report.exit = await runTestProcess({
        args: [
          "--import",
          path.join(ROOT, "tools/gmx-api-offline/discovery.mjs"),
          path.join(apiDir, "node_modules/jest/bin/jest.js"),
          "--config",
          path.join(apiDir, "jest.config.ts"),
          "--findRelatedTests",
          ...related.map((file) => path.join(apiDir, file)),
          "--listTests",
          "--json",
          "--outputFile",
          report.resultsFile,
          "--runInBand",
          "--watchman=false",
          "--no-cache",
          "--cacheDirectory",
          path.join(temporaryDirectory, "jest-cache"),
        ],
        cwd: temporaryDirectory,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          TZ: "UTC",
          CI: "true",
          GMX_AGENT_NETWORK_EVENTS_FILE: path.join(runDir, "network-events.log"),
        },
        logFd: fd,
        timeoutMs: 120000,
      });
    } finally {
      closeSync(fd);
    }
    report.network = await readNetworkAudit(path.join(runDir, "network-events.log"), 1);
    report.sourceAfter = await readApiTestSource(apiDir, ["jest.config.ts"]);
    report.sourceInputsAfter = await sourceInputs(apiDir);
    report.toolingAfter = await tooling(apiDir);
    report.sourceUnchanged =
      JSON.stringify(sourceBefore) === JSON.stringify(report.sourceAfter) &&
      JSON.stringify(sourceInputsBefore) === JSON.stringify(report.sourceInputsAfter);
    report.toolingUnchanged = JSON.stringify(toolingBefore) === JSON.stringify(report.toolingAfter);
    assert.ok(
      report.exit.code === 0 &&
        !report.exit.signal &&
        !report.exit.interrupted &&
        !report.exit.timedOut &&
        !report.exit.signalError &&
        report.exit.cleanup === "passed",
      "Jest discovery failed or was interrupted; inspect discovery.log."
    );
    assert.equal(report.network.status, "passed", "API discovery network audit did not pass.");
    assert.ok(
      report.sourceUnchanged && report.toolingUnchanged,
      "API discovery source or tools changed during execution."
    );
    if (changes) {
      stage = "changed-source-selection";
      report.changesUnchanged = false;
      report.changesAfter = await changedSources(apiDir, changes.baseSha);
      report.changesAfter.baseRef = changes.baseRef;
      report.changesUnchanged = JSON.stringify(changes) === JSON.stringify(report.changesAfter);
      assert.ok(report.changesUnchanged, "API Git change selection changed during discovery; rerun the check.");
    }
    stage = "selected-tests";
    const files = JSON.parse(await readFile(report.resultsFile, "utf8"));
    assert.ok(
      Array.isArray(files) && files.every((file) => typeof file === "string" && path.isAbsolute(file)),
      "Invalid native Jest test list."
    );
    assert.ok(files.length > 0, "No related API tests found; select tests explicitly after reviewing coverage.");
    report.suites = await resolveSuites(apiDir, files.map((file) => path.relative(apiDir, file)).sort());
    report.status = "passed";
  } catch (error) {
    report.failureStage = stage;
    report.error = error.message.split("\n")[0];
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
    report.temporaryDirectoryCleanup = "passed";
    await writeFile(report.reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  return report;
}

async function runCli() {
  try {
    const { values } = parseArgs({
      options: {
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        related: { type: "string", multiple: true },
        "changed-since": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn gmx-api:discover-tests [--related src/...ts ... | --changed-since REF] [--api-dir PATH]\nLists tests using the target Jest configuration and dependency graph. --changed-since pins an API Git base and includes committed, staged, working and untracked source changes; mixed configuration changes require explicit selection. Does not execute tests or database setup. Choose the existing offline or integration runner explicitly after reviewing dependencies.\n"
      );
      return;
    }
    const report = await discoverApiTests({
      apiDir: values["api-dir"],
      related: values.related,
      changedSince: values["changed-since"],
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "blocked", error: error.message.split("\n")[0] })}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
