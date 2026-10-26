import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { frontendToolHashes, resolveSuites, sourceEvidence } from "./frontend-offline-tests.mjs";
import { readNetworkAudit } from "./lib/agent-network-audit.mjs";
import {
  passedResults,
  resolveSuites as resolveSdkSuites,
  sdkToolHashes,
  sourceEvidence as sdkSourceEvidence,
  targetRuntime,
} from "./sdk-offline-tests.mjs";
import { browserTarget, browserToolHashes, passedBrowserResults } from "./solana-browser-check.mjs";

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

function validateOfflineEvidence({
  evidence,
  source,
  targetDir,
  targetField,
  mode,
  head,
  toolSha256,
  results,
  suites,
}) {
  assert.equal(evidence.schemaVersion, 1, "Unsupported offline report schema");
  assert.equal(evidence.mode, mode, "Unexpected offline report mode");
  assert.equal(evidence.status, "passed", "Offline report did not pass");
  assert.equal(evidence[targetField], targetDir, "Offline report targets another checkout");
  assert.equal(source.commit, head, "Current checkout does not match delivery head");
  assert.equal(source.dirty, false, "Current checkout is dirty");
  assert.equal(evidence.sourceUnchanged, true, "Tested source changed during execution");
  assert.deepEqual(evidence.sourceBefore, source, "Tested source does not match current checkout");
  assert.deepEqual(evidence.sourceAfter, source, "Final tested source does not match current checkout");
  assert.deepEqual(evidence.toolSha256, toolSha256, "Offline tools changed since testing");
  assert.ok(
    !evidence.exit.interrupted && !evidence.exit.timedOut && !evidence.exit.signalError,
    "Test execution was interrupted or failed"
  );
  assert.equal(evidence.exit.cleanup, "passed", "Test process cleanup did not pass");
  assert.equal(evidence.temporaryDirectoryCleanup, "passed", "Temporary directory cleanup did not pass");
  assert.equal(evidence.network.status, "passed", "Offline network audit did not pass");
  assert.equal(evidence.network.installations, suites.length, "Offline network guard did not cover selected suites");
  assert.equal(evidence.network.blockedAttempts, 0, "Offline tests attempted network access");
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

export function validateFrontendEvidence(options) {
  validateOfflineEvidence({
    ...options,
    targetDir: options.projectDir,
    targetField: "projectDir",
    mode: "frontend-source-offline",
  });
}

export function validateSdkEvidence(options) {
  validateOfflineEvidence({ ...options, targetDir: options.sdkDir, targetField: "sdkDir", mode: "sdk-source-offline" });
  assert.deepEqual(options.evidence.runtime, options.runtime, "SDK runtime changed since testing");
}

export function validateBrowserEvidence({ evidence, target, projectDir, head, toolSha256, results }) {
  assert.equal(evidence.schemaVersion, 1, "Unsupported browser report schema");
  assert.equal(evidence.scope, "solana-managed-browser-smoke", "Expected a managed browser report");
  assert.equal(evidence.status, "passed", "Browser report did not pass");
  assert.equal(evidence.projectDir, projectDir, "Browser report targets another checkout");
  assert.equal(target.projectDir, projectDir, "Current browser target is another checkout");
  assert.equal(target.source.commit, head, "Current browser target does not match delivery head");
  assert.equal(target.source.dirty, false, "Current browser target is dirty");
  assert.deepEqual(evidence.targetBefore, target, "Tested browser target does not match current checkout");
  assert.deepEqual(evidence.targetAfter, target, "Final browser target does not match current checkout");
  assert.deepEqual(evidence.sourceBefore, toolSha256, "Browser tools changed since testing");
  assert.deepEqual(evidence.sourceAfter, toolSha256, "Final browser tools do not match current tools");
  assert.equal(evidence.serviceCleanup, "port-released", "Browser service cleanup did not pass");
  const url = new URL(evidence.baseUrl);
  assert.ok(
    url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    "Expected a local browser target URL"
  );
  assert.ok(passedBrowserResults(results, evidence.baseUrl, evidence.exit), "Native browser results did not pass");
  assert.deepEqual(evidence.stats, results.stats, "Browser statistics do not match native results");
  assert.deepEqual(evidence.checkout, results.config.metadata, "Browser metadata does not match native results");
  assert.equal(results.config.metadata.projectDir, projectDir, "Native browser metadata targets another checkout");
  assert.equal(results.config.metadata.checkoutCommit, head, "Native browser metadata targets another commit");
  assert.equal(results.config.metadata.checkoutDirty, false, "Native browser metadata records a dirty checkout");
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
  sdkReport,
  browserReport,
}) {
  assert.ok(
    frontendReport === undefined || (typeof frontendReport === "string" && frontendReport.length > 0),
    "Use a nonempty frontend report path"
  );
  assert.ok(frontendReport === undefined || requireClean, "--frontend-report requires --require-clean");
  assert.ok(
    sdkReport === undefined || (typeof sdkReport === "string" && sdkReport.length > 0),
    "Use a nonempty SDK report path"
  );
  assert.ok(sdkReport === undefined || requireClean, "--sdk-report requires --require-clean");
  assert.ok(
    browserReport === undefined || (typeof browserReport === "string" && browserReport.length > 0),
    "Use a nonempty browser report path"
  );
  assert.ok(browserReport === undefined || requireClean, "--browser-report requires --require-clean");
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
    sdkEvidence: { status: "not-checked" },
    browserEvidence: { status: "not-checked" },
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
  for (const [kind, evidencePath] of [
    ["frontend", frontendReport],
    ["sdk", sdkReport],
  ]) {
    if (evidencePath === undefined) continue;
    const isSdk = kind === "sdk";
    const key = `${kind}Evidence`;
    const reportFile = path.resolve(evidencePath);
    let stage = "report";
    report[key] = { status: "blocked", reportFile };
    try {
      const evidence = JSON.parse(await readFile(reportFile, "utf8"));
      stage = "native-results";
      const results = JSON.parse(await readFile(evidence.resultsFile, "utf8"));
      stage = "source-and-results";
      const targetDir = isSdk ? path.join(cwd, "sdk") : cwd;
      assert.equal(await realpath(targetDir), targetDir, "Test source must remain in the delivery checkout");
      assert.ok(Array.isArray(evidence.suites) && evidence.suites.length > 0, "Report must list selected suites");
      const suites = await (isSdk ? resolveSdkSuites : resolveSuites)(targetDir, evidence.suites);
      const source = await (isSdk ? sdkSourceEvidence : sourceEvidence)(targetDir);
      stage = "network-audit";
      const network = await readNetworkAudit(evidence.network.eventsFile, suites.length);
      assert.deepEqual(evidence.network, network, "Offline network audit does not match its event log");
      stage = "source-and-results";
      (isSdk ? validateSdkEvidence : validateFrontendEvidence)({
        evidence,
        source,
        projectDir: cwd,
        ...(isSdk ? { sdkDir: targetDir, runtime: await targetRuntime(targetDir) } : {}),
        head: headSha,
        toolSha256: await (isSdk ? sdkToolHashes : frontendToolHashes)(),
        results,
        suites: suites.map((file) => path.join(targetDir, file)),
      });
      report[key] = {
        status: "passed",
        reportFile,
        ...(isSdk ? { sdkDir: targetDir, runtime: evidence.runtime, lockSha256: source.lockSha256 } : {}),
        testedCommit: source.commit,
        sourceSha256: source.sourceSha256,
        suites,
        counts: evidence.counts,
      };
    } catch (error) {
      report.findings.push({
        code: `${kind}-evidence-invalid`,
        stage,
        ...(error.code === "ERR_ASSERTION" ? { message: error.message.split("\n")[0].slice(0, 240) } : {}),
      });
    }
  }
  if (browserReport !== undefined) {
    const reportFile = path.resolve(browserReport);
    let stage = "report";
    report.browserEvidence = { status: "blocked", reportFile };
    try {
      const evidence = JSON.parse(await readFile(reportFile, "utf8"));
      stage = "native-results";
      const results = JSON.parse(await readFile(evidence.resultsFile, "utf8"));
      stage = "preflight";
      const preparation = JSON.parse(await readFile(evidence.preflightFile, "utf8"));
      assert.equal(preparation.status, "passed", "Browser prerequisites did not pass");
      assert.equal(preparation.runtime.scope, "local-artifacts", "Expected local runtime evidence");
      assert.equal(preparation.runtime.chain.code, "local-only", "Expected local-only runtime evidence");
      stage = "source-and-results";
      const target = await browserTarget(cwd, preparation.runtime.local);
      validateBrowserEvidence({
        evidence,
        target,
        projectDir: cwd,
        head: headSha,
        toolSha256: await browserToolHashes(),
        results,
      });
      report.browserEvidence = {
        status: "passed",
        reportFile,
        testedCommit: target.source.commit,
        sourceSha256: target.source.sourceSha256,
        runtime: target.runtime,
        stats: evidence.stats,
      };
    } catch (error) {
      report.findings.push({
        code: "browser-evidence-invalid",
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
        "sdk-report": { type: "string" },
        "browser-report": { type: "string" },
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
        "Usage: yarn agent:delivery-check --head REF --allow-path FILE [--project-dir PATH] [--require-clean] [--frontend-report PATH] [--sdk-report PATH] [--browser-report PATH] [--allow-path FILE ...] [--base origin/release] [--development-base solana-integration] [--expected-base SHA]\nRead-only committed-history and exact-path isolation check. --require-clean also checks checkout HEAD, index, working files and untracked paths. Does not fetch refs or assess business correctness.\n"
      );
      return;
    }
    const report = await checkDelivery({
      cwd: values["project-dir"],
      requireClean: values["require-clean"],
      frontendReport: values["frontend-report"],
      sdkReport: values["sdk-report"],
      browserReport: values["browser-report"],
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
