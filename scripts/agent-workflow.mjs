import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

const exec = promisify(execFile);
const BASE = "solana-integration";
const infrastructure = (file) => file === "AGENTS.md" || /^(docs|\.agents|scripts|tools)\//.test(file);

async function git(cwd, ...args) {
  return (
    await exec("git", ["-c", "diff.autoRefreshIndex=false", ...args], {
      cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout.trim();
}
async function clean(cwd) {
  assert.equal(await git(cwd, "status", "--porcelain", "--untracked-files=all"), "", `Worktree is dirty: ${cwd}`);
  for (const name of ["rebase-merge", "rebase-apply", "sequencer"]) {
    const statePath = path.resolve(cwd, await git(cwd, "rev-parse", "--git-path", name));
    try {
      await access(statePath);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    throw new Error(`Finish the existing Git operation in ${cwd}`);
  }
  for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) {
    try {
      await git(cwd, "rev-parse", "--verify", name);
    } catch {
      continue;
    }
    throw new Error(`Finish the existing Git operation in ${cwd}`);
  }
}
async function baseWorktree(root) {
  const entries = (await git(root, "worktree", "list", "--porcelain")).split("\n\n");
  const entry = entries.find((item) => item.split("\n").includes(`branch refs/heads/${BASE}`));
  assert.ok(entry, `Open ${BASE} in its own worktree first.`);
  const cwd = entry
    .split("\n")
    .find((line) => line.startsWith("worktree "))
    .slice(9);
  await clean(cwd);
  return cwd;
}
async function fetchRelease(root) {
  await git(root, "fetch", "origin", "release");
  return git(root, "rev-parse", "origin/release");
}
async function sync(root) {
  const cwd = await baseWorktree(root);
  const release = await fetchRelease(root);
  // Detect conflicts without leaving the user's checkout in a merge operation.
  await git(cwd, "merge-tree", "--write-tree", "HEAD", release);
  await git(cwd, "merge", "--no-edit", release);
  return { base: await git(cwd, "rev-parse", "HEAD"), release };
}

export async function workflow({ command, projectDir = process.cwd(), issue, branch, worktree, commits = [] }) {
  const root = await realpath(projectDir);
  assert.equal(await realpath(await git(root, "rev-parse", "--show-toplevel")), root, "Select a Git checkout root.");
  if (command === "sync") return sync(root);
  assert.match(issue ?? "", /^[A-Z][A-Z0-9]*-[0-9]+$/, "Provide an issue identifier.");
  const common = path.resolve(root, await git(root, "rev-parse", "--git-common-dir"));
  const recordFile = path.join(common, "agent-workflow", `${issue}.json`);
  let record;
  try {
    record = JSON.parse(await readFile(recordFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const save = async () => {
    await mkdir(path.dirname(recordFile), { recursive: true });
    await writeFile(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  };
  if (command === "status") return { recordFile, record: record ?? null };
  assert.ok(["start", "backflow", "deliver"].includes(command), "Unknown workflow command.");
  if (command === "start" || command === "deliver") {
    assert.ok(branch && worktree, "Provide a new branch and worktree path.");
    await git(root, "check-ref-format", "--branch", branch);
    assert.ok(!branch.startsWith("-"), "Invalid branch name.");
    worktree = path.resolve(worktree);
    assert.ok(!record?.pending, "Resolve the recorded pending operation first.");
  }
  if (command === "start") {
    assert.ok(!record, "This issue already has a workspace; use status to resume it.");
    const { base, release } = await sync(root);
    await git(root, "worktree", "add", "-b", branch, worktree, base);
    record = { issue, development: { branch, worktree, base, release }, infrastructure: [], delivery: null };
    await save();
    return { recordFile, record };
  }
  assert.ok(record, "Start or register this task through the existing workflow first.");
  assert.ok(!record.pending, "Resolve the recorded pending operation first.");
  assert.ok(command !== "deliver" || !record.delivery, "A delivery workspace already exists; continue repairs there.");
  assert.ok(commits.length, "Select reviewed commits explicitly with --commit.");
  const sources = [record.development.branch, record.delivery?.branch].filter(Boolean);
  const selected = [];
  for (const ref of commits) {
    const sha = await git(root, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`);
    const membership = await Promise.allSettled(
      sources.map((source) => git(root, "merge-base", "--is-ancestor", sha, source))
    );
    assert.ok(
      membership.some((result) => result.status === "fulfilled"),
      "Commit is outside this task."
    );
    const parents = (await git(root, "rev-list", "--parents", "-n", "1", sha)).split(" ");
    assert.equal(parents.length, 2, "Split merge or root commits before transferring them.");
    const files = (await git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "--no-renames", "-z", sha))
      .split("\0")
      .filter(Boolean);
    assert.ok(files.length, "Empty commits cannot be transferred.");
    assert.ok(
      files.every((file) => (command === "backflow" ? infrastructure(file) : !infrastructure(file))),
      "Mixed or misclassified commit: split infrastructure and business changes first. Shared configuration needs manual content review."
    );
    const modes = await git(root, "diff-tree", "--no-commit-id", "--raw", "-r", sha);
    assert.ok(!modes.includes("160000"), "Reference repository gitlinks cannot be transferred.");
    selected.push(sha);
  }
  assert.equal(new Set(selected).size, selected.length, "Duplicate commits.");
  let target;
  let expectedBase;
  if (command === "backflow") {
    target = await baseWorktree(root);
    expectedBase = await git(target, "rev-parse", "HEAD");
  } else {
    expectedBase = await fetchRelease(root);
    await git(root, "worktree", "add", "-b", branch, worktree, expectedBase);
    target = worktree;
  }
  record.pending = {
    command,
    target,
    branch: command === "backflow" ? BASE : branch,
    base: expectedBase,
    commits: selected,
  };
  await save();
  for (const sha of selected) {
    const equivalent = await git(target, "cherry", "HEAD", sha, `${sha}^`);
    if (equivalent.startsWith("- ") || !equivalent) continue;
    // Failures preserve the exact worktree and pending record for diagnosis; never reset or auto-resolve.
    await git(target, "cherry-pick", sha);
  }
  const head = await git(target, "rev-parse", "HEAD");
  if (command === "backflow") record.infrastructure.push({ commits: selected, head });
  else record.delivery = { branch, worktree: target, base: expectedBase, head, commits: selected, remote: "my-gmx-pr" };
  delete record.pending;
  await save();
  return {
    recordFile,
    record,
    next:
      command === "deliver"
        ? "Review the complete diff and history, validate this checkout, then push my-gmx-pr and open a Draft PR into release."
        : "Infrastructure returned to solana-integration.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "project-dir": { type: "string" },
      issue: { type: "string" },
      branch: { type: "string" },
      worktree: { type: "string" },
      commit: { type: "string", multiple: true },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: node scripts/agent-workflow.mjs sync|start|status|backflow|deliver --project-dir PATH [--issue FESOL-123] [--branch NAME --worktree PATH] [--commit SHA ...]\nstart synchronizes solana-integration; backflow transfers reviewed infrastructure commits; deliver transfers reviewed business commits onto freshly fetched origin/release. No dependency install, push, PR, force update or evidence packaging. Git failures preserve pending state; inspect and finish/abort it before updating the local task record."
    );
  } else {
    workflow({
      command: positionals[0],
      projectDir: values["project-dir"],
      issue: values.issue,
      branch: values.branch,
      worktree: values.worktree,
      commits: values.commit,
    }).then(
      (result) => console.log(JSON.stringify(result, null, 2)),
      (error) => {
        console.error(error.message);
        process.exitCode = 1;
      }
    );
  }
}
