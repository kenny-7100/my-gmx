import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { changedSources, discoverApiTests, resolveApiRelated } from "./gmx-api-discover-tests.mjs";

test("API related selection rejects ambiguous paths and symlink traversal", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-related-paths-"));
  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src/module.ts"), "export {};\n");
    await writeFile(path.join(dir, "outside.ts"), "export {};\n");
    await symlink(path.join(dir, "outside.ts"), path.join(dir, "src/external.ts"));
    await symlink(path.join(dir, "src/module.ts"), path.join(dir, "src/internal.ts"));
    const selected = ["src/module.ts"];
    assert.deepEqual(await resolveApiRelated(dir, selected), selected);
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
      await assert.rejects(resolveApiRelated(dir, files));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Git source selection includes committed, index, worktree and untracked changes without writing the checkout", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gmx-changed-"));
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init", "--initial-branch=release");
    git("config", "user.name", "Selection Fixture");
    git("config", "user.email", "selection@example.invalid");
    git("config", "commit.gpgsign", "false");
    await mkdir(path.join(root, "src"));
    for (const file of ["one", "removed"]) await writeFile(path.join(root, `src/${file}.ts`), "export {};\n");
    git("add", ".");
    git("commit", "-m", "Release fixture");
    const base = git("rev-parse", "HEAD");
    await assert.rejects(changedSources(root, base), /No changed source/);
    await writeFile(path.join(root, "src/one.ts"), "export const temporarilyChanged = true;\n");
    assert.deepEqual((await changedSources(root, base)).related, ["src/one.ts"]);
    await writeFile(path.join(root, "src/one.ts"), "export {};\n");
    await assert.rejects(changedSources(root, base), /No changed source/);
    await writeFile(path.join(root, "src/one.ts"), "export const value = 1;\n");
    git("add", ".");
    git("commit", "-m", "Feature fixture");
    await writeFile(path.join(root, "src/one.ts"), "export const value = 2;\n");
    await writeFile(path.join(root, "src/staged.ts"), "export {};\n");
    git("add", "src/staged.ts");
    await writeFile(path.join(root, "src/untracked.ts"), "export {};\n");
    const index = await readFile(path.join(root, ".git/index"));
    const selected = await changedSources(root, base);
    assert.equal(selected.baseSha, base);
    assert.equal(selected.head, git("rev-parse", "HEAD"));
    assert.deepEqual(selected.related, ["src/one.ts", "src/staged.ts", "src/untracked.ts"]);
    assert.deepEqual(selected.indexPaths, ["src/one.ts", "src/staged.ts"]);
    assert.deepEqual(selected.untrackedPaths, ["src/untracked.ts"]);
    assert.deepEqual(await readFile(path.join(root, ".git/index")), index);
    await writeFile(path.join(root, "jest.config.ts"), "export {};\n");
    await assert.rejects(changedSources(root, base), /explicit --related.*jest.config.ts/);
    await rm(path.join(root, "jest.config.ts"));
    await rm(path.join(root, "src/removed.ts"));
    await assert.rejects(changedSources(root, base), /deleted or is missing/);
    await assert.rejects(changedSources(root, "--help"));
    await assert.rejects(discoverApiTests({ apiDir: root, changedSince: base, related: [] }), /Do not combine/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
