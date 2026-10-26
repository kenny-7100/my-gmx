import assert from "node:assert/strict";
import { fork, spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { checkContracts } from "./lib/solana-dev-contracts.mjs";
import { control as apiControl } from "./solana-api-dev.mjs";
import { startVite, API_PREFIX } from "../tools/solana-dev/vite.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const exec = promisify(execFile);
const socketFile = `/tmp/gmx-solana-stack-${process.getuid()}-${createHash("sha256").update(ROOT).digest("hex").slice(0, 12)}.sock`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function control(command) {
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

async function freePort(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function supervise(options) {
  const output = path.join(ROOT, ".local/acceptance/solana-dev");
  await mkdir(output, { recursive: true });
  const runDir = await mkdtemp(path.join(output, "run-"));
  const reportFile = path.join(runDir, "report.json");
  const apiCli = (...args) =>
    exec(
      process.execPath,
      [path.join(ROOT, "scripts/solana-api-dev.mjs"), ...args, "--port", String(options.apiPort)],
      { cwd: ROOT, env: { PATH: process.env.PATH }, timeout: 40000, maxBuffer: 1048576 }
    );
  const requestsFile = path.join(runDir, "requests.jsonl");
  const frontendFiles = ["vite.config.ts", "src/config/api.ts", "sdk/src/configs/api.ts", "tools/solana-dev/vite.mjs"];
  const frontendHashes = {};
  for (const file of frontendFiles) {
    frontendHashes[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  }
  const git = async (...args) =>
    (await exec("git", ["-C", ROOT, ...args], { env: { PATH: process.env.PATH } })).stdout.trim();
  const frontendSourceAtStart = {
    commit: await git("rev-parse", "HEAD"),
    dirty: (await git("status", "--porcelain")).length > 0,
    configurationSha256: frontendHashes,
  };
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
    frontendSourceAtStart,
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
        assert.equal(result.status, "ready");
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
        assert.equal(existing.status, "ready");
        assert.equal(existing.apiDir, path.join(ROOT, "gmx-api"));
        report.services.api = {
          ownership: "borrowed",
          supervisorPid: existing.supervisorPid,
          logFile: existing.logFile,
          source: existing.sourceAtStart,
        };
      } else {
        const started = JSON.parse((await apiCli("up")).stdout);
        apiOwned = true;
        report.services.api = {
          ownership: "owned",
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
        root: ROOT,
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
        "web-port": { type: "string", default: "3010" },
        "api-port": { type: "string", default: "3004" },
        "rpc-port": { type: "string", default: "3030" },
        id: { type: "string" },
        offline: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:dev <up|status|logs|stop|trace|contracts> [--services api,vite,rpc] [--web-port 3010 --api-port 3004 --rpc-port 3030] [--id TRACE_ID] [--offline]\nDevelopment tools only. The local API proxy is /__agent/solana-api; no frontend business consumer is added. Contracts are unreviewed structural baselines (partial exits 2).\n"
      );
      return 0;
    }
    assert.equal(positionals.length, 1);
    const command = positionals[0];
    assert.ok(["up", "_serve", "status", "logs", "stop", "trace", "contracts"].includes(command));
    assert.equal(process.versions.node.split(".")[0], "22");
    for (const token of tokens.filter((token) => token.kind === "option")) {
      if (["services", "web-port", "api-port", "rpc-port"].includes(token.name))
        assert.ok(["up", "_serve"].includes(command));
      if (token.name === "id") assert.equal(command, "trace");
      if (token.name === "offline") assert.equal(command, "contracts");
    }
    const options = {
      services: values.services.split(","),
      webPort: Number(values["web-port"]),
      apiPort: Number(values["api-port"]),
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
    if (command === "_serve") {
      assert.ok(process.send);
      await supervise(options);
      return process.exitCode ?? 0;
    }
    let result;
    if (command === "up") {
      const output = path.join(ROOT, ".local/acceptance/solana-dev");
      await mkdir(output, { recursive: true });
      const launcherDir = await mkdtemp(path.join(output, "launcher-"));
      const workspaceLog = path.join(launcherDir, "workspace.log");
      const logFd = openSync(workspaceLog, "wx", 0o600);
      const child = fork(
        SCRIPT,
        [
          "_serve",
          "--services",
          values.services,
          "--web-port",
          values["web-port"],
          "--api-port",
          values["api-port"],
          "--rpc-port",
          values["rpc-port"],
        ],
        {
          cwd: ROOT,
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
      result = await control(command === "trace" ? `trace ${values.id}` : command);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === "partial" ? 2 : ["ready", "passed", "stopped"].includes(result.status) ? 0 : 1;
  } catch {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "workspace-unavailable", message: "Check arguments, service ownership, installed dependencies and .local/acceptance/solana-dev/run-*/report.json. This workspace never takes over unknown listeners." })}\n`
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
