import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { open, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { runTestProcess } from "./lib/agent-test-process.mjs";
import { control } from "./solana-dev.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);

export async function checkWorkspace({ projectDir, apiDir, webPort, apiPort, inspectPort }) {
  const output = path.join(ROOT, ".local/acceptance/solana-dev");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "check-"));
  const report = {
    schemaVersion: 1,
    status: "failed",
    scope: "managed-full-stack-sample-probe",
    startedAt: new Date().toISOString(),
    projectDir,
    apiDir,
    reportFile: path.join(runDir, "report.json"),
    steps: {},
    startupLogFile: path.join(runDir, "startup.log"),
    businessAcceptance: "not-run",
  };
  let workspace;
  let stage = "workspace-availability";
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  const probe = async (name, script, args) => {
    stage = name;
    assert.ok(!interrupted, "Workspace check interrupted.");
    const logFile = path.join(runDir, `${name}.log`);
    const log = await open(logFile, "wx", 0o600);
    const step = (report.steps[name] = { logFile });
    try {
      step.exit = await runTestProcess({
        args: [path.join(ROOT, "scripts", script), ...args],
        cwd: ROOT,
        env: { PATH: process.env.PATH },
        logFd: log.fd,
        timeoutMs: 120000,
        stopGraceMs: 15000,
      });
    } finally {
      await log.close();
    }
    assert.ok(
      !interrupted && !step.exit.interrupted && !step.exit.timedOut,
      "Workspace check interrupted or timed out."
    );
    assert.equal(step.exit.cleanup, "passed", "Probe process cleanup failed.");
    assert.equal(step.exit.code, 0, "Probe failed; inspect its log.");
    assert.ok(!step.exit.signal, "Probe terminated by signal.");
    step.result = JSON.parse(await readFile(logFile, "utf8"));
    assert.equal(step.result.status, "passed");
    return step.result;
  };
  try {
    let existing;
    try {
      existing = await control("status", projectDir);
    } catch (error) {
      if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) throw error;
    }
    assert.ok(!existing, "A workspace already exists for this frontend; use another checkout or stop it explicitly.");
    stage = "startup";
    assert.ok(!interrupted, "Workspace check interrupted.");
    // Let the bounded launcher finish during cancellation so ownership is known before cleanup.
    try {
      const { stdout, stderr } = await execute(
        process.execPath,
        [
          path.join(ROOT, "scripts/solana-dev.mjs"),
          "up",
          "--project-dir",
          projectDir,
          "--api-dir",
          apiDir,
          "--web-port",
          String(webPort),
          "--api-port",
          String(apiPort),
          ...(inspectPort ? ["--api-inspect-port", String(inspectPort)] : []),
        ],
        { cwd: ROOT, env: { PATH: process.env.PATH }, timeout: 90000, maxBuffer: 2 ** 22 }
      );
      await writeFile(report.startupLogFile, stdout + stderr, { mode: 0o600 });
      workspace = JSON.parse(stdout);
    } catch (error) {
      await writeFile(report.startupLogFile, `${error.stdout ?? ""}${error.stderr ?? ""}`, { mode: 0o600 });
      throw error;
    }
    report.workspace = workspace;
    assert.equal(workspace.status, "ready");
    const browser = await probe("browser", "solana-dev-browser.mjs", [
      "--project-dir",
      projectDir,
      "--web-port",
      String(webPort),
    ]);
    assert.equal(browser.projectDir, projectDir);
    assert.equal(browser.apiDir, apiDir);
    if (inspectPort) {
      const debug = await probe("debug", "solana-api-debug.mjs", [
        "--api-dir",
        apiDir,
        "--port",
        String(apiPort),
        "--attach",
      ]);
      assert.equal(debug.apiDir, apiDir);
      assert.equal(debug.sourceBefore.commit, browser.apiSource.commit, "API commit changed between probes.");
      assert.deepEqual(debug.sourceBefore.sha256, browser.apiSource.sha256, "API inputs changed between probes.");
    }
    stage = "final-health";
    const current = await control("status", projectDir);
    assert.equal(current.supervisorPid, workspace.supervisorPid, "Workspace ownership changed.");
    assert.equal(current.status, "ready");
    assert.ok(!interrupted, "Workspace check interrupted.");
    report.status = "passed";
  } catch (error) {
    report.failureStage = stage;
    report.error = { name: error.name, message: error.message.split("\n")[0].slice(0, 240) };
  } finally {
    if (workspace) {
      try {
        const current = await control("status", projectDir);
        assert.equal(
          current.supervisorPid,
          workspace.supervisorPid,
          "Workspace ownership changed; refusing to stop it."
        );
        report.stop = await control("stop", projectDir);
        assert.equal(report.stop.cleanup, "passed");
        report.cleanup = "passed";
      } catch (error) {
        report.cleanup = "failed";
        report.cleanupError = error.message.split("\n")[0].slice(0, 240);
        report.status = "failed";
      }
    } else report.cleanup = "not-started";
    if (interrupted) {
      report.interrupted = true;
      report.status = "failed";
    }
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    report.finishedAt = new Date().toISOString();
    await writeFile(report.reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  return report;
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        "project-dir": { type: "string", default: ROOT },
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        "web-port": { type: "string", default: "3026" },
        "api-port": { type: "string", default: "3024" },
        "api-inspect-port": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:dev:check [--project-dir PATH --api-dir PATH] [--web-port 3026 --api-port 3024] [--api-inspect-port PORT]\nStarts a new workspace, runs the existing Chrome sample proxy probe and optional API source debugger, then stops only its workspace. Existing workspaces are rejected; borrowed APIs are preserved. No business-page acceptance, installation or build.\n"
      );
      return 0;
    }
    for (const key of ["web-port", "api-port", "api-inspect-port"])
      if (values[key] !== undefined)
        assert.ok(
          /^\d+$/.test(values[key]) && Number(values[key]) > 0 && Number(values[key]) <= 65535,
          "Invalid port."
        );
    const report = await checkWorkspace({
      projectDir: await realpath(values["project-dir"]),
      apiDir: await realpath(values["api-dir"]),
      webPort: Number(values["web-port"]),
      apiPort: Number(values["api-port"]),
      inspectPort: values["api-inspect-port"] === undefined ? undefined : Number(values["api-inspect-port"]),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", message: error.message.split("\n")[0].slice(0, 240) })}\n`
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
