import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const DEFAULT_API_DIR = fileURLToPath(new URL("../gmx-api", import.meta.url));
const SAMPLE_ROUTES = ["markets/config", "markets/values", "positions", "orders", "fee-discount"];
const ADDRESS = "11111111111111111111111111111111";

export async function readApiSource(apiDir) {
  const files = [
    "src/index.ts",
    "src/solanaApp.ts",
    "src/solanaBootstrap.ts",
    "tsconfig.json",
    "package.json",
    "yarn.lock",
  ];
  const samples = {};
  const hashes = {};
  for (const route of SAMPLE_ROUTES) files.push(`src/domain/solana/samples/${route.replace("/", "-")}.json`);
  for (const file of files) {
    const bytes = await readFile(path.join(apiDir, file));
    hashes[file] = createHash("sha256").update(bytes).digest("hex");
    if (file.endsWith(".json") && file.includes("/samples/")) samples[path.basename(file, ".json")] = JSON.parse(bytes);
  }
  const git = (...args) =>
    execFileSync("git", ["-C", apiDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return {
    samples,
    evidence: { commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain").length > 0, sha256: hashes },
  };
}

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      reject(Object.assign(new Error("Port is occupied."), { code: "EADDRINUSE" }));
    });
    socket.once("error", (error) => (error.code === "ECONNREFUSED" ? resolve() : reject(error)));
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error("Port probe timed out."));
    });
  });
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export async function startApi({ apiDir, port }) {
  const runner = path.join(apiDir, "node_modules/tsx/dist/cli.mjs");
  await access(runner);
  const { evidence } = await readApiSource(apiDir);
  await requireFreePort(port);
  // dotenv reads the working directory; use an empty one and pass no wallet or backend secrets.
  const cwd = await mkdtemp(path.join(tmpdir(), "gmx-solana-api-"));
  const child = spawn(
    process.execPath,
    [runner, "--tsconfig", path.join(apiDir, "tsconfig.json"), path.join(apiDir, "src/index.ts")],
    {
      cwd,
      env: {
        PATH: process.env.PATH,
        TMPDIR: tmpdir(),
        NODE_ENV: "development",
        LAUNCH_MODE: "solana",
        PORT: String(port),
        APP_ROOT: apiDir,
        COMMIT_HASH: evidence.commit,
      },
      stdio: "inherit",
    }
  );
  let killTimer;
  const stop = () => {
    child.kill("SIGTERM");
    if (!killTimer) killTimer = setTimeout(() => child.kill("SIGKILL"), 5000).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    process.stdout.write(
      `${JSON.stringify({ status: "starting", mode: "sample", url: `http://127.0.0.1:${port}`, source: evidence })}\n`
    );
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(signal ? 1 : code));
    });
    if (code !== 0) throw new Error("API process exited unsuccessfully. Check the preceding service logs.");
  } finally {
    clearTimeout(killTimer);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await rm(cwd, { recursive: true, force: true });
  }
}

export async function verifyApi({ apiDir, port, fetchImpl = fetch }) {
  const { samples, evidence } = await readApiSource(apiDir);
  const baseUrl = `http://127.0.0.1:${port}`;
  const checks = [];
  let check = "ping";
  try {
    const request = async (route, expectedStatus = 200, options = {}) => {
      check = route.split("?")[0];
      const response = await fetchImpl(`${baseUrl}${route}`, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, expectedStatus, `Unexpected HTTP status for ${route}`);
      return response;
    };
    assert.equal(await (await request("/ping")).text(), "pong", "Unexpected ping response");
    checks.push("ping");
    for (const route of SAMPLE_ROUTES) {
      const before = Date.now();
      const response = await request(`/v1/${route}${route.includes("/") ? "" : `?address=${ADDRESS}`}`, 200, {
        headers: { Origin: "http://localhost:3010" },
      });
      assert.equal(response.headers.get("access-control-allow-origin"), "*", `Missing CORS header for ${route}`);
      let actual = await response.json();
      const expected = samples[route.replace("/", "-")];
      if (route === "markets/values") {
        assert.ok(Array.isArray(actual) && actual.length > 0, "Market values must be a nonempty sample array");
        actual = actual.map((market) => {
          assert.ok(
            Number.isSafeInteger(market.updatedAt) && market.updatedAt >= before && market.updatedAt <= Date.now(),
            "Market updatedAt must be refreshed by the local stub"
          );
          const { updatedAt: _updatedAt, ...rest } = market;
          return rest;
        });
        assert.deepEqual(
          actual,
          expected.map(({ updatedAt: _updatedAt, ...rest }) => rest),
          `Sample mismatch for ${route}`
        );
      } else {
        assert.deepEqual(actual, expected, `Sample mismatch for ${route}`);
      }
      checks.push(`sample:${route}`);
    }
    for (const route of ["positions", "orders", "fee-discount"]) {
      for (const query of ["", "?address=invalid-address"]) {
        const body = await (await request(`/v1/${route}${query}`, 400)).json();
        assert.equal(typeof body.message, "string", "Missing validation error message");
        checks.push(`reject:${route}${query ? ":invalid" : ":missing"}`);
      }
    }
    await request("/v1/agent-unknown-route", 404);
    checks.push("unknown-route");
    const preflight = await request("/v1/positions", 204, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3010", "Access-Control-Request-Method": "GET" },
    });
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*", "Missing preflight CORS header");
    checks.push("cors-preflight");
    return {
      status: "passed",
      mode: "sample",
      checkedAt: new Date().toISOString(),
      baseUrl,
      expectedSource: evidence,
      checks,
    };
  } catch (error) {
    throw Object.assign(new Error("Local API verification failed."), {
      code: error?.code === "ERR_ASSERTION" ? "response-mismatch" : "request-failed",
      check,
    });
  }
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        "api-dir": { type: "string", default: DEFAULT_API_DIR },
        port: { type: "string", default: "3004" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn solana:api-local <start|verify> [--api-dir PATH] [--port 3004]\nRuns or checks the existing gmx-api Solana sample service. No real chain data, signing or transactions.\n"
      );
      return 0;
    }
    const port = Number(values.port);
    if (
      positionals.length !== 1 ||
      !["start", "verify"].includes(positionals[0]) ||
      !/^\d+$/.test(values.port) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    )
      throw new Error("Expected start or verify and a port between 1 and 65535.");
    const options = { apiDir: path.resolve(values["api-dir"]), port };
    if (positionals[0] === "start") await startApi(options);
    else process.stdout.write(`${JSON.stringify(await verifyApi(options), null, 2)}\n`);
    return 0;
  } catch (error) {
    // Never print response bodies, caller input or raw filesystem/network errors.
    const messages = {
      "port-in-use": "Selected port is already in use. Stop the owner or select another port.",
      "missing-prerequisite":
        "Required API source or installed dependencies are missing. See docs/solana-api-local.md.",
      "response-mismatch": "Local API response did not match the expected sample behavior.",
      "request-failed": "Local API request failed. Check that the service is running on the selected port.",
      "check-failed": "Check API source, dependencies, command arguments and preceding service logs.",
    };
    const code =
      error?.code === "EADDRINUSE"
        ? "port-in-use"
        : error?.code === "ENOENT"
          ? "missing-prerequisite"
          : ["response-mismatch", "request-failed"].includes(error?.code)
            ? error.code
            : "check-failed";
    process.stderr.write(
      `${JSON.stringify({
        status: "failed",
        mode: "sample",
        code,
        check: error?.check,
        message: messages[code],
      })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
