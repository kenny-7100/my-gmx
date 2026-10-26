import assert from "node:assert/strict";
import { fork, spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { sourceEvidence } from "./frontend-offline-tests.mjs";
import { readApiTestSource } from "./lib/gmx-api-source.mjs";
import { checkContracts } from "./lib/solana-dev-contracts.mjs";
import { control as apiControl } from "./solana-api-dev.mjs";
import { doctorApi } from "./solana-api-local.mjs";
import { browserDependency, checkChromeExecutable } from "./solana-browser-preflight.mjs";
import { startVite, API_PREFIX } from "../tools/solana-dev/vite.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const exec = promisify(execFile);
function workspaceSocket(projectDir) {
  const key = path.resolve(projectDir) === path.resolve(ROOT) ? ROOT : projectDir;
  return `/tmp/gmx-solana-stack-${process.getuid()}-${createHash("sha256").update(key).digest("hex").slice(0, 12)}.sock`;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function validateApiService({ service, apiDir, supervisorPid, inspectPort }) {
  assert.equal(service.status, "ready", "The selected API service is not ready.");
  assert.equal(service.apiDir, apiDir, "The API port belongs to another checkout.");
  if (supervisorPid !== undefined)
    assert.equal(service.supervisorPid, supervisorPid, "The API service instance changed.");
  if (inspectPort !== undefined)
    assert.equal(service.inspector, `127.0.0.1:${inspectPort}`, "The API inspector does not match the requested port.");
}

export async function control(command, projectDir = ROOT) {
  const socketFile = workspaceSocket(await realpath(projectDir));
  return new Promise((resolve, reject) => {
    const client = net.connect(socketFile);
    let bytes = "";
    client.setTimeout(30000, () => client.destroy(new Error("Workspace request timed out.")));
    client.on("connect", () => client.write(`${command}\n`));
    client.on("error", reject);
    client.on("data", (part) => {
      bytes += part;
      if (bytes.length > 1048576) client.destroy(new Error("Response is too large."));
    });
    client.on("end", () => {
      try {
        resolve(JSON.parse(bytes));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function devTarget(projectDir) {
  projectDir = await realpath(projectDir);
  const { stdout } = await exec("git", ["-C", projectDir, "rev-parse", "--show-toplevel"], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  assert.equal(await realpath(stdout.trim()), projectDir, "Select the frontend Git checkout root.");
  const installedVite = async (dir) =>
    JSON.parse(await readFile(path.join(dir, "node_modules/vite/package.json"), "utf8")).version;
  assert.equal(
    await installedVite(projectDir),
    await installedVite(ROOT),
    "Target Vite must match the infrastructure runtime version."
  );
  return { projectDir, source: await sourceEvidence(projectDir) };
}

async function freePort(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export async function doctorWorkspace(options) {
  const checks = [];
  const inspect = async (name, remedy, action) => {
    try {
      const details = await action();
      checks.push({ name, status: "passed", ...details });
    } catch (error) {
      checks.push({ name, status: "blocked", remedy, reason: error.message.split("\n")[0].slice(0, 240) });
    }
  };
  await inspect("node", "Use Node 22.", () => assert.equal(process.versions.node.split(".")[0], "22"));
  await inspect("frontend", "Select the frontend Git root with its locked dependencies and compatible Vite.", () =>
    devTarget(options.projectDir)
  );
  await inspect("workspace", "Use another frontend checkout or stop its workspace explicitly.", async () => {
    let existing;
    try {
      existing = await control("status", options.projectDir);
    } catch (error) {
      if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) throw error;
    }
    assert.ok(!existing, "A workspace already exists for this frontend.");
  });
  if (options.services.includes("api")) {
    await inspect("api-checkout", "Select the API Git checkout root.", () => readApiTestSource(options.apiDir, []));
    const preparation = await doctorApi({ apiDir: options.apiDir, port: options.apiPort, checkPort: false });
    for (const check of preparation.checks.filter((check) => check.name !== "node"))
      checks.push({ ...check, name: `api-${check.name}`, status: check.status === "passed" ? "passed" : "blocked" });
    await inspect(
      "api-service",
      "Select a free API port or a ready matching managed checkout and inspector.",
      async () => {
        let existing;
        try {
          existing = await apiControl(options.apiPort, "status");
        } catch (error) {
          if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) throw error;
        }
        if (existing) {
          validateApiService({
            service: existing,
            apiDir: await realpath(options.apiDir),
            inspectPort: options.apiInspectPort,
          });
          return { ownership: "borrowed", supervisorPid: existing.supervisorPid, inspector: existing.inspector };
        }
        await freePort(options.apiPort);
        if (options.apiInspectPort) await freePort(options.apiInspectPort);
        return { ownership: "would-start-owned" };
      }
    );
  }
  if (options.services.includes("vite")) {
    await inspect("web-port", "Select a free Web port; existing listeners are preserved.", () =>
      freePort(options.webPort)
    );
    await inspect(
      "playwright",
      "Prepare the infrastructure checkout's locked Playwright dependency.",
      browserDependency
    );
    await inspect(
      "chrome",
      "Install the supported system Google Chrome executable; see docs/solana-browser-smoke.md.",
      () => checkChromeExecutable()
    );
  }
  if (options.services.includes("rpc"))
    await inspect("rpc-port", "Select a free RPC proxy port.", () => freePort(options.rpcPort));
  return {
    schemaVersion: 1,
    status: checks.every((check) => check.status === "passed") ? "passed" : "blocked",
    scope: "full-stack-startup-prerequisites",
    checkedAt: new Date().toISOString(),
    projectDir: path.resolve(options.projectDir),
    apiDir: path.resolve(options.apiDir),
    checks,
    serviceStartup: "not-run",
    browserExecution: "not-run",
    businessAcceptance: "not-run",
  };
}

async function supervise(options) {
  const socketFile = workspaceSocket(options.projectDir);
  const output = path.join(ROOT, ".local/acceptance/solana-dev");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "run-"));
  const reportFile = path.join(runDir, "report.json");
  const apiCli = (...args) =>
    exec(
      process.execPath,
      [
        path.join(ROOT, "scripts/solana-api-dev.mjs"),
        ...args,
        "--api-dir",
        options.apiDir,
        "--port",
        String(options.apiPort),
      ],
      { cwd: ROOT, env: { PATH: process.env.PATH }, timeout: 40000, maxBuffer: 1048576 }
    );
  const requestsFile = path.join(runDir, "requests.jsonl");
  const frontendFiles = ["vite.config.ts", "src/config/api.ts", "sdk/src/configs/api.ts"];
  const frontendHashes = {};
  for (const file of frontendFiles) {
    frontendHashes[file] = createHash("sha256")
      .update(await readFile(path.join(options.projectDir, file)))
      .digest("hex");
  }
  const frontendSourceAtStart = {
    ...(await devTarget(options.projectDir)).source,
    configurationSha256: frontendHashes,
  };
  const frontendToolSha256 = {};
  for (const file of ["scripts/solana-dev.mjs", "tools/solana-dev/vite.mjs"])
    frontendToolSha256[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  await writeFile(requestsFile, "", { mode: 0o600 });
  let journal = Promise.resolve();
  const record = (entry) => {
    journal = journal.then(async () => {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(requestsFile, `${JSON.stringify(entry)}\n`);
    });
  };
  const report = {
    schemaVersion: 1,
    status: "starting",
    mode: "sample",
    projectDir: options.projectDir,
    apiDir: options.apiDir,
    frontendSourceAtStart,
    frontendToolSha256,
    startedAt: new Date().toISOString(),
    supervisorPid: process.pid,
    services: {},
    apiUrl: `http://127.0.0.1:${options.apiPort}`,
    webUrl: `http://127.0.0.1:${options.webPort}`,
    localApiPath: API_PREFIX,
    requestsFile,
    reportFile,
    workspaceLog: process.env.SOLANA_DEV_LOG_FILE,
    frontendConsumption: "not-verified-by-workspace",
    contractReview: "unreviewed-source-samples",
    statusScope: "Lifecycle snapshot; run status for current health.",
  };
  const save = () => writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  let vite,
    rpc,
    rpcExit,
    apiOwned = false,
    ownsSocket = false,
    stopping;
  const health = async () => {
    const checks = [];
    if (options.services.includes("api")) {
      try {
        const result = await apiControl(options.apiPort, "status");
        validateApiService({
          service: result,
          apiDir: options.apiDir,
          supervisorPid: report.services.api.supervisorPid,
          inspectPort: options.apiInspectPort,
        });
        checks.push({ service: "api", status: "passed", mode: result.mode, apiDir: result.apiDir });
      } catch {
        checks.push({ service: "api", status: "failed" });
      }
    }
    if (options.services.includes("vite")) {
      try {
        const response = await fetch(`${report.webUrl}/@vite/client`, { signal: AbortSignal.timeout(3000) });
        assert.equal(response.status, 200);
        assert.ok((await response.text()).includes("WebSocket"));
        checks.push({ service: "vite", status: "passed" });
      } catch {
        checks.push({ service: "vite", status: "failed" });
      }
    }
    if (options.services.includes("rpc")) {
      try {
        assert.ok(rpc && rpc.exitCode === null && rpc.signalCode === null);
        const response = await fetch(`http://127.0.0.1:${options.rpcPort}/healthz`, {
          signal: AbortSignal.timeout(2000),
        });
        assert.equal((await response.json()).status, "ok");
        checks.push({ service: "rpc", status: "passed", upstream: "unchecked" });
      } catch {
        checks.push({ service: "rpc", status: "failed" });
      }
    }
    return {
      ...report,
      status: checks.every((check) => check.status === "passed") ? "ready" : "failed",
      checkedAt: new Date().toISOString(),
      checks,
    };
  };
  const server = net.createServer((client) => {
    client.on("error", () => {
      // A disconnected diagnostics client must not stop the workspace.
    });
    client.setTimeout(30000, () => client.destroy());
    client.once("data", async (bytes) => {
      try {
        const command = bytes.toString().trim();
        let result;
        if (command === "status") result = await health();
        else if (command === "stop") result = await stop();
        else if (command === "logs") result = { status: "passed", runDir, requestsFile, services: report.services };
        else if (command === "contracts")
          result = await checkContracts({
            apiDir: options.apiDir,
            baseUrl: options.services.includes("vite") ? `${report.webUrl}${API_PREFIX}` : report.apiUrl,
          });
        else if (command.startsWith("trace ")) {
          const id = command.slice(6);
          assert.ok(/^[a-zA-Z0-9_-]{1,80}$/.test(id));
          await journal;
          const records = (await readFile(requestsFile, "utf8"))
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line))
            .filter((record) => record.traceId === id || record.responseTraceId === id);
          let apiLog;
          const file = report.services.api?.logFile;
          if (file) {
            const lines = (await readFile(file, "utf8")).split("\n");
            apiLog = {
              file,
              lineNumbers: lines.flatMap((line, index) =>
                new RegExp(`(^|[^a-zA-Z0-9_-])${id}($|[^a-zA-Z0-9_-])`).test(line) ? [index + 1] : []
              ),
            };
          }
          result = {
            status: records.length ? "passed" : "not-found",
            traceId: id,
            requests: records,
            apiLog,
            backendLogNote:
              "The existing API does not emit a log for every request. No matching line is not evidence of an unhandled request.",
          };
        } else throw new Error("Unknown command.");
        client.end(`${JSON.stringify(result)}\n`);
      } catch {
        client.end(`${JSON.stringify({ status: "failed", code: "workspace-operation-failed", reportFile })}\n`);
      }
    });
  });
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      const errors = [];
      try {
        await vite?.close();
      } catch {
        errors.push("vite");
      }
      if (rpc?.pid) {
        try {
          process.kill(-rpc.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") errors.push("rpc");
        }
        await Promise.race([rpcExit, pause(5000)]);
        try {
          process.kill(-rpc.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") errors.push("rpc");
        }
        await rpcExit;
      }
      if (apiOwned) {
        try {
          const current = await apiControl(options.apiPort, "status");
          assert.equal(current.supervisorPid, report.services.api.supervisorPid, "API ownership changed.");
          assert.equal((await apiControl(options.apiPort, "stop")).status, "stopped");
        } catch {
          errors.push("api");
        }
      }
      if (ownsSocket) server.close();
      await journal;
      report.status = errors.length ? "failed" : "stopped";
      report.cleanup = errors.length ? "failed" : "passed";
      report.cleanupErrors = errors;
      await save();
      return report;
    })();
    return stopping;
  };
  const onSignal = () =>
    stop().then(() => {
      process.exitCode = report.cleanup === "passed" ? 0 : 1;
    });
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketFile, resolve);
    });
    ownsSocket = true;
    await chmod(socketFile, 0o600);
    if (options.services.includes("api")) {
      let existing;
      try {
        existing = await apiControl(options.apiPort, "status");
      } catch (error) {
        if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) throw error;
      }
      if (existing) {
        validateApiService({ service: existing, apiDir: options.apiDir, inspectPort: options.apiInspectPort });
        report.services.api = {
          ownership: "borrowed",
          apiDir: existing.apiDir,
          inspector: existing.inspector,
          supervisorPid: existing.supervisorPid,
          logFile: existing.logFile,
          source: existing.sourceAtStart,
        };
      } else {
        const started = JSON.parse(
          (await apiCli("up", ...(options.apiInspectPort ? ["--inspect-port", String(options.apiInspectPort)] : [])))
            .stdout
        );
        apiOwned = true;
        report.services.api = {
          ownership: "owned",
          apiDir: started.apiDir,
          inspector: started.inspector,
          supervisorPid: started.supervisorPid,
          logFile: started.logFile,
          source: started.sourceAtStart,
        };
      }
    }
    assert.ok(!stopping);
    if (options.services.includes("rpc")) {
      await freePort(options.rpcPort);
      const logFile = path.join(runDir, "rpc.log");
      const fd = openSync(logFile, "wx", 0o600);
      try {
        rpc = spawn(process.execPath, [path.join(ROOT, "tools/solana-rpc-proxy/server.mjs")], {
          cwd: ROOT,
          detached: true,
          env: { PATH: process.env.PATH, SOLANA_RPC_PROXY_PORT: String(options.rpcPort) },
          stdio: ["ignore", fd, fd],
        });
      } finally {
        closeSync(fd);
      }
      rpcExit = new Promise((resolve) => {
        rpc.once("error", () => resolve());
        rpc.once("exit", resolve);
      });
      report.services.rpc = { ownership: "owned", pid: rpc.pid, logFile, upstream: "unchecked" };
      let ready = false;
      for (let i = 0; i < 30 && !stopping; i++) {
        try {
          const r = await fetch(`http://127.0.0.1:${options.rpcPort}/healthz`, { signal: AbortSignal.timeout(500) });
          ready = r.status === 200;
          if (ready) break;
        } catch {
          // Retry only while the owned RPC process starts.
        }
        await pause(100);
      }
      assert.ok(ready);
    }
    assert.ok(!stopping);
    if (options.services.includes("vite")) {
      await freePort(options.webPort);
      vite = await startVite({
        root: options.projectDir,
        webPort: options.webPort,
        apiPort: options.apiPort,
        rpcPort: options.services.includes("rpc") ? options.rpcPort : undefined,
        record,
      });
      report.services.vite = { ownership: "owned", config: "tools/solana-dev/vite.mjs" };
    }
    const current = await health();
    assert.equal(current.status, "ready");
    assert.ok(!stopping);
    Object.assign(report, current);
    await save();
    process.send(report);
    process.disconnect();
    rpcExit?.then(() => {
      if (!stopping) {
        report.unexpectedExit = "rpc";
        stop().then(() => {
          report.status = "failed";
          save().finally(() => {
            process.exitCode = 1;
          });
        });
      }
    });
  } catch (error) {
    await stop();
    report.status = "failed";
    report.code = error.code === "EADDRINUSE" ? "port-or-workspace-in-use" : "startup-failed";
    report.reason = error.message.split("\n")[0].slice(0, 240);
    await save();
    if (process.connected) {
      process.send(report);
      process.disconnect();
    }
    process.exitCode = 1;
  }
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { positionals, values, tokens } = parseArgs({
      args,
      allowPositionals: true,
      tokens: true,
      options: {
        services: { type: "string", default: "api,vite" },
        "project-dir": { type: "string", default: ROOT },
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        "web-port": { type: "string", default: "3010" },
        "api-port": { type: "string", default: "3004" },
        "api-inspect-port": { type: "string" },
        "rpc-port": { type: "string", default: "3030" },
        id: { type: "string" },
        offline: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:dev <doctor|up|status|logs|stop|trace|contracts> [--project-dir PATH] [--api-dir PATH] [--api-inspect-port PORT] [--services api,vite,rpc] [--web-port 3010 --api-port 3004 --rpc-port 3030] [--id TRACE_ID] [--offline]\nUse --project-dir to select a frontend checkout and its workspace; up may select an independent API checkout using --api-dir. Up requires installed target dependencies, matching Vite and the API Solana sample entry. --api-inspect-port explicitly enables loopback API debugging or requires a matching borrowed inspector. Doctor checks startup and Chrome prerequisites without starting services; blocked exits 2. Development tools only. The local API proxy is /__agent/solana-api; no frontend business consumer is added. Contracts are unreviewed structural baselines (partial exits 2).\n"
      );
      return 0;
    }
    assert.equal(positionals.length, 1);
    const command = positionals[0];
    assert.ok(["doctor", "up", "_serve", "status", "logs", "stop", "trace", "contracts"].includes(command));
    if (command !== "doctor") assert.equal(process.versions.node.split(".")[0], "22");
    for (const token of tokens.filter((token) => token.kind === "option")) {
      if (["api-dir", "api-inspect-port", "services", "web-port", "api-port", "rpc-port"].includes(token.name))
        assert.ok(["doctor", "up", "_serve"].includes(command));
      if (token.name === "id") assert.equal(command, "trace");
      if (token.name === "offline") assert.equal(command, "contracts");
    }
    const options = {
      services: values.services.split(","),
      projectDir: values["project-dir"],
      apiDir: values["api-dir"],
      webPort: Number(values["web-port"]),
      apiPort: Number(values["api-port"]),
      apiInspectPort: values["api-inspect-port"] === undefined ? undefined : Number(values["api-inspect-port"]),
      rpcPort: Number(values["rpc-port"]),
    };
    assert.ok(
      options.services.length > 0 &&
        new Set(options.services).size === options.services.length &&
        options.services.every((s) => ["api", "vite", "rpc"].includes(s))
    );
    for (const key of ["web-port", "api-port", "rpc-port"])
      assert.ok(/^\d+$/.test(values[key]) && Number(values[key]) > 0 && Number(values[key]) <= 65535);
    assert.equal(new Set([options.webPort, options.apiPort, options.rpcPort]).size, 3);
    if (options.apiInspectPort !== undefined) {
      assert.ok(options.services.includes("api"), "API debugging requires the API service.");
      assert.ok(
        /^\d+$/.test(values["api-inspect-port"]) && options.apiInspectPort > 0 && options.apiInspectPort <= 65535,
        "Invalid API inspector port."
      );
      assert.ok(
        ![options.webPort, options.apiPort, options.rpcPort].includes(options.apiInspectPort),
        "API inspector port must differ from service ports."
      );
    }
    if (command === "_serve") {
      assert.ok(process.send);
      await supervise(options);
      return process.exitCode ?? 0;
    }
    let result;
    if (command === "doctor") result = await doctorWorkspace(options);
    else if (command === "up") {
      options.projectDir = (await devTarget(options.projectDir)).projectDir;
      if (options.services.includes("api")) {
        options.apiDir = await realpath(options.apiDir);
        await readApiTestSource(options.apiDir, []);
      }
      const output = path.join(ROOT, ".local/acceptance/solana-dev");
      await mkdir(output, { recursive: true });
      const launcherDir = await mkdtemp(path.join(output, "launcher-"));
      const workspaceLog = path.join(launcherDir, "workspace.log");
      const logFd = openSync(workspaceLog, "wx", 0o600);
      const child = fork(
        SCRIPT,
        [
          "_serve",
          "--project-dir",
          options.projectDir,
          "--api-dir",
          options.apiDir,
          "--services",
          values.services,
          "--web-port",
          values["web-port"],
          "--api-port",
          values["api-port"],
          "--rpc-port",
          values["rpc-port"],
          ...(options.apiInspectPort ? ["--api-inspect-port", String(options.apiInspectPort)] : []),
        ],
        {
          cwd: options.projectDir,
          detached: true,
          env: { PATH: process.env.PATH, SOLANA_DEV_LOG_FILE: workspaceLog },
          stdio: ["ignore", logFd, logFd, "ipc"],
        }
      );
      closeSync(logFd);
      result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("Startup timed out."));
        }, 60000);
        child.once("message", (report) => {
          clearTimeout(timer);
          child.disconnect();
          child.unref();
          resolve(report);
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("Supervisor exited."));
        });
      });
    } else if (command === "contracts" && values.offline) result = await checkContracts();
    else {
      if (command === "trace") assert.ok(values.id && /^[a-zA-Z0-9_-]{1,80}$/.test(values.id));
      result = await control(command === "trace" ? `trace ${values.id}` : command, options.projectDir);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return ["partial", "blocked"].includes(result.status)
      ? 2
      : ["ready", "passed", "stopped"].includes(result.status)
        ? 0
        : 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "workspace-unavailable", reason: error.message.split("\n")[0].slice(0, 240), message: "Check arguments, service ownership, installed dependencies and .local/acceptance/solana-dev/run-*/report.json. This workspace never takes over unknown listeners." })}\n`
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
