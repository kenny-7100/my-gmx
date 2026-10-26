import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { readApiSource } from "./solana-api-local.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SUITES = ["src/domain/gmtrade/marketStatus.test.ts", "src/domain/pairs/solanaPairsRows.test.ts"];
const INPUTS = [
  ...SUITES,
  "src/domain/gmtrade/marketStatus.ts",
  "src/domain/gmtrade/marketAccount.ts",
  "src/domain/gmtrade/__fixtures__/gmtrade-markets-2026-10-06.json",
  "src/domain/pairs/solanaPairsRows.ts",
];

export async function runOfflineTests(apiDir) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  const { evidence } = await readApiSource(apiDir);
  const sourceHashes = {};
  for (const file of INPUTS) {
    sourceHashes[file] = createHash("sha256")
      .update(await readFile(path.join(apiDir, file)))
      .digest("hex");
  }
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
  const fd = openSync(logFile, "wx", 0o600);
  let exit;
  try {
    const child = spawn(
      process.execPath,
      [
        jest,
        "--config",
        JSON.stringify(config),
        "--runInBand",
        "--no-cache",
        "--runTestsByPath",
        ...SUITES.map((file) => path.join(apiDir, file)),
        "--json",
        "--outputFile",
        resultsFile,
      ],
      {
        cwd,
        env: { PATH: process.env.PATH, NODE_ENV: "test", CI: "true", JEST_RETRY_TIMES: "0" },
        stdio: ["ignore", fd, fd],
        timeout: 120000,
        killSignal: "SIGKILL",
      }
    );
    const stop = () => child.kill("SIGTERM");
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    try {
      exit = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
  } finally {
    closeSync(fd);
    await rm(cwd, { recursive: true, force: true });
  }
  let result;
  try {
    result = JSON.parse(await readFile(resultsFile, "utf8"));
  } catch {
    result = undefined;
  }
  const { evidence: after } = await readApiSource(apiDir);
  let unchanged = JSON.stringify(after) === JSON.stringify(evidence);
  for (const file of INPUTS) {
    unchanged =
      unchanged &&
      createHash("sha256")
        .update(await readFile(path.join(apiDir, file)))
        .digest("hex") === sourceHashes[file];
  }
  const passed =
    exit.code === 0 &&
    !exit.signal &&
    result?.success === true &&
    result.numTotalTestSuites === SUITES.length &&
    result.numPassedTestSuites === SUITES.length &&
    result.numPendingTests === 0 &&
    result.numTodoTests === 0 &&
    result.numPassedTests > 0 &&
    result.numPassedTests === result.numTotalTests &&
    unchanged;
  const report = {
    status: passed ? "passed" : "failed",
    mode: "offline-fixtures",
    checkedAt: new Date().toISOString(),
    suites: SUITES,
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
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn gmx-api:test-offline [--api-dir PATH]\nRuns two existing Solana calculation suites without database setup. Network access is forbidden.\n"
      );
      return 0;
    }
    const report = await runOfflineTests(path.resolve(values["api-dir"]));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "offline-test-prerequisite", message: "Check Node 22, API checkout, fixtures and installed Jest/ts-jest. See docs/solana-api-local.md." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
