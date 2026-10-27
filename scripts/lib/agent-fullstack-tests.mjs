import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { toolHashes } from "../agent-test-plan.mjs";
import { resolveRelated, runFrontendOffline, sourceEvidence } from "../frontend-offline-tests.mjs";
import { discoverApiTests, resolveApiRelated } from "../gmx-api-discover-tests.mjs";
import { resolveSuites as resolveApiSuites, runIntegrationTests } from "../gmx-api-integration-tests.mjs";
import { runOfflineTests } from "../gmx-api-offline-tests.mjs";
import { runSdkOffline } from "../sdk-offline-tests.mjs";
import { targetIdentity } from "./agent-target-environment.mjs";
import { apiTestTooling, readApiTestSource, sourceInputs } from "./gmx-api-source.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (actual, expected, message) => assert.ok(isDeepStrictEqual(actual, expected), message);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const SCOPES = ["sdk", "frontend", "api-offline", "api-database"];
const git = (dir, ...args) =>
  execFileSync("git", ["--no-pager", "-c", "diff.autoRefreshIndex=false", "-C", dir, ...args], {
    encoding: "utf8",
    maxBuffer: 32_000_000,
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });

export async function changeSelection(directory, baseRef) {
  assert.ok(typeof baseRef === "string" && baseRef.length, "Select an explicit target Git base.");
  const baseSha = git(directory, "rev-parse", "--verify", "--end-of-options", `${baseRef}^{commit}`).trim();
  const list = (...args) =>
    git(directory, ...args)
      .split("\0")
      .filter(Boolean)
      .sort();
  const diff = ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z"];
  const worktreePaths = list(...diff, baseSha, "--");
  const indexPaths = list(...diff, "--cached", baseSha, "--");
  const untrackedPaths = list("ls-files", "--others", "--exclude-standard", "-z");
  const paths = [...new Set([...worktreePaths, ...indexPaths, ...untrackedPaths])].sort();
  const contents = {};
  for (const file of paths) {
    try {
      const stat = await lstat(path.join(directory, file));
      contents[file] = stat.isFile() ? hash(await readFile(path.join(directory, file))) : "non-regular";
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      contents[file] = "missing";
    }
  }
  return {
    baseRef,
    baseSha,
    head: git(directory, "rev-parse", "HEAD").trim(),
    worktreePaths,
    indexPaths,
    untrackedPaths,
    paths,
    contents,
  };
}

function keys(value, allowed, name) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `Invalid ${name}.`);
  assert.ok(
    Object.keys(value).every((key) => allowed.includes(key)),
    `Unknown ${name} field.`
  );
}

export async function loadTargets(file) {
  file = await realpath(file);
  const bytes = await readFile(file);
  const config = JSON.parse(bytes);
  keys(config, ["frontend", "api"], "targets");
  assert.ok(config.frontend || config.api, "Select at least one repository.");
  for (const name of ["frontend", "api"]) {
    const target = config[name];
    if (target === undefined) continue;
    keys(
      target,
      name === "api" ? ["directory", "base", "related", "profiles", "requireRoutes"] : ["directory", "base", "related"],
      name
    );
    assert.ok(typeof target.directory === "string" && target.directory.length, "Select a target directory.");
    target.directory = await realpath(path.resolve(path.dirname(file), target.directory));
    await targetIdentity(target.directory);
    assert.ok(
      (target.base !== undefined) !== (target.related !== undefined),
      "Select exactly one of base or related per repository."
    );
    if (target.related !== undefined)
      assert.ok(
        Array.isArray(target.related) &&
          target.related.length &&
          new Set(target.related).size === target.related.length,
        "Select unique related source paths."
      );
    if (name === "api") {
      if (target.requireRoutes !== undefined) assert.equal(typeof target.requireRoutes, "boolean");
      if (target.profiles !== undefined) keys(target.profiles, ["offline", "database"], "API profiles");
      const selected = Object.values(target.profiles ?? {}).flat();
      assert.ok(
        Object.values(target.profiles ?? {}).every((value) => Array.isArray(value)),
        "Profiles must contain suite arrays."
      );
      assert.equal(new Set(selected).size, selected.length, "Assign an API suite to exactly one profile.");
      for (const suites of Object.values(target.profiles ?? {}))
        if (suites.length) await resolveApiSuites(target.directory, suites);
    }
  }
  return { file, sha256: hash(bytes), config };
}

