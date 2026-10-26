import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { passedResults, resolveRelated, resolveSuites, runSdkOffline } from "./sdk-offline-tests.mjs";

test("SDK suite selection rejects missing, duplicate, escaped and symlinked paths", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-sdk-selection-"));
  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src/valid.spec.ts"), "");
    await writeFile(path.join(dir, "outside.spec.ts"), "");
    await symlink(path.join(dir, "outside.spec.ts"), path.join(dir, "src/link.spec.ts"));
    assert.deepEqual(await resolveSuites(dir, ["src/valid.spec.ts"]), ["src/valid.spec.ts"]);
    for (const suites of [
      [],
      ["src/missing.spec.ts"],
      ["src/valid.spec.ts", "src/valid.spec.ts"],
      ["src/../outside.spec.ts"],
      ["src/link.spec.ts"],
      ["src/*.spec.ts"],
      ["/src/valid.spec.ts"],
    ])
      await assert.rejects(resolveSuites(dir, suites));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("SDK results require exact selected files, executed passing tests and a clean process exit", () => {
  const suite = "/sdk/src/valid.spec.ts";
  const passed = {
    success: true,
    numPassedTests: 1,
    numTotalTests: 1,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [{ name: suite, status: "passed", assertionResults: [{ status: "passed" }] }],
  };
  assert.equal(passedResults(passed, [suite], { code: 0, signal: null }), true);
  for (const result of [
    undefined,
    { ...passed, success: false },
    { ...passed, numPassedTests: 0, numTotalTests: 0 },
    { ...passed, numPendingTests: 1 },
    { ...passed, numTodoTests: 1 },
    { ...passed, testResults: [] },
    { ...passed, testResults: [{ ...passed.testResults[0], name: "/sdk/src/other.spec.ts" }] },
    { ...passed, testResults: [{ ...passed.testResults[0], assertionResults: [] }] },
    { ...passed, testResults: [{ ...passed.testResults[0], assertionResults: [{ status: "failed" }] }] },
  ])
    assert.equal(passedResults(result, [suite], { code: 0, signal: null }), false);
  assert.equal(passedResults(passed, [suite], { code: 1, signal: null }), false);
  assert.equal(passedResults(passed, [suite], { code: 0, signal: "SIGTERM" }), false);
});

test("SDK debug rejects an occupied inspector port before starting tests and preserves its listener", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-sdk-debug-port-"));
  const listener = net.createServer();
  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src/valid.spec.ts"), "");
    await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
    await assert.rejects(
      runSdkOffline({ sdkDir: dir, suites: ["src/valid.spec.ts"], inspectPort: listener.address().port }),
      { code: "EADDRINUSE" }
    );
    assert.ok(listener.listening);
  } finally {
    await new Promise((resolve) => listener.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test("SDK related selection rejects ambiguous paths and symlink traversal", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-related-paths-"));
  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src/module.ts"), "export {};\n");
    await writeFile(path.join(dir, "outside.ts"), "export {};\n");
    await symlink(path.join(dir, "outside.ts"), path.join(dir, "src/external.ts"));
    await symlink(path.join(dir, "src/module.ts"), path.join(dir, "src/internal.ts"));
    const selected = ["src/module.ts"];
    assert.deepEqual(await resolveRelated(dir, selected), selected);
    await assert.rejects(runSdkOffline({ sdkDir: dir, suites: [], related: selected }), /Do not combine/);
    await assert.rejects(
      runSdkOffline({ sdkDir: dir, related: selected, inspectPort: 9238 }),
      /Use --suite for debugging/
    );
    for (const files of [
      undefined,
      [],
      ["src/module.ts", "src/module.ts"],
      ["src/missing.ts"],
      ["src/../outside.ts"],
      [path.join(dir, "src/module.ts")],
      ["src/*.ts"],
      ["src//module.ts"],
      ["src/external.ts"],
      ["src/internal.ts"],
    ])
      await assert.rejects(resolveRelated(dir, files));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
