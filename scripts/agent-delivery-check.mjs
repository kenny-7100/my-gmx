import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const exec = promisify(execFile);

async function git(cwd, args) {
  try {
    const { stdout } = await exec("git", ["--no-pager", ...args], {
      cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      timeout: 30000,
      maxBuffer: 32_000_000,
    });
    return stdout;
  } catch (error) {
    throw new Error(`git ${args[0]} failed (${error.code}): ${(error.stderr ?? error.message).trim()}`);
  }
}

export async function checkDelivery({
  cwd = ROOT,
  base = "origin/release",
  developmentBase = "solana-integration",
  head,
  allowPaths,
  expectedBase,
}) {
  assert.ok(typeof head === "string" && head.length > 0, "An explicit --head ref is required");
  assert.ok(Array.isArray(allowPaths) && allowPaths.length > 0, "At least one explicit --allow-path is required");
  for (const file of allowPaths) {
    assert.ok(
      file &&
        !file.includes("\0") &&
        !file.includes("\\") &&
        !/[?*[\]]/.test(file) &&
        !path.posix.isAbsolute(file) &&
        path.posix.normalize(file) === file &&
        !file.split("/").includes("..") &&
        !file.endsWith("/"),
      `Expected an exact repository-relative file path: ${file}`
    );
  }
  assert.equal(new Set(allowPaths).size, allowPaths.length, "Duplicate allowed paths");
  const resolve = async (ref) =>
    (await git(cwd, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])).trim();
  const baseSha = await resolve(base);
  const developmentSha = await resolve(developmentBase);
  const headSha = await resolve(head);
  const report = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    scope: "committed-delivery-diff",
    refs: {
      base: { ref: base, sha: baseSha },
      developmentBase: { ref: developmentBase, sha: developmentSha },
      head: { ref: head, sha: headSha },
    },
    baseFreshness: "not-checked",
    expectedBase: expectedBase ?? null,
    allowPaths,
    findings: [],
  };
  if (expectedBase !== undefined && expectedBase !== baseSha)
    report.findings.push({ code: "base-sha-mismatch", expected: expectedBase, actual: baseSha });
  const mergeBases = (await git(cwd, ["merge-base", "--all", baseSha, headSha])).trim().split("\n");
  if (mergeBases.length !== 1 || mergeBases[0] !== baseSha)
    report.findings.push({ code: "release-not-ancestor", mergeBases });
  const commits = async (tip) => (await git(cwd, ["rev-list", tip, `^${baseSha}`])).trim().split("\n").filter(Boolean);
  const developmentCommits = new Set(await commits(developmentSha));
  const deliveryCommits = await commits(headSha);
  report.deliveryCommits = deliveryCommits;
  const inherited = deliveryCommits.filter((sha) => developmentCommits.has(sha));
  if (inherited.length) report.findings.push({ code: "development-base-history", commits: inherited });

  // Git patch equivalence catches copied commits even when their commit IDs changed.
  const cherry = await git(cwd, ["cherry", developmentSha, headSha, baseSha]);
  const equivalents = cherry
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
  if (equivalents.length) report.findings.push({ code: "development-base-patch", commits: equivalents });
  const paths = (await git(cwd, ["diff", "--no-ext-diff", "--no-renames", "--name-only", "-z", baseSha, headSha, "--"]))
    .split("\0")
    .filter(Boolean);
  report.changedPaths = paths;
  const unexpected = paths.filter((file) => !allowPaths.includes(file));
  if (unexpected.length) report.findings.push({ code: "unexpected-paths", paths: unexpected });
  if (!paths.length) report.findings.push({ code: "empty-delivery" });
  report.status = report.findings.length ? "blocked" : "passed";
  return report;
}

async function runCli() {
  try {
    const { values } = parseArgs({
      options: {
        base: { type: "string", default: "origin/release" },
        "development-base": { type: "string", default: "solana-integration" },
        head: { type: "string" },
        "allow-path": { type: "string", multiple: true },
        "expected-base": { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn agent:delivery-check --head REF --allow-path FILE [--allow-path FILE ...] [--base origin/release] [--development-base solana-integration] [--expected-base SHA]\nRead-only committed-history and exact-path isolation check. Does not fetch refs or assess business correctness.\n"
      );
      return;
    }
    const report = await checkDelivery({
      base: values.base,
      developmentBase: values["development-base"],
      head: values.head,
      allowPaths: values["allow-path"],
      expectedBase: values["expected-base"],
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "passed" ? 0 : 2;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "blocked", error: error.message }, null, 2)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