async function toolsFor(config) {
  const result = await toolHashes();
  for (const file of [
    "scripts/lib/agent-fullstack-tests.mjs",
    "scripts/lib/agent-target-environment.mjs",
    "scripts/agent-environment.mjs",
    "scripts/agent-test-run.mjs",
    "scripts/gmx-api-discover-tests.mjs",
    "tools/gmx-api-offline/discovery.mjs",
  ])
    result[file] = hash(await readFile(path.join(ROOT, file)));
  if (config.api) {
    for (const mode of ["offline-fixtures", "isolated-postgres-integration"]) {
      const value = await apiTestTooling(config.api.directory, mode);
      Object.assign(result, value.toolSha256);
      result[`runtime:${mode}`] = value.runtime;
    }
  }
  return result;
}

async function snapshot(target, name) {
  const result = { identity: await targetIdentity(target.directory) };
  result.source = name === "frontend" ? await sourceEvidence(target.directory) : await sourceInputs(target.directory);
  if (name === "api") {
    const files = git(
      target.directory,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "migrations",
      "jest.config.ts",
      "jest.setup.ts",
      "jest.setup-global.ts",
      "jest.teardown-global.ts",
      "tsconfig.knex.json",
      "tsoa.json",
      "tsoa-v2.json",
      "knexfile.ts"
    )
      .split("\0")
      .filter(Boolean);
    result.setup = {};
    for (const file of [...new Set(files)].sort()) {
      try {
        result.setup[file] = hash(await readFile(path.join(target.directory, file)));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        result.setup[file] = "missing";
      }
    }
    result.sourceIdentity = await readApiTestSource(target.directory, ["jest.config.ts"]);
  }
  if (target.base !== undefined) result.changes = await changeSelection(target.directory, target.base);
  return result;
}

async function snapshots(config) {
  const result = {};
  for (const [name, target] of Object.entries(config)) result[name] = await snapshot(target, name);
  return result;
}

async function outputDirectory(prefix) {
  const root = path.join(ROOT, ".local/acceptance/fullstack");
  await mkdir(root, { recursive: true });
  return mkdtemp(path.join(root, prefix));
}

export async function planFullstack(targetsFile) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  const targets = await loadTargets(targetsFile);
  const report = {
    schemaVersion: 2,
    mode: "agent-test-plan",
    status: "failed",
    testsExecuted: false,
    targets,
    startedAt: new Date().toISOString(),
    reportFile: path.join(await outputDirectory("plan-"), "report.json"),
    scopes: {},
    uncovered: [],
  };
  report.before = await snapshots(targets.config);
  report.tooling = await toolsFor(targets.config);
  try {
    for (const [name, target] of Object.entries(targets.config)) {
      const selection = report.before[name].changes;
      const candidates = target.related ?? selection.paths;
      const related = [];
      for (const file of candidates) {
        try {
          if (name === "frontend") await resolveRelated(target.directory, [file]);
          else await resolveApiRelated(target.directory, [file]);
          related.push(file);
        } catch {
          report.uncovered.push({
            target: name,
            path: file,
            status: "not-run",
            reason:
              "Unsupported, deleted or non-regular source; select an explicit verification method outside automatic discovery.",
          });
        }
      }
      if (target.related && related.length !== candidates.length)
        throw new Error("Explicit related selection contains invalid source paths.");
      if (!related.length) {
        if (name === "api" && Object.values(target.profiles ?? {}).flat().length)
          report.uncovered.push({
            target: "api",
            status: "not-run",
            reason: "Configured API profiles have no source changes to discover; select related sources explicitly.",
          });
        continue;
      }
      if (name === "frontend") {
        const sdkSources = related.filter((file) => file.startsWith("sdk/src/"));
        if (sdkSources.length) {
          const result = await runSdkOffline({
            sdkDir: path.join(target.directory, "sdk"),
            related: sdkSources.map((file) => file.slice(4)),
            discoverOnly: true,
          });
          report.scopes.sdk = { status: result.status, suites: result.suites, reportFile: result.reportFile };
        }
        const result = await runFrontendOffline({ projectDir: target.directory, related, discoverOnly: true });
        report.scopes.frontend = { status: result.status, suites: result.suites, reportFile: result.reportFile };
      } else {
        const result = await discoverApiTests({ apiDir: target.directory, related });
        report.apiDiscovery = { status: result.status, suites: result.suites, reportFile: result.reportFile };
        for (const profile of ["offline", "database"]) {
          const suites = target.profiles?.[profile] ?? [];
          assert.ok(
            suites.every((suite) => result.suites.includes(suite)),
            "API profile contains a suite outside the discovered scope."
          );
          if (suites.length)
            report.scopes[`api-${profile}`] = { status: result.status, suites, reportFile: result.reportFile };
        }
        for (const suite of result.suites)
          if (
            !Object.values(target.profiles ?? {})
              .flat()
              .includes(suite)
          )
            report.uncovered.push({
              target: "api",
              path: suite,
              status: "not-run",
              reason: "API execution profile must be explicitly selected: offline or database.",
            });
      }
    }
    for (const entry of Object.values(report.scopes)) entry.discoverySha256 = hash(await readFile(entry.reportFile));
    report.after = await snapshots(targets.config);
    same(report.after, report.before, "Target inputs changed during planning.");
    same(await loadTargets(targets.file), targets, "Target configuration changed during planning.");
    same(await toolsFor(targets.config), report.tooling, "Planning tools changed.");
    report.inputsUnchanged = true;
    assert.ok(
      Object.keys(report.scopes).length || report.uncovered.length,
      "No changes or related sources; explicitly select a verification scope."
    );
    assert.ok(
      Object.values(report.scopes).every((scope) => scope.status === "passed") &&
        (!report.apiDiscovery || report.apiDiscovery.status === "passed"),
      "Test discovery failed; inspect original reports."
    );
    report.status = report.uncovered.length ? "partial" : "passed";
  } catch (error) {
    report.error = error.message.split("\n")[0];
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(report.reportFile, json(report), { mode: 0o600 });
  return report;
}

