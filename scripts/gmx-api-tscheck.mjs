import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { sameGeneratedRoutes, verifyRequiredRoutes } from "./gmx-api-integration-tests.mjs";
import { runTestProcess } from "./lib/agent-test-process.mjs";
import { readApiTestSource } from "./lib/gmx-api-source.mjs";
import { inventory } from "./sdk-artifacts.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function typecheckInputs(apiDir) {
  const files = {};
  for (const dir of ["src", "scripts", "migrations"]) {
    try {
      const entry = await lstat(path.join(apiDir, dir));
      assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), "Use regular API source directories.");
    } catch (error) {
      if (error.code === "ENOENT" && dir !== "src") continue;
      throw error;
    }
    for (const [file, digest] of Object.entries(await inventory(path.join(apiDir, dir))))
      files[`${dir}/${file}`] = digest;
  }
  for (const file of (await readdir(apiDir)).sort())
    if (/\.(json|[cm]?js|ts)$/.test(file) || file === "yarn.lock")
      files[file] = hash(await readFile(path.join(apiDir, file)));
  return { sha256: hash(JSON.stringify(Object.entries(files).sort())), fileCount: Object.keys(files).length };
}

async function tooling(apiDir) {
  const directory = path.join(apiDir, "node_modules/typescript");
  const pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  const compiler = {
    ...(await inventory(path.join(directory, "lib"))),
    ...(await inventory(path.join(directory, "bin"))),
  };
  const scripts = {};
  for (const file of [
    "scripts/gmx-api-tscheck.mjs",
    "scripts/gmx-api-integration-tests.mjs",
    "scripts/lib/gmx-api-source.mjs",
    "scripts/lib/agent-test-process.mjs",
    "scripts/sdk-artifacts.mjs",
  ])
    scripts[file] = hash(await readFile(path.join(ROOT, file)));
  return {
    node: process.version,
    executable: process.execPath,
    typescript: pkg.version,
    compilerDirectory: await realpath(directory),
    compilerSha256: hash(JSON.stringify(compiler)),
    scripts,
  };
}

export async function runTypecheck(apiDir) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  apiDir = await realpath(apiDir);
  const source = await readApiTestSource(apiDir, []);
  const routesBefore = await verifyRequiredRoutes(apiDir);
  const before = await typecheckInputs(apiDir);
  const runtime = await tooling(apiDir);
  const output = path.join(ROOT, ".local/acceptance/gmx-api-tscheck");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "run-"));
  const logFile = path.join(runDir, "tsc.log");
  const fd = openSync(logFile, "wx", 0o600);
  let exit;
  try {
    exit = await runTestProcess({
      args: [
        path.join(apiDir, "node_modules/typescript/bin/tsc"),
        "-p",
        path.join(apiDir, "tsconfig.json"),
        "--noEmit",
        "--incremental",
        "false",
        "--pretty",
        "false",
      ],
      cwd: apiDir,
      env: { PATH: process.env.PATH, TMPDIR: runDir, TZ: "UTC" },
      logFd: fd,
      timeoutMs: 180000,
    });
  } finally {
    closeSync(fd);
  }
  const report = {
    schemaVersion: 1,
    mode: "api-typescript-no-emit",
    status: "failed",
    apiDir,
    checkedAt: new Date().toISOString(),
    source,
    sourceInputs: before,
    runtime,
    generatedRoutes: { status: "failed", before: routesBefore },
    exit,
    logFile,
    reportFile: path.join(runDir, "report.json"),
  };
  try {
    report.sourceAfter = await readApiTestSource(apiDir, []);
    report.sourceInputsAfter = await typecheckInputs(apiDir);
    report.runtimeAfter = await tooling(apiDir);
    report.sourceUnchanged =
      JSON.stringify(source) === JSON.stringify(report.sourceAfter) &&
      JSON.stringify(before) === JSON.stringify(report.sourceInputsAfter);
    report.toolingUnchanged = JSON.stringify(runtime) === JSON.stringify(report.runtimeAfter);
    report.generatedRoutes.after = await verifyRequiredRoutes(apiDir);
    sameGeneratedRoutes(routesBefore, report.generatedRoutes.after);
    report.generatedRoutes.status = "passed";
    if (
      exit.code === 0 &&
      !exit.signal &&
      !exit.interrupted &&
      !exit.timedOut &&
      !exit.signalError &&
      exit.cleanup === "passed" &&
      report.sourceUnchanged &&
      report.toolingUnchanged
    )
      report.status = "passed";
  } catch (error) {
    report.error = error.message.split("\n")[0];
  }
  await writeFile(report.reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return report;
}

async function runCli() {
  try {
    const { values } = parseArgs({
      options: {
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn gmx-api:tscheck [--api-dir PATH]\nRuns the target API TypeScript compiler with no emit or incremental cache. Requires current prepared routes. Does not build, generate or start services.\n"
      );
      return;
    }
    const report = await runTypecheck(values["api-dir"]);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "blocked", error: error.message.split("\n")[0] })}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
