import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { resolveSuites } from "./gmx-api-integration-tests.mjs";
import { readNetworkAudit } from "./lib/agent-network-audit.mjs";
import { runTestProcess } from "./lib/agent-test-process.mjs";
import { readApiTestSource, sourceInputs } from "./lib/gmx-api-source.mjs";

export { sourceInputs } from "./lib/gmx-api-source.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SUITES = ["src/domain/gmtrade/marketStatus.test.ts", "src/domain/pairs/solanaPairsRows.test.ts"];

export function passedResults(result, suites, exit) {
  const files = result?.testResults ?? [];
  return (
    exit?.code === 0 &&
    !exit.signal &&
    result?.success === true &&
    result.numTotalTestSuites === suites.length &&
    result.numPassedTestSuites === suites.length &&
    result.numPendingTests === 0 &&
    result.numTodoTests === 0 &&
    result.numPassedTests > 0 &&
    result.numPassedTests === result.numTotalTests &&
    Array.isArray(files) &&
    files.length === suites.length &&
    new Set(files.map((file) => file.name)).size === suites.length &&
    suites.every((suite) => files.some((file) => file.name === suite)) &&
    files.every(
      (file) =>
        file.status === "passed" &&
        Array.isArray(file.assertionResults) &&
        file.assertionResults.length > 0 &&
        file.assertionResults.every((assertion) => assertion.status === "passed")
    )
  );
}

export async function runOfflineTests(apiDir, requested = SUITES, { inspectPort } = {}) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  apiDir = await realpath(apiDir);
  const suites = await resolveSuites(apiDir, requested);
  if (inspectPort !== undefined) {
    assert.ok(
      Number.isInteger(inspectPort) && inspectPort > 0 && inspectPort <= 65535,
      "Use an inspector port from 1 to 65535."
    );
    assert.equal(suites.length, 1, "Debug exactly one API suite using --suite.");
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(inspectPort, "127.0.0.1", resolve);
    });
    await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  }
  const evidence = await readApiTestSource(apiDir, suites);
  const sourceBefore = await sourceInputs(apiDir);
  const sourceHashes = Object.fromEntries(suites.map((file) => [file, evidence.sha256[file]]));
  const jest = path.join(apiDir, "node_modules/jest/bin/jest.js");
  const transformer = path.join(apiDir, "node_modules/ts-jest/dist/index.js");
  await access(jest);
  await access(transformer);
  const guard = path.join(ROOT, "tools/gmx-api-offline/network-guard.cjs");
  const config = {
    rootDir: apiDir,
    testEnvironment: "node",
    transform: {
      "^.+\\.tsx?$": [
        transformer,
        {
          tsconfig: {
            ...JSON.parse(await readFile(path.join(apiDir, "tsconfig.json"))).compilerOptions,
            module: "CommonJS",
            moduleResolution: "node",
          },
        },
      ],
    },
    moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
    setupFilesAfterEnv: [guard],
    testTimeout: 10000,
  };
  const outputRoot = path.join(ROOT, ".local/acceptance/solana-api-local");
  await mkdir(outputRoot, { recursive: true });
  const runDir = await mkdtemp(path.join(outputRoot, "offline-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "gmx-api-offline-"));
  const logFile = path.join(runDir, "jest.log");
  const resultsFile = path.join(runDir, "jest-results.json");
  const debug =
    inspectPort === undefined
      ? undefined
      : {
          inspector: `127.0.0.1:${inspectPort}`,
          pauseOnStart: true,
          timeoutMs: 1_800_000,
        };
  if (debug)
    process.stderr.write(
      `API offline debug session: ${JSON.stringify({ ...debug, logFile, reportFile: path.join(runDir, "report.json") })}\n`
    );
  const fd = openSync(logFile, "wx", 0o600);
  let exit;
  try {
    exit = await runTestProcess({
      args: [
        ...(debug ? [`--inspect-brk=${debug.inspector}`] : []),
        jest,
        "--config",
        JSON.stringify(config),
        "--runInBand",
        "--no-cache",
        "--runTestsByPath",
        ...suites.map((file) => path.join(apiDir, file)),
        "--json",
        "--outputFile",
        resultsFile,
      ],
      cwd,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        TZ: "UTC",
        CI: "true",
        JEST_RETRY_TIMES: "0",
        GMX_AGENT_NETWORK_EVENTS_FILE: path.join(runDir, "network-events.log"),
      },
      logFd: fd,
      timeoutMs: debug?.timeoutMs ?? 120000,
    });
  } finally {
    closeSync(fd);
    await rm(cwd, { recursive: true, force: true });
  }
  if (debug) {
    const log = await readFile(logFile, "utf8");
    debug.started =
      log.includes(`Debugger listening on ws://${debug.inspector}/`) && !log.includes("Starting inspector on");
  }
  let result;
  try {
    result = JSON.parse(await readFile(resultsFile, "utf8"));
  } catch {
    result = undefined;
  }
  const after = await readApiTestSource(apiDir, suites);
  const sourceAfter = await sourceInputs(apiDir);
  const unchanged =
    JSON.stringify(after) === JSON.stringify(evidence) && JSON.stringify(sourceAfter) === JSON.stringify(sourceBefore);
  const network = await readNetworkAudit(path.join(runDir, "network-events.log"), suites.length);
  const passed =
    network.status === "passed" &&
    (!debug || debug.started) &&
    !exit.interrupted &&
    !exit.timedOut &&
    exit.cleanup === "passed" &&
    !exit.signalError &&
    passedResults(
      result,
      suites.map((file) => path.join(apiDir, file)),
      exit
    ) &&
    unchanged;
  const report = {
    status: passed ? "passed" : "failed",
    mode: "offline-fixtures",
    network,
    checkedAt: new Date().toISOString(),
    apiDir,
    suites,
    sourceInputs: sourceBefore,
    sourceInputsAfter: sourceAfter,
    source: evidence,
    sourceHashes,
    sourceUnchanged: unchanged,
    guardSha256: createHash("sha256")
      .update(await readFile(guard))
      .digest("hex"),
    counts: {
      suites: result?.numTotalTestSuites,
      passed: result?.numPassedTests,
      failed: result?.numFailedTests,
      skipped: result?.numPendingTests,
    },
    exit,
    ...(debug ? { debug } : {}),
    logFile,
    resultsFile,
    excluded: ["database integration", "HTTP service", "live RPC/keeper/SQD", "wallet signing and transactions"],
  };
  await writeFile(path.join(runDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return report;
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        suite: { type: "string", multiple: true },
        "inspect-port": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn gmx-api:test-offline [--api-dir PATH] [--suite src/...test.ts ...] [--inspect-port 9239]\nRuns exactly selected API source tests without database setup. Defaults to two Solana calculation suites. Network access is forbidden. Debug mode requires one suite, pauses on loopback and allows 30 minutes. See docs/solana-api-local.md.\n"
      );
      return 0;
    }
    const report = await runOfflineTests(path.resolve(values["api-dir"]), values.suite, {
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
      `${JSON.stringify({ status: "failed", code: "offline-test-prerequisite", message: error.message.split("\n")[0].slice(0, 240) })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
