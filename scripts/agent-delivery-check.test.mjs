import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { checkDelivery } from "./agent-delivery-check.mjs";

const exec = promisify(execFile);

test("real Git histories distinguish clean delivery from inherited or copied development changes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "gmx-delivery-"));
  const git = async (...args) => (await exec("git", args, { cwd })).stdout.trim();
  const commit = async (file, content, message) => {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
    await writeFile(path.join(cwd, file), content);
    await git("add", "--", file);
    await git("commit", "-m", message);
    return git("rev-parse", "HEAD");
  };
  try {
    await git("init", "--initial-branch=release");
    await git("config", "user.name", "Delivery Fixture");
    await git("config", "user.email", "delivery-fixture@example.invalid");
    await git("config", "commit.gpgsign", "false");
    await commit("shared.txt", "base\n", "Release base");
    const baseSha = await git("rev-parse", "HEAD");
    await git("checkout", "-b", "development");
    const infrastructure = await commit("tools/local.txt", "personal infrastructure\n", "Personal tools");
    await git("checkout", "-b", "clean", "release");
    await commit("feature with spaces.txt", "feature\n", "Feature delivery");
    const options = {
      cwd,
      base: "release",
      developmentBase: "development",
      head: "clean",
      allowPaths: ["feature with spaces.txt"],
    };
    const clean = await checkDelivery(options);
    assert.equal(clean.status, "passed");
    assert.equal(clean.refs.base.sha, baseSha);
    assert.deepEqual(clean.changedPaths, ["feature with spaces.txt"]);
    assert.equal((await checkDelivery({ ...options, expectedBase: baseSha })).status, "passed");
    const strict = { ...options, requireClean: true };
    assert.equal((await checkDelivery(strict)).worktree.status, "passed");
    assert.equal(clean.worktree.status, "not-checked");
    await writeFile(path.join(cwd, ".git/info/exclude"), "ignored-build/\n");
    await mkdir(path.join(cwd, "ignored-build"));
    await writeFile(path.join(cwd, "ignored-build/output.txt"), "ignored artifact");
    assert.equal((await checkDelivery(strict)).status, "passed");
    const unusual = "untracked space\nand-unicode-文件.txt";
    await writeFile(path.join(cwd, "feature with spaces.txt"), "staged");
    await git("add", "--", "feature with spaces.txt");
    assert.equal((await checkDelivery(strict)).status, "blocked");
    await writeFile(path.join(cwd, unusual), "untracked");
    await writeFile(path.join(cwd, "feature with spaces.txt"), "unstaged");
    const indexBefore = await readFile(path.join(cwd, ".git/index"));
    const dirty = await checkDelivery(strict);
    assert.equal(dirty.status, "blocked");
    assert.deepEqual(dirty.worktree.stagedPaths, ["feature with spaces.txt"]);
    assert.deepEqual(dirty.worktree.unstagedPaths, ["feature with spaces.txt"]);
    assert.deepEqual(dirty.worktree.untrackedPaths, [unusual]);
    assert.deepEqual(await readFile(path.join(cwd, ".git/index")), indexBefore);
    assert.equal(await git("rev-parse", "HEAD"), dirty.refs.head.sha);
    assert.equal(await readFile(path.join(cwd, "feature with spaces.txt"), "utf8"), "unstaged");
    assert.equal(await readFile(path.join(cwd, unusual), "utf8"), "untracked");
    assert.equal((await checkDelivery(options)).status, "passed");
    await git("restore", "--staged", "--", "feature with spaces.txt");
    await rm(path.join(cwd, unusual));
    assert.equal((await checkDelivery(strict)).status, "blocked");
    await git("restore", "--worktree", "--", "feature with spaces.txt");
    await writeFile(path.join(cwd, unusual), "untracked");
    assert.equal((await checkDelivery(strict)).status, "blocked");
    await rm(path.join(cwd, unusual));
    const mismatch = await checkDelivery({ ...strict, head: "release" });
    assert.ok(mismatch.findings.some((finding) => finding.code === "worktree-head-mismatch"));
    const codes = async (overrides) =>
      (await checkDelivery({ ...options, ...overrides })).findings.map((finding) => finding.code);
    assert.ok((await codes({ expectedBase: "0".repeat(40) })).includes("base-sha-mismatch"));
    assert.ok((await codes({ allowPaths: ["other.txt"] })).includes("unexpected-paths"));
    assert.ok((await codes({ head: "release" })).includes("empty-delivery"));
    assert.ok(
      (await codes({ head: "development", allowPaths: ["tools/local.txt"] })).includes("development-base-history")
    );
    await git("cherry-pick", infrastructure);
    const copied = await codes({ allowPaths: ["feature with spaces.txt", "tools/local.txt"] });
    assert.ok(copied.includes("development-base-patch"));
    assert.ok(!copied.includes("development-base-history"));
    await git("checkout", "-b", "merged", "release");
    await git("merge", "--no-ff", "development", "-m", "Incorrectly merge personal base");
    assert.ok((await codes({ head: "merged", allowPaths: ["tools/local.txt"] })).includes("development-base-history"));
    await git("checkout", "release");
    await commit("upstream.txt", "new release\n", "Advance release");
    assert.ok((await codes({ head: "clean" })).includes("release-not-ancestor"));
    await assert.rejects(checkDelivery({ ...options, head: "missing-ref" }));
    for (const allowPaths of [[], ["../outside"], ["/absolute"], ["src/*"], ["a", "a"], ["a/../b"]])
      await assert.rejects(checkDelivery({ ...options, allowPaths }));
    const before = await git("status", "--porcelain");
    const headBefore = await readFile(path.join(cwd, ".git/HEAD"), "utf8");
    await checkDelivery({ ...options, head: "merged" });
    assert.equal(await git("status", "--porcelain"), before);
    assert.equal(await readFile(path.join(cwd, ".git/HEAD"), "utf8"), headBefore);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
