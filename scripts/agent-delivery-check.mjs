import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { frontendToolHashes, resolveSuites, sourceEvidence } from "./frontend-offline-tests.mjs";
import { passedResults } from "./sdk-offline-tests.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const exec = promisify(execFile);

async function git(cwd, args) {
  try {
    const { stdout } = await exec("git", ["--no-pager", "-c", "diff.autoRefreshIndex=false", ...args], {
      cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      timeout: 30000,
      maxBuffer: 32_000_000,
    });
    return stdout;
  } catch (error) {
    throw new Error(`git ${args[0]} failed (${error.code}): ${(error.stderr ?? error.message).trim()}`);
  }
}

export function validateFrontendEvidence({ evidence, source, projectDir, head, toolSha256, results, suites }) {
  assert.equal(evidence.schemaVersion, 1, "Unsupported frontend report schema");
  assert.equal(evidence.mode, "frontend-source-offline", "Expected a frontend offline report");
  assert.equal(evidence.status, "passed", "Frontend report did not pass");
  assert.equal(evidence.projectDir, projectDir, "Frontend report targets another checkout");
  assert.equal(source.commit, head, "Current checkout does not match delivery head");
  assert.equal(source.dirty, false, "Current checkout is dirty");
  assert.equal(evidence.sourceUnchanged, true, "Tested source changed during execution");
  assert.deepEqual(evidence.sourceBefore, source, "Tested source does not match current checkout");
  assert.deepEqual(evidence.sourceAfter, source, "Final tested source does not match current checkout");
  assert.deepEqual(evidence.toolSha256, toolSha256, "Frontend tools changed since testing");
  assert.ok(
    !evidence.exit.interrupted && !evidence.exit.timedOut && !evidence.exit.signalError,
    "Test execution was interrupted or failed"
  );
  assert.equal(evidence.exit.cleanup, "passed", "Test process cleanup did not pass");
  assert.equal(evidence.temporaryDirectoryCleanup, "passed", "Temporary directory cleanup did not pass");
  assert.equal(results.numFailedTests, 0, "Native test results contain failures");
  assert.ok(passedResults(results, suites, evidence.exit), "Native test results do not match selected suites");
  assert.deepEqual(
    evidence.counts,
    {
      passed: results.numPassedTests,
      failed: results.numFailedTests,
      skipped: results.numPendingTests,
      total: results.numTotalTests,
      files: results.testResults.length,
    },
    "Report counts do not match native test results"
  );
}

