import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { changedSources, passedResults, resolveRelated, resolveSuites, runSdkOffline } from "./sdk-offline-tests.mjs";

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

test("Git source selection includes committed, index, worktree and untracked changes without writing the checkout", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "gmx-changed-")));
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const sdkDir = path.join(root, "sdk");
  try {
    git("init", "--initial-branch=release");
    git("config", "user.name", "Selection Fixture");
    git("config", "user.email", "selection@example.invalid");
    git("config", "commit.gpgsign", "false");
    await mkdir(path.join(sdkDir, "src"), { recursive: true });
    for (const file of ["one", "removed"]) await writeFile(path.join(sdkDir, `src/${file}.ts`), "export {};\n");
    git("add", ".");
    git("commit", "-m", "Release fixture");
    const base = git("rev-parse", "HEAD");
    await assert.rejects(changedSources(sdkDir, base), /No changed source/);
    await writeFile(path.join(sdkDir, "src/one.ts"), "export const temporarilyChanged = true;\n");
    assert.deepEqual((await changedSources(sdkDir, base)).related, ["src/one.ts"]);
    await writeFile(path.join(sdkDir, "src/one.ts"), "export {};\n");
    await assert.rejects(changedSources(sdkDir, base), /No changed source/);
    await writeFile(path.join(sdkDir, "src/one.ts"), "export const value = 1;\n");
    git("add", ".");
    git("commit", "-m", "Feature fixture");
    await writeFile(path.join(sdkDir, "src/one.ts"), "export const value = 2;\n");
    await writeFile(path.join(sdkDir, "src/staged.ts"), "export {};\n");
    git("add", "sdk/src/staged.ts");
    await writeFile(path.join(sdkDir, "src/untracked.ts"), "export {};\n");
    const index = await readFile(path.join(root, ".git/index"));
    const selected = await changedSources(sdkDir, base);
    assert.equal(selected.baseSha, base);
    assert.equal(selected.sdkPrefix, "sdk/");
    assert.equal(selected.checkoutDir, root);
    assert.equal(selected.head, git("rev-parse", "HEAD"));
    assert.deepEqual(selected.related, ["src/one.ts", "src/staged.ts", "src/untracked.ts"]);
    assert.deepEqual(selected.indexPaths, ["sdk/src/one.ts", "sdk/src/staged.ts"]);
    assert.deepEqual(selected.untrackedPaths, ["sdk/src/untracked.ts"]);
    assert.deepEqual(await readFile(path.join(root, ".git/index")), index);
    await writeFile(path.join(root, "vite.config.ts"), "export {};\n");
    await assert.rejects(changedSources(sdkDir, base), /explicit --suite.*vite.config.ts/);
    await rm(path.join(root, "vite.config.ts"));
    await rm(path.join(sdkDir, "src/removed.ts"));
    await assert.rejects(changedSources(sdkDir, base), /deleted or is missing/);
    await assert.rejects(changedSources(sdkDir, "--help"));
    await assert.rejects(runSdkOffline({ sdkDir, changedSince: base, related: [] }), /Do not combine/);
    await assert.rejects(runSdkOffline({ sdkDir, changedSince: base, suites: [] }), /Do not combine/);
    await assert.rejects(runSdkOffline({ sdkDir, changedSince: base, inspectPort: 9238 }), /Use --suite/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