async function verifyFullstackPlan(plan) {
  assert.equal(plan.schemaVersion, 2);
  assert.equal(plan.mode, "agent-test-plan");
  assert.ok(
    ["passed", "partial"].includes(plan.status) && plan.testsExecuted === false && plan.inputsUnchanged === true,
    "Use a valid discovery-only plan."
  );
  const targets = await loadTargets(plan.targets.file);
  same(targets, plan.targets, "Target configuration changed; replan.");
  same(await snapshots(targets.config), plan.before, "Target source, setup or Git range changed; replan.");
  same(plan.after, plan.before, "Final planned inputs differ.");
  same(await toolsFor(targets.config), plan.tooling, "Tools changed; replan.");
  for (const [name, scope] of Object.entries(plan.scopes)) {
    assert.ok(
      SCOPES.includes(name) && scope.status === "passed" && Array.isArray(scope.suites) && scope.suites.length,
      "Invalid planned scope."
    );
    const originalBytes = await readFile(scope.reportFile);
    assert.equal(hash(originalBytes), scope.discoverySha256, "Original discovery report changed.");
    const original = JSON.parse(originalBytes);
    const target = name.startsWith("api-")
      ? targets.config.api.directory
      : name === "sdk"
        ? path.join(targets.config.frontend.directory, "sdk")
        : targets.config.frontend.directory;
    assert.equal(
      original.apiDir ?? original.sdkDir ?? original.projectDir,
      target,
      "Discovery targets another directory."
    );
    assert.equal(original.status, "passed");
    assert.equal(original.mode, name.startsWith("api-") ? "api-jest-related-discovery" : `${name}-source-discovery`);
    if (name.startsWith("api-")) {
      same(original.suites, plan.apiDiscovery.suites, "API discovery changed.");
      same(scope.suites, targets.config.api.profiles[name.slice(4)], "API profile changed.");
      assert.ok(scope.suites.every((suite) => original.suites.includes(suite)));
    } else {
      assert.equal(original.testsExecuted, false);
      same(scope.suites, original.suites, "Original discovery suite list changed.");
    }
  }
}

export async function failureDetails(report) {
  const failures = [];
  if (report.resultsFile) {
    try {
      const native = JSON.parse(await readFile(report.resultsFile));
      for (const suite of native.testResults ?? []) {
        const assertions = (suite.assertionResults ?? []).filter((item) => item.status === "failed");
        for (const assertion of assertions.slice(0, 10))
          failures.push({
            suite: suite.name,
            test: assertion.fullName ?? assertion.title,
            messages: (assertion.failureMessages ?? []).map((message) => message.slice(0, 3000)),
          });
        if (suite.status === "failed" && !assertions.length)
          failures.push({
            suite: suite.name,
            messages: [String(suite.message ?? "Native suite failed; inspect log.").slice(0, 3000)],
          });
        if (failures.length >= 20) break;
      }
    } catch (error) {
      failures.push({ stage: "native-results", code: error.code === "ENOENT" ? "missing" : "unreadable" });
    }
  }
  return {
    stage:
      report.failureStage ??
      report.errorCode ??
      (report.sourceUnchanged === false
        ? "source-identity"
        : report.toolingUnchanged === false
          ? "tooling-identity"
          : report.network?.status === "failed"
            ? "network-audit"
            : report.exit?.timedOut
              ? "timeout"
              : report.exit?.interrupted
                ? "interrupted"
                : report.cleanup === "failed" || report.exit?.cleanup === "failed"
                  ? "cleanup"
                  : "test-execution"),
    failures,
    logFile: report.logFile,
    resultsFile: report.resultsFile,
  };
}