export async function checkDelivery({
  cwd = ROOT,
  base = "origin/release",
  developmentBase = "solana-integration",
  head,
  allowPaths,
  expectedBase,
  requireClean = false,
  frontendReport,
}) {
  assert.ok(
    frontendReport === undefined || (typeof frontendReport === "string" && frontendReport.length > 0),
    "Use a nonempty frontend report path"
  );
  assert.ok(frontendReport === undefined || requireClean, "--frontend-report requires --require-clean");
  assert.ok(typeof head === "string" && head.length > 0, "An explicit --head ref is required");
  assert.ok(Array.isArray(allowPaths) && allowPaths.length > 0, "At least one explicit --allow-path is required");
  for (const file of allowPaths) {
    assert.ok(
      file &&
        !file.includes("\0") &&
        !file.includes("\\") &&
        !/[?*[\]]/.test(file) &&
        !path.posix.isAbsolute(file) &&
        path.posix.normalize(file) === file &&
        !file.split("/").includes("..") &&
        !file.endsWith("/"),
      `Expected an exact repository-relative file path: ${file}`
    );
  }
  assert.equal(new Set(allowPaths).size, allowPaths.length, "Duplicate allowed paths");
  cwd = await realpath(cwd);
  const gitRoot = (await git(cwd, ["rev-parse", "--show-toplevel"])).trim();
  assert.equal(await realpath(gitRoot), cwd, "Select the repository checkout root");
  const resolve = async (ref) =>
    (await git(cwd, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])).trim();
  const baseSha = await resolve(base);
  const developmentSha = await resolve(developmentBase);
  const headSha = await resolve(head);
  const report = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    scope: "committed-delivery-diff",
    projectDir: cwd,
    worktree: { status: "not-checked" },
    frontendEvidence: { status: "not-checked" },
    refs: {
      base: { ref: base, sha: baseSha },
      developmentBase: { ref: developmentBase, sha: developmentSha },
      head: { ref: head, sha: headSha },
    },
    baseFreshness: "not-checked",
    expectedBase: expectedBase ?? null,
    allowPaths,
    findings: [],
  };
  if (expectedBase !== undefined && expectedBase !== baseSha)
    report.findings.push({ code: "base-sha-mismatch", expected: expectedBase, actual: baseSha });
  const mergeBases = (await git(cwd, ["merge-base", "--all", baseSha, headSha])).trim().split("\n");
  if (mergeBases.length !== 1 || mergeBases[0] !== baseSha)
    report.findings.push({ code: "release-not-ancestor", mergeBases });
  const commits = async (tip) => (await git(cwd, ["rev-list", tip, `^${baseSha}`])).trim().split("\n").filter(Boolean);
  const developmentCommits = new Set(await commits(developmentSha));
  const deliveryCommits = await commits(headSha);
  report.deliveryCommits = deliveryCommits;
  const inherited = deliveryCommits.filter((sha) => developmentCommits.has(sha));
  if (inherited.length) report.findings.push({ code: "development-base-history", commits: inherited });

  // Git patch equivalence catches copied commits even when their commit IDs changed.
  const cherry = await git(cwd, ["cherry", developmentSha, headSha, baseSha]);
  const equivalents = cherry
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
  if (equivalents.length) report.findings.push({ code: "development-base-patch", commits: equivalents });
  const paths = (await git(cwd, ["diff", "--no-ext-diff", "--no-renames", "--name-only", "-z", baseSha, headSha, "--"]))
    .split("\0")
    .filter(Boolean);
  report.changedPaths = paths;
  const unexpected = paths.filter((file) => !allowPaths.includes(file));
  if (unexpected.length) report.findings.push({ code: "unexpected-paths", paths: unexpected });
  if (!paths.length) report.findings.push({ code: "empty-delivery" });
  if (requireClean) {
    const entries = (await git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"]))
      .split("\0")
      .filter(Boolean)
      .map((entry) => ({ state: entry.slice(0, 2), path: entry.slice(3) }));
    report.worktree = {
      status: "passed",
      head: await resolve("HEAD"),
      stagedPaths: entries.filter(({ state }) => state !== "??" && state[0] !== " ").map(({ path }) => path),
      unstagedPaths: entries.filter(({ state }) => state !== "??" && state[1] !== " ").map(({ path }) => path),
      untrackedPaths: entries.filter(({ state }) => state === "??").map(({ path }) => path),
    };
    if (report.worktree.head !== headSha) {
      report.worktree.status = "blocked";
      report.findings.push({ code: "worktree-head-mismatch", expected: headSha, actual: report.worktree.head });
    }
    if (
      [report.worktree.stagedPaths, report.worktree.unstagedPaths, report.worktree.untrackedPaths].some(
        (files) => files.length
      )
    ) {
      report.worktree.status = "blocked";
      report.findings.push({ code: "worktree-dirty" });
    }
  }
  if (frontendReport !== undefined) {
    const reportFile = path.resolve(frontendReport);
    let stage = "report";
    report.frontendEvidence = { status: "blocked", reportFile };
    try {
      const evidence = JSON.parse(await readFile(reportFile, "utf8"));
      stage = "native-results";
      const results = JSON.parse(await readFile(evidence.resultsFile, "utf8"));
      stage = "source-and-results";
      const suites = await resolveSuites(cwd, evidence.suites);
      const source = await sourceEvidence(cwd);
      validateFrontendEvidence({
        evidence,
        source,
        projectDir: cwd,
        head: headSha,
        toolSha256: await frontendToolHashes(),
        results,
        suites: suites.map((file) => path.join(cwd, file)),
      });
      report.frontendEvidence = {
        status: "passed",
        reportFile,
        testedCommit: source.commit,
        sourceSha256: source.sourceSha256,
        suites,
        counts: evidence.counts,
      };
    } catch (error) {
      report.findings.push({
        code: "frontend-evidence-invalid",
        stage,
        ...(error.code === "ERR_ASSERTION" ? { message: error.message.split("\n")[0].slice(0, 240) } : {}),
      });
    }
  }
  report.status = report.findings.length ? "blocked" : "passed";
  return report;
}

async function runCli() {
  try {
    const { values } = parseArgs({
      options: {
        "project-dir": { type: "string", default: ROOT },
        "require-clean": { type: "boolean", default: false },
        "frontend-report": { type: "string" },
        base: { type: "string", default: "origin/release" },
        "development-base": { type: "string", default: "solana-integration" },
        head: { type: "string" },
        "allow-path": { type: "string", multiple: true },
        "expected-base": { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn agent:delivery-check --head REF --allow-path FILE [--project-dir PATH] [--require-clean] [--frontend-report PATH] [--allow-path FILE ...] [--base origin/release] [--development-base solana-integration] [--expected-base SHA]\nRead-only committed-history and exact-path isolation check. --require-clean also checks checkout HEAD, index, working files and untracked paths. Does not fetch refs or assess business correctness.\n"
      );
      return;
    }
    const report = await checkDelivery({
      cwd: values["project-dir"],
      requireClean: values["require-clean"],
      frontendReport: values["frontend-report"],
      base: values.base,
      developmentBase: values["development-base"],
      head: values.head,
      allowPaths: values["allow-path"],
      expectedBase: values["expected-base"],
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "passed" ? 0 : 2;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "blocked", error: error.message }, null, 2)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
