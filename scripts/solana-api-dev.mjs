import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { chmod, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { doctorApi, readApiSource, verifyApi } from "./solana-api-local.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readLogTail(file) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(Math.min(size, 65536));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, Math.max(0, size - buffer.length));
    return buffer.subarray(0, bytesRead).toString("utf8").split("\n").slice(-100).join("\n");
  } finally {
    await handle.close();
  }
}

function socketPath(port) {
  const id = createHash("sha256").update(ROOT).digest("hex").slice(0, 12);
  return `/tmp/gmx-solana-api-${process.getuid()}-${id}-${port}.sock`;
}

export function control(port, command) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(socketPath(port));
    let data = "";
    socket.setTimeout(25000, () => socket.destroy(new Error("Control request timed out.")));
    socket.on("error", reject);
    socket.on("connect", () => socket.write(`${command}\n`));
    socket.on("data", (chunk) => {
      data += chunk;
      if (data.length > 262144) socket.destroy(new Error("Control response is too large."));
    });
    socket.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function supervise({ apiDir, port, inspectPort }) {
  const preflight = await doctorApi({ apiDir, port });
  assert.equal(preflight.status, "passed", "API preflight failed.");
  const root = path.join(ROOT, ".local/acceptance/solana-api-local");
  await mkdir(root, { recursive: true });
  const runDir = await mkdtemp(path.join(root, "dev-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "gmx-solana-dev-"));
  const logFile = path.join(runDir, "service.log");
  const reportFile = path.join(runDir, "report.json");
  const sourceAtStart = (await readApiSource(apiDir)).evidence;
  const report = {
    schemaVersion: 1,
    status: "starting",
    mode: "sample",
    launchMode: "solana",
    apiDir,
    baseUrl: `http://127.0.0.1:${port}`,
    apiListenHost: "OS default (the existing API does not specify a host)",
    startedAt: new Date().toISOString(),
    supervisorPid: process.pid,
    sourceAtStart,
    logFile,
    reportFile,
    controlSocket: socketPath(port),
    statusScope: "Lifecycle snapshot; run status for current HTTP health.",
    inspector: inspectPort ? `127.0.0.1:${inspectPort}` : "disabled",
    liveChainData: "not-implemented-by-current-solana-entry",
  };
  const save = () => writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  let watcher;
  let watcherExit;
  let stopPromise;
  let ownsSocket = false;
  const server = net.createServer((client) => {
    client.on("error", () => {
      // A disconnected control client must not terminate the service.
    });
    client.setTimeout(3000, () => client.destroy());
    client.once("data", async (bytes) => {
      client.setTimeout(25000, () => client.destroy());
      try {
        const command = bytes.toString().trim();
        let result;
        if (command === "status") {
          const verification = await verifyApi({ apiDir, port });
          assert.ok(watcher && watcher.exitCode === null && watcher.signalCode === null);
          result = { ...report, status: "ready", checkedAt: new Date().toISOString(), verification };
        } else if (command === "logs") {
          result = {
            status: "passed",
            logFile,
            tail: await readLogTail(logFile),
          };
        } else if (command === "stop") {
          result = await stop();
        } else throw new Error("Unknown control command.");
        client.end(`${JSON.stringify(result)}\n`);
      } catch {
        client.end(
          `${JSON.stringify({ ...report, status: "failed", code: "service-not-ready", checkedAt: new Date().toISOString() })}\n`
        );
      }
    });
  });
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      if (watcher?.pid) {
        try {
          process.kill(-watcher.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
        await Promise.race([watcherExit, delay(5000)]);
        try {
          process.kill(-watcher.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
        await watcherExit;
      }
      await rm(cwd, { recursive: true, force: true });
      if (ownsSocket) {
        server.close();
      }
      report.status = "stopped";
      report.stoppedAt = new Date().toISOString();
      await save();
      return report;
    })();
    return stopPromise;
  };
  const onSignal = () =>
    stop().catch(() => {
      process.exitCode = 1;
    });
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath(port), resolve);
    });
    ownsSocket = true;
    await chmod(socketPath(port), 0o600);
    assert.ok(!stopPromise, "Startup was cancelled.");
    const fd = openSync(logFile, "wx", 0o600);
    try {
      watcher = spawn(
        process.execPath,
        [
          path.join(apiDir, "node_modules/tsx/dist/cli.mjs"),
          "watch",
          "--clear-screen=false",
          "--tsconfig",
          path.join(apiDir, "tsconfig.json"),
          "--include",
          path.join(apiDir, "src/**/*"),
          ...(inspectPort ? [`--inspect=127.0.0.1:${inspectPort}`] : []),
          path.join(apiDir, "src/index.ts"),
        ],
        {
          cwd,
          detached: true,
          env: {
            PATH: process.env.PATH,
            TMPDIR: tmpdir(),
            TZ: "UTC",
            NODE_ENV: "development",
            LAUNCH_MODE: "solana",
            PORT: String(port),
            APP_ROOT: apiDir,
            COMMIT_HASH: sourceAtStart.commit,
          },
          stdio: ["ignore", fd, fd],
        }
      );
    } finally {
      closeSync(fd);
    }
    watcherExit = new Promise((resolve) => {
      watcher.once("error", () => resolve({ code: 1 }));
      watcher.once("exit", (code, signal) => resolve({ code, signal }));
    });
    report.watcherPid = watcher.pid;
    await save();
    const deadline = Date.now() + 20000;
    let verification;
    while (Date.now() < deadline && !stopPromise && watcher.exitCode === null && watcher.signalCode === null) {
      try {
        verification = await verifyApi({ apiDir, port });
        break;
      } catch {
        await delay(200);
      }
    }
    assert.ok(verification && !stopPromise, "API did not become ready.");
    if (inspectPort) {
      const response = await fetch(`http://127.0.0.1:${inspectPort}/json/list`, {
        signal: AbortSignal.timeout(2000),
      });
      assert.equal(response.status, 200);
      assert.ok((await response.json()).some((target) => target.webSocketDebuggerUrl));
    }
    report.status = "ready";
    report.initialVerification = verification;
    await save();
    process.send?.(report);
    process.disconnect?.();
    const exit = await watcherExit;
    if (!stopPromise) {
      report.watcherExit = exit;
      await stop();
      report.status = "failed";
      await save();
      process.exitCode = 1;
    }
  } catch (error) {
    await stop();
    report.status = "failed";
    report.code = error.code === "EADDRINUSE" ? "control-socket-in-use" : "startup-failed";
    await save();
    process.send?.(report);
    process.disconnect?.();
    process.exitCode = 1;
  }
}

