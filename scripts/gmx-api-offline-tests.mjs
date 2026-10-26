import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { resolveSuites } from "./gmx-api-integration-tests.mjs";
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

export async function sourceInputs(apiDir) {
  const files = ["package.json", "yarn.lock", "tsconfig.json"];
  const scan = async (dir) => {
    for (const entry of await readdir(path.join(apiDir, dir), { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "API source symlinks require explicit review.");
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await scan(file);
      else if (/\.(ts|js|json)$/.test(file)) files.push(file);
    }
  };
  await scan("src");
  const digest = createHash("sha256");
  for (const file of files.sort())
    digest
      .update(file)
      .update("\0")
      .update(
        createHash("sha256")
          .update(await readFile(path.join(apiDir, file)))
          .digest()
      );
  return { sha256: digest.digest("hex"), fileCount: files.length };
}

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

export async function runOfflineTests(apiDir, requested = SUITES) {
  assert.equal(process.versions.node.split(".")[0], "22", "Use Node 22.");
  apiDir = await realpath(apiDir);
  const suites = await resolveSuites(apiDir, requested);
  const { evidence } = await readApiSource(apiDir);
  const sourceBefore = await sourceInputs(apiDir);
  const sourceHashes = {};
  for (const file of new Set([...INPUTS, ...suites])) {
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
        ...suites.map((file) => path.join(apiDir, file)),
        "--json",
        "--outputFile",
        resultsFile,
      ],
      {
        cwd,
        env: { PATH: process.env.PATH, NODE_ENV: "test", TZ: "UTC", CI: "true", JEST_RETRY_TIMES: "0" },
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
  const sourceAfter = await sourceInputs(apiDir);
  const unchanged =
    JSON.stringify(after) === JSON.stringify(evidence) && JSON.stringify(sourceAfter) === JSON.stringify(sourceBefore);
  const passed =
    passedResults(
      result,
      suites.map((file) => path.join(apiDir, file)),
      exit
    ) && unchanged;
  const report = {
    status: passed ? "passed" : "failed",
    mode: "offline-fixtures",
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
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn gmx-api:test-offline [--api-dir PATH] [--suite src/...test.ts ...]\nRuns exactly selected API source tests without database setup. Defaults to two Solana calculation suites. Network access is forbidden.\n"
      );
      return 0;
    }
    const report = await runOfflineTests(path.resolve(values["api-dir"]), values.suite);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "offline-test-prerequisite", message: "Check Node 22, API checkout, selected src test paths, fixtures and installed Jest/ts-jest. See docs/solana-api-local.md." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
