import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  checkDelivery,
  validateApiEvidence,
  validateApiTypecheckEvidence,
  validateApiRoutes,
  validateBrowserEvidence,
  validateFrontendEvidence,
  validateSdkEvidence,
} from "./agent-delivery-check.mjs";

const exec = promisify(execFile);

test("real Git histories distinguish clean delivery from inherited or copied development changes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "gmx-delivery-"));
  const git = async (...args) => (await exec("git", args, { cwd })).stdout.trim();
  const commit = async (file, content, message) => {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
    await writeFile(path.join(cwd, file), content);
    await git("add", "--", file);
    await git("commit", "-m", message);
    return git("rev-parse", "HEAD");
  };
  try {
    await git("init", "--initial-branch=release");
    await git("config", "user.name", "Delivery Fixture");
    await git("config", "user.email", "delivery-fixture@example.invalid");
    await git("config", "commit.gpgsign", "false");
    await commit("shared.txt", "base\n", "Release base");
    const baseSha = await git("rev-parse", "HEAD");
    await git("checkout", "-b", "development");
    const infrastructure = await commit("tools/local.txt", "personal infrastructure\n", "Personal tools");
    await git("checkout", "-b", "clean", "release");
    await commit("feature with spaces.txt", "feature\n", "Feature delivery");
    const options = {
      cwd,
      base: "release",
      developmentBase: "development",
      head: "clean",
      allowPaths: ["feature with spaces.txt"],
    };
    const clean = await checkDelivery(options);
    assert.equal(clean.status, "passed");
    assert.equal(clean.refs.base.sha, baseSha);
    assert.deepEqual(clean.changedPaths, ["feature with spaces.txt"]);
    assert.equal((await checkDelivery({ ...options, expectedBase: baseSha })).status, "passed");
    const strict = { ...options, requireClean: true };
    assert.equal((await checkDelivery(strict)).worktree.status, "passed");
    assert.equal(clean.worktree.status, "not-checked");
    assert.equal(clean.sdkEvidence.status, "not-checked");
    assert.equal(clean.apiTypecheckEvidence.status, "not-checked");
    await assert.rejects(checkDelivery({ ...options, apiTypecheckReport: "/report.json" }), /requires --require-clean/);
    await writeFile(path.join(cwd, ".git/info/exclude"), "ignored-build/\n");
    await mkdir(path.join(cwd, "ignored-build"));
    await writeFile(path.join(cwd, "ignored-build/output.txt"), "ignored artifact");
    assert.equal((await checkDelivery(strict)).status, "passed");
    const unusual = "untracked space\nand-unicode-文件.txt";
    await writeFile(path.join(cwd, "feature with spaces.txt"), "staged");
    await git("add", "--", "feature with spaces.txt");
    assert.equal((await checkDelivery(strict)).status, "blocked");
    await writeFile(path.join(cwd, unusual), "untracked");
    await writeFile(path.join(cwd, "feature with spaces.txt"), "unstaged");
    await utimes(path.join(cwd, "shared.txt"), new Date(Date.now() + 10000), new Date(Date.now() + 10000));
    const indexBefore = await readFile(path.join(cwd, ".git/index"));
    const dirty = await checkDelivery(strict);
    assert.equal(dirty.status, "blocked");
    assert.deepEqual(dirty.worktree.stagedPaths, ["feature with spaces.txt"]);
    assert.deepEqual(dirty.worktree.unstagedPaths, ["feature with spaces.txt"]);
    assert.deepEqual(dirty.worktree.untrackedPaths, [unusual]);
    assert.deepEqual(await readFile(path.join(cwd, ".git/index")), indexBefore);
    assert.equal(await git("rev-parse", "HEAD"), dirty.refs.head.sha);
    assert.equal(await readFile(path.join(cwd, "feature with spaces.txt"), "utf8"), "unstaged");
    assert.equal(await readFile(path.join(cwd, unusual), "utf8"), "untracked");
    assert.equal((await checkDelivery(options)).status, "passed");
    await git("restore", "--staged", "--", "feature with spaces.txt");
    await rm(path.join(cwd, unusual));
    assert.equal((await checkDelivery(strict)).status, "blocked");
    await git("restore", "--worktree", "--", "feature with spaces.txt");
    await writeFile(path.join(cwd, unusual), "untracked");
    assert.equal((await checkDelivery(strict)).status, "blocked");
    await rm(path.join(cwd, unusual));
    const mismatch = await checkDelivery({ ...strict, head: "release" });
    assert.ok(mismatch.findings.some((finding) => finding.code === "worktree-head-mismatch"));
    const codes = async (overrides) =>
      (await checkDelivery({ ...options, ...overrides })).findings.map((finding) => finding.code);
    assert.ok((await codes({ expectedBase: "0".repeat(40) })).includes("base-sha-mismatch"));
    assert.ok((await codes({ allowPaths: ["other.txt"] })).includes("unexpected-paths"));
    assert.ok((await codes({ head: "release" })).includes("empty-delivery"));
    assert.ok(
      (await codes({ head: "development", allowPaths: ["tools/local.txt"] })).includes("development-base-history")
    );
    await git("cherry-pick", infrastructure);
    const copied = await codes({ allowPaths: ["feature with spaces.txt", "tools/local.txt"] });
    assert.ok(copied.includes("development-base-patch"));
    assert.ok(!copied.includes("development-base-history"));
    await git("checkout", "-b", "merged", "release");
    await git("merge", "--no-ff", "development", "-m", "Incorrectly merge personal base");
    assert.ok((await codes({ head: "merged", allowPaths: ["tools/local.txt"] })).includes("development-base-history"));
    await git("checkout", "release");
    await commit("upstream.txt", "new release\n", "Advance release");
    assert.ok((await codes({ head: "clean" })).includes("release-not-ancestor"));
    await assert.rejects(checkDelivery({ ...options, head: "missing-ref" }));
    for (const allowPaths of [[], ["../outside"], ["/absolute"], ["src/*"], ["a", "a"], ["a/../b"]])
      await assert.rejects(checkDelivery({ ...options, allowPaths }));
    const before = await git("status", "--porcelain");
    const headBefore = await readFile(path.join(cwd, ".git/HEAD"), "utf8");
    await checkDelivery({ ...options, head: "merged" });
    assert.equal(await git("status", "--porcelain"), before);
    assert.equal(await readFile(path.join(cwd, ".git/HEAD"), "utf8"), headBefore);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("offline evidence binds successful native results to clean source, commit, checkout and tools", async () => {
  await assert.rejects(checkDelivery({ frontendReport: "", requireClean: true }), /nonempty frontend report path/);
  await assert.rejects(checkDelivery({ frontendReport: "report.json" }), /requires --require-clean/);
  await assert.rejects(checkDelivery({ sdkReport: "", requireClean: true }), /nonempty SDK report path/);
  await assert.rejects(checkDelivery({ sdkReport: "report.json" }), /requires --require-clean/);
  for (const kind of ["frontend", "sdk"]) {
    const targetField = kind === "sdk" ? "sdkDir" : "projectDir";
    const validate = kind === "sdk" ? validateSdkEvidence : validateFrontendEvidence;
    const runtime = { vitest: "4.1.11", executable: "/target/node_modules/vitest/vitest.mjs" };
    const source = { commit: "a".repeat(40), dirty: false, sourceSha256: "source", sourceFileCount: 1 };
    const results = {
      success: true,
      numPassedTests: 1,
      numFailedTests: 0,
      numTotalTests: 1,
      numPendingTests: 0,
      numTodoTests: 0,
      testResults: [{ name: "/target/src/a.spec.ts", status: "passed", assertionResults: [{ status: "passed" }] }],
    };
    const evidence = {
      schemaVersion: 1,
      mode: `${kind}-source-offline`,
      status: "passed",
      [targetField]: "/target",
      runtime,
      sourceUnchanged: true,
      sourceBefore: source,
      sourceAfter: source,
      toolSha256: { runner: "tool" },
      toolSha256After: { runner: "tool" },
      toolingUnchanged: true,
      exit: { code: 0, signal: null, interrupted: false, timedOut: false, cleanup: "passed" },
      temporaryDirectoryCleanup: "passed",
      network: { status: "passed", installations: 1, blockedAttempts: 0 },
      counts: { passed: 1, failed: 0, skipped: 0, total: 1, files: 1 },
    };
    const options = {
      evidence,
      source,
      [targetField]: "/target",
      runtime,
      head: source.commit,
      toolSha256: evidence.toolSha256,
      results,
      suites: ["/target/src/a.spec.ts"],
    };
    validate(options);
    for (const changed of [
      { evidence: { ...evidence, status: "failed" } },
      { evidence: { ...evidence, [targetField]: "/other" } },
      { head: "b".repeat(40) },
      { source: { ...source, dirty: true } },
      { source: { ...source, sourceSha256: "changed" } },
      { evidence: { ...evidence, sourceUnchanged: false } },
      { evidence: { ...evidence, sourceAfter: { ...source, sourceSha256: "changed" } } },
      { toolSha256: { runner: "changed" } },
      { evidence: { ...evidence, toolingUnchanged: undefined } },
      { evidence: { ...evidence, toolingUnchanged: false } },
      { evidence: { ...evidence, toolSha256After: undefined } },
      { evidence: { ...evidence, toolSha256After: { runner: "changed" } } },
      { evidence: { ...evidence, exit: { ...evidence.exit, interrupted: true } } },
      { evidence: { ...evidence, exit: { ...evidence.exit, cleanup: "failed" } } },
      { evidence: { ...evidence, counts: { ...evidence.counts, passed: 2 } } },
      { evidence: { ...evidence, network: { ...evidence.network, status: "failed" } } },
      { evidence: { ...evidence, network: { ...evidence.network, installations: 0 } } },
      { evidence: { ...evidence, network: { ...evidence.network, blockedAttempts: 1 } } },
      { results: { ...results, success: false } },
      { results: { ...results, numFailedTests: 1 } },
      { suites: ["/target/src/other.spec.ts"] },
    ])
      assert.throws(() => validate({ ...options, ...changed }));
    if (kind === "sdk")
      assert.throws(() => validate({ ...options, runtime: { ...runtime, executable: "/other/vitest.mjs" } }));
  }
});

test("browser evidence binds native executions to the clean delivery target and current tools", async () => {
  await assert.rejects(checkDelivery({ browserReport: "", requireClean: true }), /nonempty browser report path/);
  await assert.rejects(checkDelivery({ browserReport: "report.json" }), /requires --require-clean/);
  const projectDir = "/target",
    head = "a".repeat(40);
  const target = {
    projectDir,
    source: { commit: head, dirty: false, sourceSha256: "source" },
    runtime: { vite: "6.4.3" },
    assets: { wasm: "approved" },
  };
  const metadata = {
    scope: "solana-local-read-only-network-smoke",
    target: "http://127.0.0.1:3016",
    projectDir,
    checkoutCommit: head,
    checkoutDirty: false,
  };
  const entry = { expectedStatus: "passed", status: "expected", results: [{ status: "passed", retry: 0, errors: [] }] };
  const results = {
    config: { metadata },
    errors: [],
    stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [{ specs: [{ file: "network.spec.ts", ok: true, tests: [entry, structuredClone(entry)] }] }],
  };
  const toolSha256 = { runner: "tool" };
  const evidence = {
    schemaVersion: 1,
    scope: "solana-managed-browser-smoke",
    status: "passed",
    projectDir,
    targetBefore: target,
    targetAfter: target,
    sourceBefore: toolSha256,
    sourceAfter: toolSha256,
    serviceCleanup: "port-released",
    baseUrl: metadata.target,
    exit: { code: 0 },
    stats: results.stats,
    checkout: metadata,
  };
  const options = { evidence, target, projectDir, head, toolSha256, results };
  validateBrowserEvidence(options);
  for (const changed of [
    { evidence: { ...evidence, status: "failed" } },
    { evidence: { ...evidence, projectDir: "/other" } },
    { head: "b".repeat(40) },
    { target: { ...target, source: { ...target.source, dirty: true } } },
    { target: { ...target, assets: { wasm: "changed" } } },
    { evidence: { ...evidence, targetAfter: { ...target, runtime: { vite: "changed" } } } },
    { toolSha256: { runner: "changed" } },
    { evidence: { ...evidence, sourceAfter: { runner: "changed" } } },
    { evidence: { ...evidence, serviceCleanup: "failed-port-still-occupied" } },
    { evidence: { ...evidence, baseUrl: "https://example.invalid" } },
    { evidence: { ...evidence, exit: { code: 1 } } },
    { evidence: { ...evidence, stats: { ...results.stats, expected: 3 } } },
    { results: { ...results, errors: [{ message: "Runner failed" }] } },
    { results: { ...results, config: { metadata: { ...metadata, checkoutCommit: "old" } } } },
  ])
    assert.throws(() => validateBrowserEvidence({ ...options, ...changed }));
});

test("API evidence binds both profiles to clean source, tooling, native results and independent network audit", () => {
  for (const mode of ["offline-fixtures", "isolated-postgres-integration"]) {
    const integration = mode === "isolated-postgres-integration";
    const apiDir = "/api";
    const source = { commit: "head", dirty: false, sha256: { "src/one.test.ts": "test" } };
    const inputs = { sha256: "source", fileCount: 4 };
    const tooling = {
      toolSha256: { [`tools/${integration ? "gmx-api-integration" : "gmx-api-offline"}/network-guard.cjs`]: "guard" },
      runtime: { jest: "29", node: "22" },
    };
    const network = { status: "passed", eventsFile: "/events.log", installations: 1, blockedAttempts: 0 };
    const results = {
      success: true,
      numTotalTestSuites: 1,
      numPassedTestSuites: 1,
      numPendingTests: 0,
      numTodoTests: 0,
      numPassedTests: 1,
      numTotalTests: 1,
      numFailedTests: 0,
      testResults: [{ name: "/api/src/one.test.ts", status: "passed", assertionResults: [{ status: "passed" }] }],
    };
    const evidence = {
      schemaVersion: 1,
      status: "passed",
      mode,
      apiDir,
      source,
      sourceAfter: source,
      sourceInputs: inputs,
      sourceInputsAfter: inputs,
      sourceUnchanged: true,
      ...tooling,
      toolingUnchanged: true,
      network: {
        ...network,
        ...(integration ? { policy: "owned-database-and-in-process-servers", guardSha256: "guard" } : {}),
      },
      guardSha256: "guard",
      exit: { code: 0, signal: null, cleanup: "passed" },
      cleanup: "passed",
      temporaryDirectoryCleanup: "passed",
      counts: { suites: 1, passed: 1, failed: 0, skipped: 0 },
    };
    const options = {
      evidence,
      apiDir,
      head: "head",
      source,
      inputs,
      tooling,
      results,
      suites: ["src/one.test.ts"],
      network,
    };
    assert.doesNotThrow(() => validateApiEvidence(options));
    for (const change of [
      { status: "failed" },
      { schemaVersion: 0 },
      { mode: "unknown" },
      { apiDir: "/another-checkout" },
      { source: { ...source, dirty: true } },
      { sourceAfter: { ...source, commit: "other-head" } },
      { sourceInputs: { ...inputs, sha256: "stale" } },
      { sourceInputsAfter: { ...inputs, sha256: "stale" } },
      { sourceUnchanged: false },
      { toolSha256: {} },
      { runtime: { jest: "other" } },
      { toolingUnchanged: false },
      { exit: { ...evidence.exit, interrupted: true } },
      { exit: { ...evidence.exit, cleanup: "failed" } },
      integration ? { cleanup: "failed" } : { temporaryDirectoryCleanup: "failed" },
      { network: { ...evidence.network, installations: 0 } },
      { network: { ...evidence.network, blockedAttempts: 1 } },
      integration ? { network: { ...evidence.network, guardSha256: "other" } } : { guardSha256: "other" },
      { counts: { ...evidence.counts, passed: 2 } },
    ])
      assert.throws(() => validateApiEvidence({ ...options, evidence: { ...evidence, ...change } }));
    assert.throws(() => validateApiEvidence({ ...options, source: { ...source, commit: "later-head" } }));
    assert.throws(() => validateApiEvidence({ ...options, results: { ...results, numFailedTests: 1 } }));
    assert.throws(() => validateApiEvidence({ ...options, network: { ...network, status: "failed" } }));
  }
});

test("delivery rejects incomplete or stale generated route evidence without requiring it for unrelated reports", () => {
  const current = {
    schemaVersion: 2,
    status: "passed",
    apiDir: "/api",
    source: { sha256: "source" },
    tooling: { sha256: "generator" },
    artifacts: { routes: "output" },
  };
  const evidence = {
    mode: "isolated-postgres-integration",
    apiDir: "/api",
    generatedRoutes: { status: "passed", before: current, after: current },
  };
  assert.doesNotThrow(() => validateApiRoutes(evidence, current));
  for (const generatedRoutes of [undefined, { status: "not-checked" }])
    assert.doesNotThrow(() => validateApiRoutes({ ...evidence, generatedRoutes }));
  for (const generatedRoutes of [
    null,
    { status: "failed" },
    { status: "not-checked", before: current },
    { status: "passed", before: current },
    { status: "passed", after: current },
  ])
    assert.throws(() => validateApiRoutes({ ...evidence, generatedRoutes }, current));
  assert.throws(() => validateApiRoutes(evidence));
  for (const change of [{ status: "blocked" }, { source: {} }, { tooling: {} }, { artifacts: {} }]) {
    assert.throws(() => validateApiRoutes(evidence, { ...current, ...change }));
  }
});

test("API typecheck delivery binds clean identity, compiler, logs, route provenance and successful cleanup", () => {
  const source = { commit: "head", dirty: false };
  const inputs = { sha256: "source" };
  const runtime = { typescript: "5.4.2", compilerSha256: "compiler" };
  const routes = {
    schemaVersion: 2,
    status: "passed",
    apiDir: "/api",
    source: inputs,
    tooling: runtime,
    artifacts: { routes: "generated" },
  };
  const log = Buffer.from("");
  const evidence = {
    schemaVersion: 1,
    mode: "api-typescript-no-emit",
    status: "passed",
    apiDir: "/api",
    source,
    sourceAfter: source,
    sourceInputs: inputs,
    sourceInputsAfter: inputs,
    sourceUnchanged: true,
    runtime,
    runtimeAfter: runtime,
    toolingUnchanged: true,
    logSha256: createHash("sha256").update(log).digest("hex"),
    generatedRoutes: { status: "passed", before: routes, after: routes },
    exit: { code: 0, signal: null, cleanup: "passed" },
  };
  const options = { evidence, apiDir: "/api", head: "head", source, inputs, runtime, log, routes };
  assert.doesNotThrow(() => validateApiTypecheckEvidence(options));
  for (const change of [
    { schemaVersion: 0 },
    { mode: "offline-fixtures" },
    { status: "failed" },
    { apiDir: "/other" },
    { source: { ...source, dirty: true } },
    { sourceAfter: { ...source, commit: "old" } },
    { sourceInputs: {} },
    { sourceInputsAfter: {} },
    { sourceUnchanged: false },
    { runtime: {} },
    { runtimeAfter: {} },
    { toolingUnchanged: false },
    { logSha256: undefined },
    { generatedRoutes: undefined },
    { generatedRoutes: { status: "not-checked" } },
    ...[
      { code: 2 },
      { signal: "SIGTERM" },
      { interrupted: true },
      { timedOut: true },
      { signalError: "EPERM" },
      { cleanup: "failed" },
    ].map((exit) => ({ exit: { ...evidence.exit, ...exit } })),
  ])
    assert.throws(() => validateApiTypecheckEvidence({ ...options, evidence: { ...evidence, ...change } }));
  for (const change of [
    { head: "new" },
    { source: { ...source, dirty: true } },
    { inputs: {} },
    { runtime: {} },
    { log: Buffer.from("changed") },
    { routes: { ...routes, artifacts: {} } },
  ])
    assert.throws(() => validateApiTypecheckEvidence({ ...options, ...change }));
});