async function up(options) {
  const preflight = await doctorApi(options);
  if (preflight.status !== "passed") return { ...preflight, code: "preflight-failed" };
  if (options.inspectPort) {
    const inspectorPreflight = await doctorApi({ ...options, port: options.inspectPort });
    if (inspectorPreflight.status !== "passed") return { ...inspectorPreflight, code: "inspector-port-unavailable" };
  }
  const child = fork(
    SCRIPT,
    [
      "_serve",
      "--api-dir",
      options.apiDir,
      "--port",
      String(options.port),
      ...(options.inspectPort ? ["--inspect-port", String(options.inspectPort)] : []),
    ],
    {
      detached: true,
      env: { PATH: process.env.PATH },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    }
  );
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Supervisor startup timed out."));
    }, 30000);
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
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error("Supervisor exited during startup."));
    });
  });
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { positionals, values } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        port: { type: "string", default: "3004" },
        "inspect-port": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:api-dev <up|status|logs|stop> [--api-dir PATH] [--port 3004] [--inspect-port 9229]\nRuns the existing Solana sample API continuously with tsx watch. No database, real data ingestion or wallet credentials. Logs and source evidence are retained locally. Stop explicitly when finished.\n"
      );
      return 0;
    }
    const port = Number(values.port);
    const inspectPort = values["inspect-port"] === undefined ? undefined : Number(values["inspect-port"]);
    assert.ok(/^\d+$/.test(values.port) && port > 0 && port <= 65535);
    if (inspectPort !== undefined)
      assert.ok(
        /^\d+$/.test(values["inspect-port"]) && inspectPort > 0 && inspectPort <= 65535 && inspectPort !== port
      );
    assert.equal(positionals.length, 1);
    const command = positionals[0];
    assert.ok(["up", "status", "logs", "stop", "_serve"].includes(command));
    if (command === "_serve") {
      assert.ok(process.send, "Internal supervisor requires IPC.");
      await supervise({ apiDir: await realpath(values["api-dir"]), port, inspectPort });
      return process.exitCode ?? 0;
    }
    assert.ok(inspectPort === undefined || command === "up", "Inspector is configured only at startup.");
    const result =
      command === "up"
        ? await up({ apiDir: await realpath(values["api-dir"]), port, inspectPort })
        : await control(port, command);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return ["ready", "passed", "stopped"].includes(result.status) ? 0 : 1;
  } catch {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "dev-service-unavailable", message: "Check arguments, Node 22, dependencies, port ownership and the dev-*/service.log and report.json files. Status/logs/stop address the service owned by this workspace and API port. A stale control socket after SIGKILL must be inspected and removed manually; never kill an unrelated listener." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
