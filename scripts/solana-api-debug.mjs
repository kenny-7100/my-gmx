import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { InspectorClient } from "./lib/agent-inspector.mjs";
import { control } from "./solana-api-dev.mjs";
import { readApiSource } from "./solana-api-local.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
const ADDRESS = "11111111111111111111111111111111";
const SOURCE = "src/solanaApp.ts";

export function mapSource(script, expectedFile, source) {
  assert.equal(script.url, pathToFileURL(expectedFile).href, "Loaded script is from another checkout.");
  const prefix = "data:application/json;base64,";
  assert.ok(script.sourceMapURL?.startsWith(prefix), "Expected tsx inline source map.");
  const payload = JSON.parse(Buffer.from(script.sourceMapURL.slice(prefix.length), "base64").toString());
  const index = payload.sources.findIndex((file) => file === expectedFile || file === pathToFileURL(expectedFile).href);
  assert.ok(index >= 0, "Source map does not identify the expected file.");
  assert.equal(payload.sourcesContent[index], source, "Loaded source does not match the checkout.");
  return new SourceMap(payload);
}

export function handlerLine(source) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes('router.get("/positions",'));
  assert.ok(start >= 0, "Positions handler not found; review the debug scenario after API changes.");
  const line = lines.findIndex(
    (text, index) => index > start && text.trim() === "requireSolanaAddress(req.query.address);"
  );
  assert.equal(line, start + 1, "Positions handler changed; review the debug scenario.");
  return line;
}

