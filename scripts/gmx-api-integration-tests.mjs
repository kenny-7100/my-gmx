import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parseArgs } from "node:util";

import { readApiSource } from "./solana-api-local.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SUITES = ["src/domain/pairs/solanaPairsService.test.ts", "src/solanaApp.test.ts"];
const exec = promisify(execFile);
const docker = async (args, options = {}) =>
  (await exec("docker", args, { timeout: 15000, maxBuffer: 1_048_576, ...options })).stdout.trim();

async function readTestSource(apiDir) {
  const { evidence } = await readApiSource(apiDir);
  const files = [
    ...SUITES,
    "jest.config.ts",
    "jest.setup-global.ts",
    "jest.teardown-global.ts",
    "jest.setup.ts",
    "tsconfig.knex.json",
    "src/config/db.ts",
    "src/lib/db/index.ts",
    "src/domain/pairs/solanaPairsService.ts",
    ...(await readdir(path.join(apiDir, "migrations")))
      .filter((file) => /\.(ts|js)$/.test(file))
      .sort()
      .map((file) => `migrations/${file}`),
  ];
  for (const file of files) {
    evidence.sha256[file] = createHash("sha256")
      .update(await readFile(path.join(apiDir, file)))
      .digest("hex");
  }
  return evidence;
}

export async function runIntegrationTests(apiDir) {
  assert.equal(process.versions.node.split(".")[0], "22");
  const evidence = await readTestSource(apiDir);
  for (const file of ["node_modules/jest/bin/jest.js", "jest.config.ts", "tsconfig.knex.json", ...SUITES]) {
    await access(path.join(apiDir, file));
  }
  await docker(["info", "--format", "{{.ServerVersion}}"]);
  const context = JSON.parse(await docker(["context", "inspect"]))[0];
  assert.ok(context.Endpoints.docker.Host.startsWith("unix://"), "Use a local Docker context.");
  assert.ok(!process.env.DOCKER_HOST || process.env.DOCKER_HOST.startsWith("unix://"), "Use a local Docker host.");
  const image = JSON.parse(await docker(["image", "inspect", "postgres:15"]))[0];
  const root = path.join(ROOT, ".local/acceptance/solana-api-local");
  await mkdir(root, { recursive: true });
  const runDir = await mkdtemp(path.join(root, "integration-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "gmx-api-integration-"));
  const logFile = path.join(runDir, "jest.log");
  const resultsFile = path.join(runDir, "jest-results.json");
  const owner = randomUUID();
  const name = `gmx-agent-api-${owner}`;
  const password = randomBytes(24).toString("hex");
  let container;
  let exit;
  let errorCode;
  let port;
  let cleanup = "not-run";
  let stopped = false;
  let child;
  const stop = () => {
    stopped = true;
    child?.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    container = await docker(
      [
        "create",
        "--name",
        name,
        "--label",
        `gmx.agent.test-owner=${owner}`,
        "--publish",
        "127.0.0.1::5432",
        "--env",
        "POSTGRES_PASSWORD",
        "--env",
        "POSTGRES_DB=defaultdb",
        "--tmpfs",
        "/var/lib/postgresql/data:rw",
        image.Id,
      ],
      { env: { ...process.env, POSTGRES_PASSWORD: password } }
    );
    await docker(["start", container]);
    const inspection = JSON.parse(await docker(["inspect", container]))[0];
    const mapping = inspection.NetworkSettings.Ports["5432/tcp"];
    assert.equal(mapping.length, 1);
    assert.equal(mapping[0].HostIp, "127.0.0.1");
    port = Number(mapping[0].HostPort);
    const deadline = Date.now() + 30000;
    let ready = false;
    while (!stopped && Date.now() < deadline) {
      try {
        await docker(["exec", container, "pg_isready", "-U", "postgres", "-d", "defaultdb"], { timeout: 5000 });
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(ready && !stopped, "Database did not become ready.");
    await symlink(path.join(apiDir, "migrations"), path.join(cwd, "migrations"), "dir");
    const fd = openSync(logFile, "wx", 0o600);
    try {
      child = spawn(
        process.execPath,
        [
          path.join(apiDir, "node_modules/jest/bin/jest.js"),
          "--config",
          path.join(apiDir, "jest.config.ts"),
          "--rootDir",
          apiDir,
          "--runInBand",
          "--runTestsByPath",
          ...SUITES.map((file) => path.join(apiDir, file)),
          "--forceExit",
          "--json",
          "--outputFile",
          resultsFile,
        ],
        {
          cwd,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "test",
            CI: "true",
            APP_ROOT: apiDir,
            TS_NODE_PROJECT: path.join(apiDir, "tsconfig.knex.json"),
            TEST_DB_CONNECTION: `postgresql://postgres:${password}@localhost:${port}`,
            JEST_RETRY_TIMES: "0",
          },
          stdio: ["ignore", fd, fd],
          timeout: 180000,
          killSignal: "SIGKILL",
        }
      );
      exit = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });
    } finally {
      closeSync(fd);
    }
  } catch {
    errorCode = stopped ? "interrupted" : "integration-execution-failed";
  } finally {
    try {
      if (container) {
        const inspection = JSON.parse(await docker(["inspect", container]))[0];
        assert.equal(inspection.Config.Labels["gmx.agent.test-owner"], owner);
        await docker(["rm", "--force", "--volumes", container]);
        const remaining = await docker(["ps", "-aq", "--filter", `label=gmx.agent.test-owner=${owner}`]);
        assert.equal(remaining, "");
      }
      await rm(cwd, { recursive: true, force: true });
      cleanup = "passed";
    } catch {
      cleanup = "failed";
    }
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
  let result;
  try {
    result = JSON.parse(await readFile(resultsFile, "utf8"));
  } catch {
    result = undefined;
  }
  const after = await readTestSource(apiDir);
  const unchanged = JSON.stringify(after) === JSON.stringify(evidence);
  const passed =
    !errorCode &&
    !stopped &&
    exit?.code === 0 &&
    !exit.signal &&
    cleanup === "passed" &&
    result?.success === true &&
    result.numPassedTestSuites === SUITES.length &&
    result.numTotalTestSuites === SUITES.length &&
    result.numPassedTests > 0 &&
    result.numPendingTests === 0 &&
    result.numTodoTests === 0 &&
    result.numPassedTests === result.numTotalTests &&
    unchanged;
  const report = {
    status: passed ? "passed" : "failed",
    mode: "isolated-postgres-integration",
    checkedAt: new Date().toISOString(),
    source: evidence,
    sourceUnchanged: unchanged,
    suites: SUITES,
    database: { image: image.Id, container, host: "127.0.0.1", port, ephemeral: true },
    counts: {
      suites: result?.numTotalTestSuites,
      passed: result?.numPassedTests,
      failed: result?.numFailedTests,
      skipped: result?.numPendingTests,
    },
    exit,
    errorCode,
    cleanup,
    logFile,
    resultsFile,
    excluded: ["full API test suite", "live RPC/keeper/SQD", "frontend integration", "wallet transactions"],
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
        "Usage: yarn gmx-api:test-integration [--api-dir PATH]\nRuns two existing API suites using a disposable local postgres:15 container. Requires Docker and the local image; never pulls images or uses existing databases.\n"
      );
      return 0;
    }
    const report = await runIntegrationTests(path.resolve(values["api-dir"]));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "integration-prerequisite", message: "Check Node 22, API checkout/dependencies, Docker daemon and local postgres:15 image. See docs/solana-api-local.md." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
