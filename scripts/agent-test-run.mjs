import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { toolHashes } from "./agent-test-plan.mjs";
import { changedSources, resolveSuites, runFrontendOffline, sourceEvidence } from "./frontend-offline-tests.mjs";
import { resolveSuites as resolveSdkSuites, runSdkOffline } from "./sdk-offline-tests.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function verifyPlan(plan) {
  assert.equal(plan.schemaVersion, 1, "Unsupported test plan schema.");
  assert.equal(plan.mode, "agent-test-plan", "Use an agent test plan.");
  assert.equal(plan.status, "passed", "Test plan did not pass.");
  assert.equal(plan.testsExecuted, false, "Expected a discovery-only plan.");
  assert.equal(await realpath(plan.projectDir), plan.projectDir, "Test plan target path changed.");
  for (const key of ["sourceUnchanged", "changesUnchanged", "toolingUnchanged"])
    assert.equal(plan[key], true, `Test plan did not verify ${key}.`);
  const source = await sourceEvidence(plan.projectDir);
  assert.deepEqual(plan.sourceBefore, source, "Source changed since planning; regenerate the plan.");
  assert.deepEqual(plan.sourceAfter, source, "Final planned source does not match the target.");
  const changes = await changedSources(plan.projectDir, plan.changes.baseSha);
  changes.baseRef = plan.changes.baseRef;
  assert.deepEqual(plan.changes, changes, "Git range changed since planning; regenerate the plan.");
  assert.deepEqual(plan.changesAfter, changes, "Final planned Git range does not match the target.");
  const tools = await toolHashes();
  assert.deepEqual(plan.toolSha256, tools, "Planning tools changed; regenerate the plan.");
  assert.deepEqual(plan.toolSha256After, tools, "Final planned tools do not match current tools.");
}

export async function runPlan({ planFile, scope }) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  assert.ok(["sdk", "frontend", "both"].includes(scope), "Select --scope sdk, frontend or both.");
  assert.ok(typeof planFile === "string" && planFile.length > 0, "Provide --plan PATH.");
  planFile = await realpath(planFile);
  const planBytes = await readFile(planFile);
  const plan = JSON.parse(planBytes);
  await verifyPlan(plan);
  const selected = scope === "both" ? ["sdk", "frontend"] : [scope];
  const applicable = selected.filter((name) => plan.scopes[name]?.status !== "not-applicable");
  assert.ok(applicable.length > 0, "Selected scopes have no applicable tests.");
  for (const name of selected) {
    const entry = plan.scopes[name];
    assert.ok(entry && ["passed", "not-applicable"].includes(entry.status), "Selected scope was not discovered.");
    if (entry.status === "not-applicable") {
      assert.equal(name, "sdk", "Frontend discovery is always required.");
      assert.ok(!plan.changes.related.some((file) => file.startsWith("sdk/src/")), "SDK discovery is required.");
      continue;
    }
    const discovery = JSON.parse(await readFile(entry.reportFile, "utf8"));
    assert.equal(discovery.mode, `${name}-source-discovery`, "Expected an original discovery report.");
    assert.equal(discovery.status, "passed", "Original discovery did not pass.");
    assert.equal(discovery.testsExecuted, false, "Expected discovery without execution.");
    assert.equal(
      discovery[name === "sdk" ? "sdkDir" : "projectDir"],
      name === "sdk" ? path.join(plan.projectDir, "sdk") : plan.projectDir,
      "Original discovery targets another checkout."
    );
    assert.deepEqual(entry.suites, discovery.suites, "Planned suites differ from the original discovery.");
    const suites =
      name === "sdk"
        ? await resolveSdkSuites(path.join(plan.projectDir, "sdk"), entry.suites)
        : await resolveSuites(plan.projectDir, entry.suites);
    assert.deepEqual(entry.suites, suites, "Use exact planned test paths.");
  }
  const output = path.join(ROOT, ".local/acceptance/frontend-offline");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "test-run-"));
  const report = {
    schemaVersion: 1,
    mode: "agent-test-run",
    status: "failed",
    projectDir: plan.projectDir,
    planFile,
    planSha256: digest(planBytes),
    scope,
    testsExecuted: false,
    startedAt: new Date().toISOString(),
    reportFile: path.join(runDir, "report.json"),
    scopes: {},
  };
  let stage = "execution";
  try {
    report.runnerSha256 = digest(await readFile(fileURLToPath(import.meta.url)));
    for (const name of selected) {
      if (plan.scopes[name].status === "not-applicable") {
        report.scopes[name] = { status: "not-applicable" };
        continue;
      }
      stage = `${name}-execution`;
      await verifyPlan(plan);
      const suites = plan.scopes[name].suites;
      const result =
        name === "sdk"
          ? await runSdkOffline({ sdkDir: path.join(plan.projectDir, "sdk"), suites })
          : await runFrontendOffline({ projectDir: plan.projectDir, suites });
      report.testsExecuted = report.testsExecuted || result.exit !== undefined;
      report.scopes[name] = {
        status: result.status,
        suites: result.suites,
        counts: result.counts,
        reportFile: result.reportFile,
      };
    }
    stage = "plan-evidence";
    await verifyPlan(plan);
    assert.equal(digest(await readFile(planFile)), report.planSha256, "Test plan file changed during execution.");
    report.planUnchanged = true;
    report.runnerSha256After = digest(await readFile(fileURLToPath(import.meta.url)));
    report.toolingUnchanged = report.runnerSha256 === report.runnerSha256After;
    assert.ok(report.toolingUnchanged, "Test execution runner changed during execution.");
    stage = "execution-results";
    assert.ok(
      applicable.every((name) => report.scopes[name]?.status === "passed"),
      "Selected test scopes did not all pass; inspect the original reports."
    );
    report.status = "passed";
  } catch (error) {
    report.failureStage = stage;
    report.error = error.message.split("\n")[0];
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(report.reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return report;
}

async function runCli() {
  try {
    const { values } = parseArgs({
      options: { plan: { type: "string" }, scope: { type: "string" }, help: { type: "boolean", short: "h" } },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn agent:test-run --plan PATH --scope sdk|frontend|both\nRuns exact planned suites using existing offline runners after checking current source, Git range and tools. Does not execute command text from reports, build or start services. Summary reports are not delivery test evidence; use original scope reports.\n"
      );
      return;
    }
    const report = await runPlan({ planFile: values.plan, scope: values.scope });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "blocked", error: error.message.split("\n")[0] })}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