export async function debugApi({ apiDir, port, attach = false, inspectPort = 9237 }) {
  const root = path.join(ROOT, ".local/acceptance/solana-api-local");
  await mkdir(root, { recursive: true });
  const runDir = await mkdtemp(path.join(root, "debug-"));
  const reportFile = path.join(runDir, "report.json");
  const report = {
    schemaVersion: 1,
    status: "failed",
    scope: "local-sample-api-source-debugging",
    startedAt: new Date().toISOString(),
    apiDir,
    port,
    ownership: attach ? "borrowed" : "owned",
    reportFile,
    checks: [],
    cleanup: {},
    businessAcceptance: "not-run",
  };
  let service;
  let client;
  let breakpointId;
  let stage = "service";
  const abort = new AbortController();
  const interrupted = () => abort.abort(new Error("Debug check interrupted."));
  process.on("SIGINT", interrupted);
  process.on("SIGTERM", interrupted);
  try {
    if (attach) service = await control(port, "status");
    else {
      const { stdout } = await execute(
        process.execPath,
        [
          path.join(ROOT, "scripts/solana-api-dev.mjs"),
          "up",
          "--api-dir",
          apiDir,
          "--port",
          String(port),
          "--inspect-port",
          String(inspectPort),
        ],
        { timeout: 40000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH } }
      );
      service = JSON.parse(stdout);
    }
    abort.signal.throwIfAborted();
    assert.equal(service.status, "ready");
    assert.equal(service.apiDir, apiDir, "Managed service checkout mismatch.");
    assert.equal(service.mode, "sample");
    assert.match(service.inspector, /^127\.0\.0\.1:\d+$/);
    report.service = { supervisorPid: service.supervisorPid, inspector: service.inspector, logFile: service.logFile };
    report.sourceBefore = (await readApiSource(apiDir)).evidence;
    stage = "inspector-connect";
    const response = await fetch(`http://${service.inspector}/json/list`, {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(3000)]),
    });
    assert.equal(response.status, 200);
    const targets = (await response.json()).filter((target) => target.type === "node");
    assert.equal(targets.length, 1, "Expected one Node debug target.");
    const target = new URL(targets[0].webSocketDebuggerUrl);
    assert.equal(target.protocol, "ws:");
    assert.equal(target.host, service.inspector, "Inspector target must use the managed loopback endpoint.");
    client = new InspectorClient(target.href);
    await client.connect();
    await client.send("Debugger.enable");
    report.checks.push("inspector-connected");
    stage = "source-map";
    const sourceFile = path.join(apiDir, SOURCE);
    const source = await readFile(sourceFile, "utf8");
    const scripts = [...client.scripts.values()].filter((script) => script.url === pathToFileURL(sourceFile).href);
    assert.equal(scripts.length, 1, "Expected one loaded API source script.");
    const script = scripts[0];
    const map = mapSource(script, sourceFile, source);
    const line = handlerLine(source);
    const { locations } = await client.send("Debugger.getPossibleBreakpoints", {
      start: { scriptId: script.scriptId, lineNumber: 0 },
      end: { scriptId: script.scriptId, lineNumber: script.endLine, columnNumber: script.endColumn },
    });
    const location = locations.find((entry) => {
      const mapped = map.findEntry(entry.lineNumber, entry.columnNumber);
      return mapped.originalLine === line;
    });
    assert.ok(location, "No executable location maps to the expected handler line.");
    report.sourceLocation = { file: SOURCE, line: line + 1, sha256: createHash("sha256").update(source).digest("hex") };
    report.checks.push("loaded-source-matches-checkout");
    const traceId = `agent-debug-${randomUUID()}`;
    ({ breakpointId } = await client.send("Debugger.setBreakpoint", {
      location: { scriptId: script.scriptId, lineNumber: location.lineNumber, columnNumber: location.columnNumber },
      condition: `req.get("X-Trace-Id") === ${JSON.stringify(traceId)}`,
    }));
    for (const [name, address, status] of [
      ["valid-address", ADDRESS, 200],
      ["invalid-address", "invalid", 400],
    ]) {
      stage = `breakpoint:${name}`;
      const event = client.waitFor("Debugger.paused");
      const request = fetch(`http://127.0.0.1:${port}/v1/positions?address=${address}`, {
        headers: { "X-Trace-Id": traceId },
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
      }).then(async (res) => ({ status: res.status, body: await res.json() }));
      request.catch(() => undefined);
      try {
        const paused = await Promise.race([
          event.promise,
          request.then(() => {
            throw new Error("Request completed without hitting the breakpoint.");
          }),
        ]);
        assert.ok(paused.hitBreakpoints.includes(breakpointId), "Unexpected debugger pause.");
        const frame = paused.callFrames[0];
        assert.equal(frame.location.scriptId, script.scriptId);
        assert.equal(map.findEntry(frame.location.lineNumber, frame.location.columnNumber).originalLine, line);
        const local = await client.send("Debugger.evaluateOnCallFrame", {
          callFrameId: frame.callFrameId,
          expression: "({ address: req.query.address, method: req.method, path: req.path })",
          returnByValue: true,
          silent: true,
          throwOnSideEffect: true,
        });
        assert.ok(!local.exceptionDetails, "Local variable evaluation failed.");
        assert.deepEqual(local.result.value, { address, method: "GET", path: "/positions" });
        report.checks.push({
          name,
          status: "paused-and-inspected",
          local: local.result.value,
          stackDepth: paused.callFrames.length,
          stack: paused.callFrames.slice(0, 5).map((entry) => ({
            functionName: entry.functionName,
            script: client.scripts.get(entry.location.scriptId)?.url,
            generatedLine: entry.location.lineNumber + 1,
          })),
          source: report.sourceLocation,
        });
      } finally {
        event.cancel();
        if (client.paused) await client.send("Debugger.resume");
      }
      const result = await request;
      assert.equal(result.status, status);
      if (status === 200) assert.deepEqual(result.body, (await readApiSource(apiDir)).samples.positions);
      else assert.deepEqual(result.body, { message: "Invalid address: invalid" });
      report.checks.push({ name: `http:${name}`, status: result.status, resumed: true });
    }
    stage = "source-unchanged";
    report.sourceAfter = (await readApiSource(apiDir)).evidence;
    assert.deepEqual(report.sourceAfter, report.sourceBefore, "API source changed during the check.");
    abort.signal.throwIfAborted();
    report.checks.push("api-source-unchanged");
    report.status = "passed";
  } catch (error) {
    abort.abort();
    report.failureStage = stage;
    report.error = { name: error.name, message: error.message.split("\n")[0].slice(0, 240) };
  } finally {
    if (client) {
      try {
        if (breakpointId) await client.send("Debugger.removeBreakpoint", { breakpointId });
        if (client.paused) await client.send("Debugger.resume");
        if (client.socket.readyState === WebSocket.OPEN) await client.send("Debugger.disable");
        await client.close();
        report.cleanup.debugger = "passed";
      } catch {
        report.cleanup.debugger = "failed";
        report.status = "failed";
        client.socket.close();
      }
    } else report.cleanup.debugger = "not-connected";
    if (service && !attach) {
      try {
        const current = await control(port, "status");
        assert.equal(current.supervisorPid, service.supervisorPid, "Service ownership changed.");
        const stopped = await control(port, "stop");
        assert.equal(stopped.status, "stopped");
        report.cleanup.service = "stopped-owned";
      } catch {
        report.cleanup.service = "failed";
        report.status = "failed";
      }
    } else report.cleanup.service = attach ? "preserved-borrowed" : "not-started";
    report.finishedAt = new Date().toISOString();
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  return report;
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        port: { type: "string", default: "3017" },
        "inspect-port": { type: "string", default: "9237" },
        attach: { type: "boolean", default: false },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:api-debug [--api-dir PATH] [--port 3017] [--inspect-port 9237] [--attach]\nStarts and stops an owned sample API by default. --attach requires an existing managed API with inspector enabled and preserves it. Checks real source breakpoints, local variables and HTTP resume; no business source edits or wallet access.\n"
      );
      return 0;
    }
    for (const value of [values.port, values["inspect-port"]])
      assert.ok(/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535);
    assert.notEqual(values.port, values["inspect-port"]);
    const result = await debugApi({
      apiDir: await realpath(values["api-dir"]),
      port: Number(values.port),
      inspectPort: Number(values["inspect-port"]),
      attach: values.attach,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === "passed" ? 0 : 1;
  } catch {
    process.stderr.write("Debug check configuration failed. Use --help and check the API checkout.\n");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
