import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { changedSources, frontendToolHashes, runFrontendOffline, sourceEvidence } from "./frontend-offline-tests.mjs";
import { runSdkOffline, sdkToolHashes } from "./sdk-offline-tests.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

async function toolHashes() {
  return {
    ...(await frontendToolHashes()),
    ...(await sdkToolHashes()),
    "scripts/agent-test-plan.mjs": createHash("sha256")
      .update(await readFile(fileURLToPath(import.meta.url)))
      .digest("hex"),
  };
}

function executionCommand(script, targetOption, targetDir, suites) {
  return [
    process.execPath,
    path.join(ROOT, "scripts", script),
    targetOption,
    targetDir,
    ...suites.flatMap((file) => ["--suite", file]),
  ];
}

export async function planTests({ projectDir = ROOT, changedSince }) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  projectDir = await realpath(projectDir);
  const changes = await changedSources(projectDir, changedSince);
  const output = path.join(ROOT, ".local/acceptance/frontend-offline");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "test-plan-"));
  const report = {
    schemaVersion: 1,
    mode: "agent-test-plan",
    status: "failed",
    testsExecuted: false,
    projectDir,
    changes,
    startedAt: new Date().toISOString(),
    reportFile: path.join(runDir, "report.json"),
    scopes: {},
  };
  let stage = "source-evidence";
  try {
    report.sourceBefore = await sourceEvidence(projectDir);
    report.toolSha256 = await toolHashes();
    const sdkSources = changes.related.filter((file) => file.startsWith("sdk/src/"));
    stage = "sdk-discovery";
    if (sdkSources.length) {
      const sdkDir = path.join(projectDir, "sdk");
      const related = sdkSources.map((file) => file.slice("sdk/".length));
      const result = await runSdkOffline({ sdkDir, related, discoverOnly: true });
      report.scopes.sdk = {
        status: result.status,
        related,
        suites: result.suites,
        reportFile: result.reportFile,
        ...(result.status === "passed"
          ? { executionCommand: executionCommand("sdk-offline-tests.mjs", "--sdk-dir", sdkDir, result.suites) }
          : {}),
      };
    } else {
      report.scopes.sdk = { status: "not-applicable", reason: "No SDK source changes." };
    }
    stage = "frontend-discovery";
    const result = await runFrontendOffline({ projectDir, related: changes.related, discoverOnly: true });
    report.scopes.frontend = {
      status: result.status,
      related: changes.related,
      suites: result.suites,
      reportFile: result.reportFile,
      ...(result.status === "passed"
        ? {
            executionCommand: executionCommand(
              "frontend-offline-tests.mjs",
              "--project-dir",
              projectDir,
              result.suites
            ),
          }
        : {}),
    };
    stage = "changed-source-selection";
    report.changesAfter = await changedSources(projectDir, changes.baseSha);
    report.changesAfter.baseRef = changes.baseRef;
    report.changesUnchanged = JSON.stringify(changes) === JSON.stringify(report.changesAfter);
    assert.ok(report.changesUnchanged, "Git change selection changed during planning; rerun the plan.");
    stage = "source-evidence";
    report.sourceAfter = await sourceEvidence(projectDir);
    report.sourceUnchanged = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
    assert.ok(report.sourceUnchanged, "Frontend or SDK source changed during planning; rerun the plan.");
    stage = "tooling-evidence";
    report.toolSha256After = await toolHashes();
    report.toolingUnchanged = JSON.stringify(report.toolSha256) === JSON.stringify(report.toolSha256After);
    assert.ok(report.toolingUnchanged, "Test planning tools changed during planning; rerun the plan.");
    stage = "discovery-results";
    assert.ok(
      report.scopes.frontend.status === "passed" && ["passed", "not-applicable"].includes(report.scopes.sdk.status),
      "Required test discovery did not pass; inspect the scope reports and review coverage."
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
      options: {
        "project-dir": { type: "string", default: ROOT },
        "changed-since": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn agent:test-plan [--project-dir PATH] --changed-since REF\nPreviews SDK tests and frontend consumers for source-only changes using the existing discovery runners. Does not execute tests, build or start services. A passing plan is not passing test evidence. Execution commands are argument arrays, not shell strings.\n"
      );
      return;
    }
    const report = await planTests({ projectDir: values["project-dir"], changedSince: values["changed-since"] });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "blocked", error: error.message.split("\n")[0] })}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
