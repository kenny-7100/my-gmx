import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { withWorkflowLock, writeRecord } from "./agent-workflow-state.mjs";

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
async function gitOperation(cwd) {
  for (const name of ["rebase-merge", "rebase-apply", "sequencer", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) {
    const statePath = path.resolve(cwd, await git(cwd, "rev-parse", "--git-path", name));
    try {
      await access(statePath);
      return name;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}
async function clean(cwd) {
  assert.equal(await git(cwd, "status", "--porcelain", "--untracked-files=all"), "", `Worktree is dirty: ${cwd}`);
  assert.equal(await gitOperation(cwd), null, `Finish the existing Git operation in ${cwd}`);
}
async function baseWorktree(root, requireClean = true) {
  const entries = (await git(root, "worktree", "list", "--porcelain")).split("\n\n");
  const entry = entries.find((item) => item.split("\n").includes(`branch refs/heads/${BASE}`));
  assert.ok(entry, `Open ${BASE} in its own worktree first.`);
  const cwd = entry
    .split("\n")
    .find((line) => line.startsWith("worktree "))
    .slice(9);
  if (requireClean) await clean(cwd);
  return cwd;
}
async function newWorkspace(root, branch, worktree) {
  assert.equal(
    await git(root, "for-each-ref", "--format=%(refname)", `refs/heads/${branch}`),
    "",
    "Branch already exists; resume it instead of recording a new operation."
  );
  try {
    await access(worktree);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  assert.fail("Worktree path already exists; choose a new path.");
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

async function snapshot(workspace, common) {
  assert.equal(
    await realpath(await git(workspace.worktree, "rev-parse", "--show-toplevel")),
    await realpath(workspace.worktree),
    "Recorded workspace is no longer a checkout root."
  );
  assert.equal(
    await realpath(path.resolve(workspace.worktree, await git(workspace.worktree, "rev-parse", "--git-common-dir"))),
    common,
    "Recorded workspace belongs to another repository."
  );
  return {
    worktree: workspace.worktree,
    branch: await git(workspace.worktree, "branch", "--show-current"),
    head: await git(workspace.worktree, "rev-parse", "HEAD"),
    dirty: Boolean(await git(workspace.worktree, "status", "--porcelain", "--untracked-files=all")),
    operation: await gitOperation(workspace.worktree),
  };
}
async function workspaceStatus(workspace, common) {
  try {
    const actual = await snapshot(workspace, common);
    return { ...actual, matchesBranch: actual.branch === workspace.branch };
  } catch {
    return { worktree: workspace.worktree, unavailable: true };
  }
}
async function assertWorkspace(workspace, common) {
  const actual = await snapshot(workspace, common);
  assert.equal(actual.branch, workspace.branch, `Recorded branch changed in ${workspace.worktree}`);
  return actual;
}
async function contextStatus(root, record, common) {
  const development = await workspaceStatus(record.development, common);
  const delivery = record.delivery ? await workspaceStatus(record.delivery, common) : null;
  const authority = record.delivery ? delivery : development;
  let knowledge;
  try {
    const worktree = await baseWorktree(root, false);
    const head = await git(worktree, "rev-parse", "HEAD");
    const paths = (
      await git(
        root,
        "diff",
        "--name-only",
        record.development.base,
        head,
        "--",
        "AGENTS.md",
        "docs",
        ".agents",
        "scripts",
        "tools"
      )
    )
      .split("\n")
      .filter(Boolean);
    knowledge = {
      worktree,
      head,
      paths,
      dirty: Boolean(await git(worktree, "status", "--porcelain")),
      instruction:
        "Read relevant current guidance here; target code and pinned dependencies remain authoritative. Do not merge the base merely to load knowledge.",
    };
  } catch {
    knowledge = {
      unavailable: true,
      instruction: "Locate the personal base before assuming this branch has current guidance.",
    };
  }
  const verification = record.context?.verification;
  let verificationCurrent = false;
  if (verification && !record.pending && authority && !authority.unavailable && !authority.operation) {
    verificationCurrent =
      verification.head === authority.head &&
      (await realpath(verification.worktree).catch(() => null)) === (await realpath(authority.worktree)) &&
      !authority.dirty &&
      authority.matchesBranch;
  }
  return {
    development,
    delivery,
    authority,
    knowledge,
    pending: record.pending
      ? await workspaceStatus({ worktree: record.pending.target, branch: record.pending.branch }, common)
      : null,
    contextNeedsReview: Boolean(
      record.context &&
        (record.context.basedOn?.head !== authority.head ||
          record.context.basedOn?.branch !== authority.branch ||
          record.context.basedOn?.worktree !== authority.worktree)
    ),
    verificationCurrent,
    verificationMeaning:
      "Agent-reported result only; matching a clean checkout does not prove execution, ignored inputs, deployment or external freshness.",
  };
}
function validateContext(patch) {
  assert.ok(patch && typeof patch === "object" && !Array.isArray(patch), "Context must be an object.");
  const strings = ["objective", "next"];
  const arrays = ["acceptance", "decisions", "blockers", "links", "observations"];
  const text = (value) => typeof value === "string" && value.length <= 8000;
  for (const [key, value] of Object.entries(patch)) {
    assert.ok([...strings, ...arrays, "verification"].includes(key), `Unknown context field: ${key}`);
    if (strings.includes(key)) assert.ok(text(value), `Invalid ${key}`);
    if (arrays.includes(key))
      assert.ok(Array.isArray(value) && value.length <= 30 && value.every(text), `Invalid ${key}`);
    if (key === "verification" && value !== null) {
      assert.ok(value && typeof value === "object" && !Array.isArray(value), "Invalid verification.");
      assert.deepEqual(Object.keys(value).sort(), ["command", "head", "result", "worktree"]);
      assert.ok(
        Object.values(value).every(text) && /^[0-9a-f]{40}$/.test(value.head),
        "Invalid verification identity."
      );
      assert.ok(["passed", "failed", "blocked", "not-run"].includes(value.result), "Invalid verification result.");
    }
  }
}
async function selectedFiles(root, sha, command) {
  const parents = (await git(root, "rev-list", "--parents", "-n", "1", sha)).split(" ");
  assert.equal(parents.length, 2, "Split merge or root commits before transferring them.");
  const files = (await git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "--no-renames", "-z", sha))
    .split("\0")
    .filter(Boolean);
  assert.ok(
    files.length && files.every((file) => (command === "backflow" ? infrastructure(file) : !infrastructure(file))),
    "Mixed or misclassified commit: split infrastructure and business changes first. Shared configuration needs manual content review."
  );
  assert.ok(
    !(await git(root, "diff-tree", "--no-commit-id", "--raw", "-r", sha)).includes("160000"),
    "Reference repository gitlinks cannot be transferred."
  );
}
async function missingCommits(root, target, commits) {
  const missing = [];
  for (const sha of commits) {
    const equivalent = await git(root, "cherry", target, sha, `${sha}^`);
    if (equivalent && !equivalent.startsWith("- ")) missing.push(sha);
  }
  return missing;
}

export async function workflow(options) {
  const root = await realpath(options.projectDir ?? process.cwd());
  assert.equal(await realpath(await git(root, "rev-parse", "--show-toplevel")), root, "Select a Git checkout root.");
  const common = await realpath(path.resolve(root, await git(root, "rev-parse", "--git-common-dir")));
  const directory = path.join(common, "agent-workflow");
  if (options.command === "status") return runWorkflow({ ...options, root, common });
  return withWorkflowLock(directory, `${options.command}:${options.issue ?? BASE}`, () =>
    runWorkflow({ ...options, root, common })
  );
}
async function runWorkflow({
  command,
  root,
  common,
  issue,
  branch,
  worktree,
  commits = [],
  context,
  contextFile,
  outcome,
  head: reviewedHead,
}) {
  if (command === "sync") return sync(root);
  assert.match(issue ?? "", /^[A-Z][A-Z0-9]*-[0-9]+$/, "Provide an issue identifier.");
  const recordFile = path.join(common, "agent-workflow", `${issue}.json`);
  let record;
  try {
    record = JSON.parse(await readFile(recordFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const save = async () => {
    record.version = 2;
    record.updatedAt = new Date().toISOString();
    await writeRecord(recordFile, record);
  };
  if (command === "status") {
    const lockFile = path.join(common, "agent-workflow", "write.lock");
    let writer = null;
    try {
      const owner = await readFile(lockFile, "utf8");
      writer = { lockFile, owner: owner ? JSON.parse(owner) : null };
    } catch (error) {
      if (error.code !== "ENOENT") writer = { lockFile, ownerUnavailable: true };
    }
    return {
      recordFile,
      record: record ?? null,
      writer,
      ...(record ? { resume: await contextStatus(root, record, common) } : {}),
    };
  }
  assert.ok(["start", "backflow", "deliver", "note", "recover"].includes(command), "Unknown workflow command.");
  if (command === "note") {
    assert.ok(record && !record.pending, "Start the task and resolve pending operations before updating context.");
    const patch = contextFile ? JSON.parse(await readFile(contextFile, "utf8")) : context;
    validateContext(patch);
    const actual = await assertWorkspace(record.delivery ?? record.development, common);
    if (patch.verification) {
      assert.equal(patch.verification.head, actual.head, "Verification must name the actual task HEAD.");
      assert.equal(
        await realpath(patch.verification.worktree),
        await realpath(actual.worktree),
        "Verification must name the authoritative task workspace."
      );
      await clean(actual.worktree);
    }
    record.context = { ...record.context, ...patch, basedOn: actual, updatedAt: new Date().toISOString() };
    await save();
    return { recordFile, record };
  }
  if (command === "recover") {
    assert.ok(record?.pending, "No pending operation to recover.");
    assert.ok(
      ["completed", "aborted"].includes(outcome),
      "Choose --outcome completed or aborted after reviewing native Git recovery."
    );
    const pending = record.pending;
    assert.ok(
      ["backflow", "deliver"].includes(pending.command),
      "Inspect this unsupported pending operation manually."
    );
    const actual = await assertWorkspace({ worktree: pending.target, branch: pending.branch }, common);
    assert.equal(reviewedHead, actual.head, "Acknowledge the reviewed current HEAD with --head.");
    await clean(pending.target);
    if (outcome === "aborted") {
      assert.equal(
        actual.head,
        pending.base,
        "Abort must restore the original base; partial commits cannot be discarded from the record."
      );
    } else {
      await git(root, "merge-base", "--is-ancestor", pending.base, actual.head);
      const transferred = (await git(root, "rev-list", "--reverse", `${pending.base}..${actual.head}`))
        .split("\n")
        .filter(Boolean);
      assert.equal(
        transferred.length,
        (pending.todo ?? (await missingCommits(root, pending.base, pending.commits))).length,
        "Review all selected commits; incomplete or additional history cannot be finalized."
      );
      for (const sha of transferred) await selectedFiles(root, sha, pending.command);
      if (pending.command === "backflow") record.infrastructure.push({ commits: pending.commits, head: actual.head });
      else
        record.delivery = {
          branch: pending.branch,
          worktree: pending.target,
          base: pending.base,
          head: actual.head,
          commits: pending.commits,
          remote: "my-gmx-pr",
        };
    }
    record.lastRecovery = { ...pending, outcome, head: actual.head, reviewedAt: new Date().toISOString() };
    delete record.pending;
    await save();
    return { recordFile, record };
  }
  if (command === "start" || command === "deliver") {
    assert.ok(branch && worktree, "Provide a new branch and worktree path.");
    await git(root, "check-ref-format", "--branch", branch);
    assert.ok(!branch.startsWith("-"), "Invalid branch name.");
    worktree = path.resolve(worktree);
    assert.ok(!record?.pending, "Resolve the recorded pending operation first.");
    await newWorkspace(root, branch, worktree);
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
  const sources = [record.delivery, record.development].filter(Boolean);
  const selected = [];
  for (const ref of commits) {
    const sha = await git(root, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`);
    const membership = await Promise.allSettled(
      sources.map((source) => git(root, "merge-base", "--is-ancestor", sha, source.branch))
    );
    assert.ok(
      membership.some((result) => result.status === "fulfilled"),
      "Commit is outside this task."
    );
    await assertWorkspace(sources[membership.findIndex((result) => result.status === "fulfilled")], common);
    await selectedFiles(root, sha, command);
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
    target = worktree;
  }
  record.pending = {
    command,
    target,
    branch: command === "backflow" ? BASE : branch,
    base: expectedBase,
    commits: selected,
    todo: await missingCommits(root, expectedBase, selected),
  };
  await save();
  if (command === "deliver") await git(root, "worktree", "add", "-b", branch, worktree, expectedBase);
  for (const sha of [...record.pending.todo]) {
    if (!(await missingCommits(target, "HEAD", [sha])).length) {
      record.pending.todo = record.pending.todo.filter((item) => item !== sha);
      await save();
      continue;
    }

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
      "context-file": { type: "string" },
      outcome: { type: "string" },
      head: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: node scripts/agent-workflow.mjs sync|start|status|note|backflow|deliver|recover --project-dir PATH [--issue FESOL-123] [--branch NAME --worktree PATH] [--commit SHA ...] [--context-file JSON] [--outcome completed|aborted --head SHA]\nstatus provides live workspace and knowledge locations; note merges task context; recover acknowledges reviewed native Git recovery. start synchronizes solana-integration; backflow transfers reviewed infrastructure commits; deliver transfers reviewed business commits onto freshly fetched origin/release. No dependency install, push, PR, force update or evidence packaging. Git failures preserve pending state; inspect and finish/abort it, then use recover."
    );
  } else {
    workflow({
      command: positionals[0],
      projectDir: values["project-dir"],
      issue: values.issue,
      branch: values.branch,
      worktree: values.worktree,
      commits: values.commit,
      contextFile: values["context-file"],
      outcome: values.outcome,
      head: values.head,
    }).then(
      (result) => console.log(JSON.stringify(result, null, 2)),
      (error) => {
        console.error(error.message);
        process.exitCode = 1;
      }
    );
  }
}
