import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parseArgs } from "node:util";

import { runTestProcess } from "./lib/agent-test-process.mjs";
import { readApiSource } from "./solana-api-local.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_SUITES = ["src/domain/pairs/solanaPairsService.test.ts", "src/solanaApp.test.ts"];
const exec = promisify(execFile);
const docker = async (args, options = {}) =>
  (await exec("docker", args, { timeout: 15000, maxBuffer: 1_048_576, ...options })).stdout.trim();

export async function resolveSuites(apiDir, requested = DEFAULT_SUITES) {
  assert.ok(Array.isArray(requested) && requested.length > 0, "Select at least one test file.");
  const root = await realpath(apiDir);
  const suites = [];
  for (const file of requested) {
    assert.ok(typeof file === "string" && !path.isAbsolute(file), "Use paths relative to the API checkout.");
    const candidate = path.resolve(root, file);
    const relative = path.relative(root, candidate);
    assert.ok(
      relative.startsWith(`src${path.sep}`) && relative.endsWith(".test.ts"),
      "Select a src/**/*.test.ts file."
    );
    const resolved = await realpath(candidate);
    const canonical = path.relative(root, resolved);
    assert.ok(
      canonical.startsWith(`src${path.sep}`) && canonical.endsWith(".test.ts"),
      "Test files must remain inside API src."
    );
    assert.ok((await stat(resolved)).isFile(), "Select a regular test file.");
    assert.ok(!suites.includes(canonical), "Duplicate test selection.");
    suites.push(canonical);
  }
  return suites;
}

async function readTestSource(apiDir, suites) {
  const { evidence } = await readApiSource(apiDir);
  const files = [
    ...suites,
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

export async function runIntegrationTests(apiDir, requested, { inspectPort } = {}) {
  assert.equal(process.versions.node.split(".")[0], "22");
  let suites;
  try {
    suites = await resolveSuites(apiDir, requested);
  } catch {
    throw Object.assign(new Error("Invalid test selection."), { code: "invalid-test-selection" });
  }
  if (inspectPort !== undefined) {
    assert.ok(
      Number.isInteger(inspectPort) && inspectPort > 0 && inspectPort <= 65535,
      "Use an inspector port from 1 to 65535."
    );
    assert.equal(suites.length, 1, "Debug exactly one API integration suite using --suite.");
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(inspectPort, "127.0.0.1", resolve);
    });
    await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  }
  const evidence = await readTestSource(apiDir, suites);
  for (const file of ["node_modules/jest/bin/jest.js", "jest.config.ts", "tsconfig.knex.json", ...suites]) {
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
      `API integration debug session: ${JSON.stringify({ ...debug, logFile, reportFile: path.join(runDir, "report.json") })}\n`
    );
  let container;
  let exit;
  let errorCode;
  let port;
  let cleanup = "not-run";
  let stopped = false;
  const stop = () => {
    stopped = true;
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
        "-c",
        "timezone=UTC",
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
    await mkdir(path.join(cwd, "src"));
    await symlink(path.join(apiDir, "src/abi"), path.join(cwd, "src/abi"), "dir");
    const fd = openSync(logFile, "wx", 0o600);
    try {
      assert.ok(!stopped, "Integration check interrupted before test execution.");
      exit = await runTestProcess({
        args: [
          ...(debug ? [`--inspect-brk=${debug.inspector}`] : []),
          path.join(apiDir, "node_modules/jest/bin/jest.js"),
          "--config",
          path.join(apiDir, "jest.config.ts"),
          "--rootDir",
          apiDir,
          "--runInBand",
          "--runTestsByPath",
          ...suites.map((file) => path.join(apiDir, file)),
          "--forceExit",
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
          APP_ROOT: apiDir,
          TS_NODE_PROJECT: path.join(apiDir, "tsconfig.knex.json"),
          TEST_DB_CONNECTION: `postgresql://postgres:${password}@localhost:${port}`,
          JEST_RETRY_TIMES: "0",
        },
        logFd: fd,
        timeoutMs: debug?.timeoutMs ?? 180000,
      });
      if (exit.interrupted) errorCode = "interrupted";
      else if (exit.timedOut) errorCode = "test-timeout";
      else if (exit.cleanup !== "passed" || exit.signalError) errorCode = "process-cleanup-failed";
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
  if (debug) {
    const log = await readFile(logFile, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    debug.started =
      log.includes(`Debugger listening on ws://${debug.inspector}/`) && !log.includes("Starting inspector on");
  }
  let result;
  try {
    result = JSON.parse(await readFile(resultsFile, "utf8"));
  } catch {
    result = undefined;
  }
  const after = await readTestSource(apiDir, suites);
  const unchanged = JSON.stringify(after) === JSON.stringify(evidence);
  const passed =
    (!debug || debug.started) &&
    !errorCode &&
    !stopped &&
    exit?.cleanup === "passed" &&
    !exit.interrupted &&
    !exit.timedOut &&
    !exit.signalError &&
    exit.code === 0 &&
    !exit.signal &&
    cleanup === "passed" &&
    result?.success === true &&
    result.numPassedTestSuites === suites.length &&
    result.numTotalTestSuites === suites.length &&
    result.numPassedTests > 0 &&
    result.numPendingTests === 0 &&
    result.numTodoTests === 0 &&
    result.numPassedTests === result.numTotalTests &&
    unchanged;
  const report = {
    status: passed ? "passed" : "failed",
    mode: "isolated-postgres-integration",
    timezone: "UTC",
    checkedAt: new Date().toISOString(),
    temporaryDirectory: cwd,
    source: evidence,
    sourceUnchanged: unchanged,
    suites,
    database: { image: image.Id, container, host: "127.0.0.1", port, ephemeral: true },
    counts: {
      suites: result?.numTotalTestSuites,
      passed: result?.numPassedTests,
      failed: result?.numFailedTests,
      skipped: result?.numPendingTests,
    },
    exit,
    ...(debug ? { debug } : {}),
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
        suite: { type: "string", multiple: true },
        "inspect-port": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn gmx-api:test-integration [--api-dir PATH] [--suite src/path.test.ts ...] [--inspect-port 9241]\nRepeat --suite to select API test files; defaults to Solana pairs service and app suites. Uses disposable local postgres:15, never pulls images or uses existing databases. Debug mode requires one suite, pauses on loopback and allows 30 minutes.\n"
      );
      return 0;
    }
    const report = await runIntegrationTests(path.resolve(values["api-dir"]), values.suite, {
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
      `${JSON.stringify({ status: "failed", code: error?.code === "invalid-test-selection" ? "invalid-test-selection" : "integration-prerequisite", message: error?.code === "invalid-test-selection" ? "Select unique existing src/**/*.test.ts files relative to the API checkout. No external paths or globs. See --help." : error.message.split("\n")[0].slice(0, 240) })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