export async function runFullstack({ planFile, scope }) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  planFile = await realpath(planFile);
  const bytes = await readFile(planFile);
  const plan = JSON.parse(bytes);
  const selected = scope === "all" ? SCOPES.filter((name) => plan.scopes?.[name]) : scope?.split(",");
  assert.ok(
    selected?.length &&
      new Set(selected).size === selected.length &&
      selected.every((name) => SCOPES.includes(name) && plan.scopes?.[name]),
    "Select all or explicit existing scopes: sdk,frontend,api-offline,api-database."
  );
  await verifyFullstackPlan(plan);
  const report = {
    schemaVersion: 2,
    mode: "agent-test-run",
    status: "failed",
    testsExecuted: false,
    startedAt: new Date().toISOString(),
    planFile,
    planSha256: hash(bytes),
    reportFile: path.join(await outputDirectory("run-"), "report.json"),
    selected,
    targets: plan.targets,
    scopes: {},
    uncovered: [...plan.uncovered],
  };
  for (const name of Object.keys(plan.scopes))
    if (!selected.includes(name))
      report.uncovered.push({ target: name, status: "not-run", reason: "Scope was not selected for execution." });
  try {
    for (const name of selected) {
      await verifyFullstackPlan(plan);
      assert.equal(hash(await readFile(planFile)), report.planSha256, "Plan file changed during execution.");
      const entry = { status: "failed", suites: plan.scopes[name].suites, testsExecuted: false };
      report.scopes[name] = entry;
      try {
        let result;
        if (name === "frontend")
          result = await runFrontendOffline({
            projectDir: plan.targets.config.frontend.directory,
            suites: entry.suites,
          });
        else if (name === "sdk")
          result = await runSdkOffline({
            sdkDir: path.join(plan.targets.config.frontend.directory, "sdk"),
            suites: entry.suites,
          });
        else if (name === "api-offline")
          result = await runOfflineTests(plan.targets.config.api.directory, entry.suites);
        else
          result = await runIntegrationTests(plan.targets.config.api.directory, entry.suites, {
            requireRoutes: plan.targets.config.api.requireRoutes === true,
          });
        entry.testsExecuted = Boolean(result.exit);
        entry.status = result.status;
        entry.counts = result.counts;
        entry.reportFile = result.reportFile ?? path.join(path.dirname(result.logFile), "report.json");
        entry.reportSha256 = hash(await readFile(entry.reportFile));
        entry.artifacts = {};
        for (const [kind, file] of [
          ["log", result.logFile],
          ["results", result.resultsFile],
          ["network", result.network?.eventsFile],
        ]) {
          if (file) {
            try {
              entry.artifacts[kind] = { file, sha256: hash(await readFile(file)) };
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
              entry.artifacts[kind] = { file, missing: true };
            }
          }
        }
        if (result.status !== "passed") entry.diagnostic = await failureDetails(result);
      } catch (error) {
        entry.status = entry.testsExecuted ? "failed" : "blocked";
        entry.diagnostic = {
          stage: "prerequisite-or-runner",
          code: error.code ?? "runner-unavailable",
          message: error.message.split("\n")[0].slice(0, 500),
        };
      }
      report.testsExecuted = report.testsExecuted || entry.testsExecuted;
    }
    await verifyFullstackPlan(plan);
    assert.equal(hash(await readFile(planFile)), report.planSha256, "Plan file changed during execution.");
    report.inputsUnchanged = true;
    report.status = Object.values(report.scopes).some((entry) => entry.status === "failed")
      ? "failed"
      : Object.values(report.scopes).some((entry) => entry.status === "blocked")
        ? "blocked"
        : report.uncovered.length
          ? "partial"
          : "passed";
  } catch (error) {
    report.error = error.message.split("\n")[0];
    for (const name of selected)
      if (!report.scopes[name])
        report.scopes[name] = { status: "not-run", suites: plan.scopes[name].suites, testsExecuted: false };
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(report.reportFile, json(report), { mode: 0o600 });
  return report;
}
