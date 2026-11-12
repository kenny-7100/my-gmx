import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { infrastructureOnly } from "./agent-infrastructure-scope.mjs";
import { withWorkflowLock, writeRecord } from "./agent-workflow-state.mjs";
import { workflow } from "./agent-workflow.mjs";

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec("git", args, { cwd })).stdout.trim();
async function commit(cwd, file, content) {
  await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
  await writeFile(path.join(cwd, file), content);
  await git(cwd, "add", "--", file);
  await git(cwd, "commit", "-m", `Update ${file}`);
  return git(cwd, "rev-parse", "HEAD");
}
async function fixture(run) {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-workflow-"));
  const root = path.join(dir, "personal");
  const remote = path.join(dir, "upstream.git");
  await mkdir(root);
  try {
    await git(root, "init", "--initial-branch=release");
    await git(root, "config", "user.name", "Workflow Fixture");
    await git(root, "config", "user.email", "workflow@example.invalid");
    await git(root, "config", "commit.gpgsign", "false");
    await git(root, "config", "core.hooksPath", "/dev/null");
    await commit(root, "src/base.ts", "export const base = 1;\n");
    await git(root, "init", "--bare", remote);
    await git(root, "remote", "add", "origin", remote);
    await git(root, "push", "origin", "release");
    await git(root, "switch", "-c", "solana-integration");
    await commit(root, "docs/setup.md", "Personal environment\n");
    const dev = path.join(dir, "feature");
    const options = { projectDir: root, issue: "FESOL-123" };
    await workflow({ ...options, command: "start", branch: "feature-fesol-123", worktree: dev });
    await run({ dir, root, dev, options });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("real dual-path delivery returns knowledge and transfers only business onto advanced release", async () => {
  await fixture(async ({ dir, root, dev, options }) => {
    const infra = await commit(dev, "docs/lesson.md", "A reusable lesson\n");
    const business = await commit(dev, "src/feature.ts", "export const feature = 2;\n");
    await workflow({
      ...options,
      command: "note",
      context: {
        next: "Prepare delivery",
        verification: { head: business, worktree: dev, command: "fixture validation", result: "passed" },
      },
    });
    await workflow({ ...options, command: "backflow", commits: [infra] });
    assert.equal(await readFile(path.join(root, "docs/lesson.md"), "utf8"), "A reusable lesson\n");
    await assert.rejects(readFile(path.join(root, "src/feature.ts")), { code: "ENOENT" });
    const returned = await git(root, "rev-parse", "HEAD");
    await workflow({ ...options, command: "backflow", commits: [infra] });
    assert.equal(await git(root, "rev-parse", "HEAD"), returned);
    const upstream = path.join(dir, "upstream");
    await git(root, "worktree", "add", upstream, "release");
    const release = await commit(upstream, "src/new-upstream.ts", "export const upstream = 3;\n");
    await git(upstream, "push", "origin", "release");
    const delivery = path.join(dir, "delivery");
    for (const target of [
      { branch: "solana-integration", worktree: delivery },
      { branch: "unused", worktree: root },
    ]) {
      await assert.rejects(
        workflow({ ...options, command: "deliver", ...target, commits: [business] }),
        /already exists/
      );
      assert.equal((await workflow({ ...options, command: "status" })).record.pending, undefined);
    }
    const result = await workflow({
      ...options,
      command: "deliver",
      branch: "delivery-fesol-123",
      worktree: delivery,
      commits: [business],
    });
    assert.equal(result.record.delivery.base, release);
    assert.equal(await git(delivery, "rev-list", "--count", `${release}..HEAD`), "1");
    assert.equal(await git(delivery, "diff", "--name-only", `${release}...HEAD`), "src/feature.ts");
    await assert.rejects(readFile(path.join(delivery, "docs/lesson.md")), { code: "ENOENT" });
    assert.equal(await git(root, "branch", "--show-current"), "solana-integration");
    const status = await workflow({ ...options, command: "status" });
    assert.equal(status.record.delivery.worktree, delivery);
    assert.equal(status.record.delivery.remote, "my-gmx-pr");
    assert.equal(status.resume.authority.worktree, delivery);
    assert.equal(status.resume.verificationCurrent, false);
    assert.equal(status.resume.contextNeedsReview, true);
    await assert.rejects(
      workflow({
        ...options,
        command: "note",
        context: {
          verification: {
            head: business,
            worktree: dev,
            command: "old workspace validation",
            result: "passed",
          },
        },
      }),
      /actual task HEAD|authoritative task workspace/
    );
    assert.equal(status.record.pending, undefined);
    await assert.rejects(
      workflow({
        ...options,
        command: "deliver",
        branch: "another",
        worktree: path.join(dir, "another"),
        commits: [business],
      }),
      /already exists/
    );
  });
});

test("mixed commits, dirty base, foreign commits and gitlinks are refused before transfer", async () => {
  await fixture(async ({ dir, root, dev, options }) => {
    const business = await commit(dev, "src/feature.ts", "feature\n");
    const foreign = await commit(root, "docs/foreign.md", "Another task\n");
    await assert.rejects(workflow({ ...options, command: "backflow", commits: [foreign] }), /outside this task/);
    await git(root, "revert", "--no-edit", foreign);
    const unchanged = await git(root, "rev-parse", "HEAD");
    await assert.rejects(workflow({ ...options, command: "backflow", commits: [business] }), /misclassified/);
    const infra = await commit(dev, "docs/lesson.md", "lesson\n");
    await writeFile(path.join(root, "uncommitted.txt"), "keep\n");
    await assert.rejects(workflow({ ...options, command: "backflow", commits: [infra] }), /dirty/);
    assert.equal(await git(root, "rev-parse", "HEAD"), unchanged);
    await rm(path.join(root, "uncommitted.txt"));
    await writeFile(path.join(dev, "docs/mixed.md"), "mixed\n");
    await writeFile(path.join(dev, "src/mixed.ts"), "mixed\n");
    await git(dev, "add", ".");
    await git(dev, "commit", "-m", "Mixed commit");
    const mixed = await git(dev, "rev-parse", "HEAD");
    for (const command of ["backflow", "deliver"]) {
      await assert.rejects(
        workflow({ ...options, command, branch: "bad", worktree: path.join(dir, "bad"), commits: [mixed] }),
        /misclassified/
      );
    }
    await git(dev, "update-index", "--add", "--cacheinfo", `160000,${infra},tools/reference`);
    await git(dev, "commit", "-m", "Reference gitlink");
    await assert.rejects(
      workflow({ ...options, command: "backflow", commits: [await git(dev, "rev-parse", "HEAD")] }),
      /gitlinks/
    );
    assert.equal(await git(root, "rev-parse", "HEAD"), unchanged);
  });
});

test("conflicting upstream sync does not enter a merge in the personal checkout", async () => {
  await fixture(async ({ dir, root, options }) => {
    await commit(root, "src/base.ts", "local divergence\n");
    const before = await git(root, "rev-parse", "HEAD");
    const upstream = path.join(dir, "upstream");
    await git(root, "worktree", "add", upstream, "release");
    await commit(upstream, "src/base.ts", "upstream divergence\n");
    await git(upstream, "push", "origin", "release");
    await assert.rejects(workflow({ ...options, command: "sync" }));
    assert.equal(await git(root, "rev-parse", "HEAD"), before);
    assert.equal(await git(root, "status", "--porcelain"), "");
    await assert.rejects(git(root, "rev-parse", "--verify", "MERGE_HEAD"));
  });
});

test("cherry-pick conflicts preserve the working branch and a recoverable task location", async () => {
  await fixture(async ({ root, dev, options }) => {
    await commit(root, "docs/setup.md", "base update\n");
    const infra = await commit(dev, "docs/setup.md", "incompatible lesson\n");
    await assert.rejects(workflow({ ...options, command: "backflow", commits: [infra] }));
    const { record } = await workflow({ ...options, command: "status" });
    assert.equal(record.pending.command, "backflow");
    assert.equal(record.pending.target, await realpath(root));
    assert.match(await git(root, "status", "--porcelain"), /UU docs\/setup.md/);
    assert.equal(await git(dev, "status", "--porcelain"), "");
    await git(root, "cherry-pick", "--abort");
    await assert.rejects(workflow({ ...options, command: "backflow", commits: [infra] }), /pending/);
    const restored = await workflow({
      ...options,
      command: "recover",
      outcome: "aborted",
      head: await git(root, "rev-parse", "HEAD"),
    });
    assert.equal(restored.record.pending, undefined);
    assert.equal(restored.record.lastRecovery.outcome, "aborted");
  });
});

test("infrastructure commit fast path excludes business, shared configuration, empty index and gitlinks", async () => {
  await fixture(async ({ dev }) => {
    assert.equal(infrastructureOnly(dev), false);
    await writeFile(path.join(dev, "docs/setup.md"), "Updated knowledge\n");
    await git(dev, "add", "docs/setup.md");
    assert.equal(infrastructureOnly(dev), true);
    for (const file of ["src/base.ts", "package.json"]) {
      await writeFile(path.join(dev, file), "Mixed change\n");
      await git(dev, "add", file);
      assert.equal(infrastructureOnly(dev), false);
      await git(dev, "reset", "--", file);
    }
    const head = await git(dev, "rev-parse", "HEAD");
    await git(dev, "update-index", "--add", "--cacheinfo", `160000,${head},tools/reference`);
    assert.equal(infrastructureOnly(dev), false);
  });
});

test("task context resumes across worktrees and reports new knowledge without moving the development branch", async () => {
  await fixture(async ({ root, dev, options }) => {
    const head = await git(dev, "rev-parse", "HEAD");
    const context = {
      objective: "Refresh affected orders",
      acceptance: ["Order status updates after execution"],
      decisions: ["Keep the shared data flow"],
      blockers: [],
      next: "Check the cancellation path",
      verification: { head, worktree: dev, command: "node --test selected.test.mjs", result: "passed" },
    };
    await workflow({ ...options, command: "note", context });
    await commit(root, "docs/new-guidance.md", "Use the current tools from the base checkout\n");
    const status = await workflow({ ...options, projectDir: dev, command: "status" });
    assert.equal(status.record.context.objective, context.objective);
    assert.equal(status.resume.verificationCurrent, true);
    assert.ok(status.resume.knowledge.paths.includes("docs/new-guidance.md"));
    assert.equal(await git(dev, "rev-parse", "HEAD"), head);
    await writeFile(path.join(dev, "src/uncommitted.ts"), "unfinished\n");
    assert.equal((await workflow({ ...options, command: "status" })).resume.verificationCurrent, false);
    await assert.rejects(
      workflow({ ...options, command: "note", context: { verification: context.verification } }),
      /dirty/
    );
    await rm(path.join(dev, "src/uncommitted.ts"));
    await commit(dev, "src/follow-up.ts", "follow-up\n");
    assert.equal((await workflow({ ...options, command: "status" })).resume.verificationCurrent, false);
    await assert.rejects(
      workflow({ ...options, command: "note", context: { verification: context.verification } }),
      /actual task HEAD/
    );
    await workflow({ ...options, command: "note", context: { next: "Address review feedback", verification: null } });
    const updated = await workflow({ ...options, command: "status" });
    assert.deepEqual(updated.record.context.decisions, context.decisions);
    await assert.rejects(
      workflow({ ...options, command: "note", context: { authorization: "all actions" } }),
      /Unknown context/
    );
    await git(dev, "switch", "release");
    assert.equal((await workflow({ ...options, command: "status" })).resume.development.matchesBranch, false);
    await assert.rejects(
      workflow({ ...options, command: "note", context: { next: "Wrong checkout" } }),
      /branch changed/
    );
  });
});

test("recovery acknowledges a reviewed conflict resolution or exact abort and rejects incomplete history", async () => {
  await fixture(async ({ root, dev, options }) => {
    await commit(root, "docs/setup.md", "Base change\n");
    const first = await commit(dev, "docs/first.md", "First lesson\n");
    const conflicting = await commit(dev, "docs/setup.md", "Feature lesson\n");
    await assert.rejects(workflow({ ...options, command: "backflow", commits: [first, conflicting] }));
    const head = await git(root, "rev-parse", "HEAD");
    await assert.rejects(workflow({ ...options, command: "recover", outcome: "completed", head }), /dirty/);
    await git(root, "cherry-pick", "--abort");
    await assert.rejects(workflow({ ...options, command: "recover", outcome: "aborted", head }), /original base/);
    await assert.rejects(workflow({ ...options, command: "recover", outcome: "completed", head }), /incomplete/);
    await assert.rejects(git(root, "cherry-pick", conflicting));
    await writeFile(path.join(root, "docs/setup.md"), "Reviewed combined lesson\n");
    await git(root, "add", "docs/setup.md");
    await git(root, "cherry-pick", "--continue");
    await assert.rejects(workflow({ ...options, command: "recover", outcome: "completed", head }), /current HEAD/);
    const completed = await workflow({
      ...options,
      command: "recover",
      outcome: "completed",
      head: await git(root, "rev-parse", "HEAD"),
    });
    assert.equal(completed.record.pending, undefined);
    assert.equal(completed.record.lastRecovery.outcome, "completed");
    assert.equal(await readFile(path.join(root, "docs/setup.md"), "utf8"), "Reviewed combined lesson\n");
    assert.equal(await git(dev, "status", "--porcelain"), "");
  });
});

test("shared write locking excludes concurrent worktrees while atomic records remain readable", async () => {
  await fixture(async ({ root, dev, options }) => {
    const status = await workflow({ ...options, command: "status" });
    const directory = path.dirname(status.recordFile);
    await withWorkflowLock(directory, "held-test", async () => {
      const before = await readFile(status.recordFile, "utf8");
      await assert.rejects(
        workflow({ ...options, projectDir: dev, command: "note", context: { next: "Concurrent change" } }),
        /busy/
      );
      const readable = await workflow({ ...options, command: "status" });
      assert.equal(readable.record.issue, options.issue);
      assert.equal(readable.writer.owner.operation, "held-test");
      assert.equal(await readFile(status.recordFile, "utf8"), before);
    });
    await assert.rejects(readFile(path.join(directory, "write.lock")), { code: "ENOENT" });
    await assert.rejects(
      withWorkflowLock(directory, "failed-test", () => {
        throw new Error("failed operation");
      }),
      /failed operation/
    );
    await workflow({ ...options, command: "note", context: { next: "Continue after unlock" } });
    const before = await readFile(status.recordFile, "utf8");
    await assert.rejects(writeRecord(status.recordFile, { invalid: 1n }));
    assert.equal(await readFile(status.recordFile, "utf8"), before);
    const writes = (async () => {
      for (let i = 0; i < 15; i++) await writeRecord(status.recordFile, { ...status.record, revision: i });
    })();
    for (let i = 0; i < 40; i++)
      assert.equal(JSON.parse(await readFile(status.recordFile, "utf8")).issue, options.issue);
    await writes;
    assert.equal(JSON.parse(await readFile(status.recordFile, "utf8")).revision, 14);
    await writeFile(path.join(directory, "write.lock"), JSON.stringify({ pid: -1, operation: "interrupted-owner" }));
    await assert.rejects(workflow({ ...options, command: "sync" }), /busy/);
    assert.equal(JSON.parse(await readFile(path.join(directory, "write.lock"), "utf8")).operation, "interrupted-owner");
    assert.equal(await git(root, "status", "--porcelain"), "");
  });
});
