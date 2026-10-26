import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { passedResults, runOfflineTests, sourceInputs } from "./gmx-api-offline-tests.mjs";
import { readNetworkAudit } from "./lib/agent-network-audit.mjs";

test("offline guard blocks Node transports and independently audits swallowed attempts", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-network-audit-"));
  const eventsFile = path.join(dir, "events.log");
  try {
    const guard = fileURLToPath(new URL("../tools/gmx-api-offline/network-guard.cjs", import.meta.url));
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `
      const assert = require('node:assert/strict');
      const verify = require(process.argv[1]).installNetworkGuard();
      delete process.env.GMX_AGENT_NETWORK_EVENTS_FILE;
      const attempts = [
        () => new (require('node:net').Socket)().connect(9, '127.0.0.1'),
        () => require('node:tls').connect(9, '127.0.0.1'),
        () => require('node:http').get('http://127.0.0.1:9'),
        () => require('node:https').request('https://127.0.0.1:9'),
        () => require('node:http2').connect('http://127.0.0.1:9'),
        () => require('node:dgram').createSocket('udp4'),
        () => require('node:dns').lookup('example.invalid'),
        () => require('node:dns').promises.resolve4('example.invalid'),
        () => fetch('http://127.0.0.1:9'),
      ];
      verify();
      for (const attempt of attempts) assert.throws(attempt, /Network access is forbidden/);
      assert.throws(verify, /attempted network access 9 time/);
      `,
        guard,
      ],
      { encoding: "utf8", timeout: 5000, env: { ...process.env, GMX_AGENT_NETWORK_EVENTS_FILE: eventsFile } }
    );
    assert.equal(result.status, 0, result.stderr);
    const audit = await readNetworkAudit(eventsFile, 1);
    assert.equal(audit.status, "failed");
    assert.equal(audit.installations, 1);
    assert.equal(audit.blockedAttempts, 9);
    for (const [content, status] of [
      ["installed\n", "passed"],
      ["installed\ninstalled\n", "failed"],
      ["installed\nunknown\n", "failed"],
      ["", "failed"],
    ]) {
      await writeFile(eventsFile, content);
      assert.equal((await readNetworkAudit(eventsFile, 1)).status, status);
    }
    await rm(eventsFile);
    assert.equal((await readNetworkAudit(eventsFile, 1)).status, "failed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("API offline results require exact unique files, executed assertions and a clean exit", () => {
  const suites = ["/api/src/a.test.ts", "/api/src/b.test.ts"];
  const result = {
    success: true,
    numTotalTestSuites: 2,
    numPassedTestSuites: 2,
    numPendingTests: 0,
    numTodoTests: 0,
    numPassedTests: 2,
    numTotalTests: 2,
    testResults: suites.map((name) => ({ name, status: "passed", assertionResults: [{ status: "passed" }] })),
  };
  const exit = { code: 0, signal: null };
  assert.equal(passedResults(result, suites, exit), true);
  for (const changed of [
    undefined,
    { ...result, success: false },
    { ...result, numTotalTestSuites: 1 },
    { ...result, numPassedTests: 0, numTotalTests: 0 },
    { ...result, numPendingTests: 1 },
    { ...result, numTodoTests: 1 },
    { ...result, testResults: [] },
    { ...result, testResults: [result.testResults[0], result.testResults[0]] },
    { ...result, testResults: [result.testResults[0], { ...result.testResults[1], name: "/api/src/other.test.ts" }] },
    { ...result, testResults: result.testResults.map((file) => ({ ...file, assertionResults: [] })) },
    {
      ...result,
      testResults: result.testResults.map((file) => ({ ...file, assertionResults: [{ status: "pending" }] })),
    },
  ])
    assert.equal(passedResults(changed, suites, exit), false);
  assert.equal(passedResults(result, suites, { ...exit, code: 1 }), false);
  assert.equal(passedResults(result, suites, { ...exit, signal: "SIGTERM" }), false);
});

test("API source identity detects dependency edits and added files beyond the selected suite", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-api-source-"));
  try {
    await mkdir(path.join(dir, "src"));
    for (const file of ["package.json", "yarn.lock", "tsconfig.json", "src/selected.test.ts", "src/dependency.ts"])
      await writeFile(path.join(dir, file), "original");
    const before = await sourceInputs(dir);
    await writeFile(path.join(dir, "src/dependency.ts"), "changed");
    assert.notEqual((await sourceInputs(dir)).sha256, before.sha256);
    await writeFile(path.join(dir, "src/dependency.ts"), "original");
    assert.deepEqual(await sourceInputs(dir), before);
    await writeFile(path.join(dir, "src/new.json"), "{}");
    assert.equal((await sourceInputs(dir)).fileCount, before.fileCount + 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("API debugging rejects invalid ports, multiple suites and occupied ports without taking ownership", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-api-debug-options-"));
  const server = net.createServer();
  try {
    await mkdir(path.join(dir, "src"));
    const suites = ["src/one.test.ts", "src/two.test.ts"];
    for (const suite of suites) await writeFile(path.join(dir, suite), "");
    for (const inspectPort of [0, -1, 65536, 1.5, NaN])
      await assert.rejects(runOfflineTests(dir, [suites[0]], { inspectPort }), /inspector port/);
    await assert.rejects(runOfflineTests(dir, suites, { inspectPort: 9239 }), /exactly one API suite/);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    await assert.rejects(runOfflineTests(dir, [suites[0]], { inspectPort: server.address().port }), {
      code: "EADDRINUSE",
    });
    assert.equal(server.listening, true);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
