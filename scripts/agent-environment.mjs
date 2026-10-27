import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { browserDependency, checkChromeExecutable } from "./solana-browser-preflight.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
const LOCAL = {
  node: "Use Node 22 for the agent tools; see docs/coding-and-self-review.md.",
  yarn: "Check packageManager and the repository yarnPath; do not install automatically.",
  frontend: "Prepare the frontend's own locked dependencies; see docs/frontend-offline-tests.md.",
  sdk: "Prepare the SDK's own locked dependencies; see docs/sdk-offline-tests.md.",
  api: "Prepare gmx-api's own locked dependencies; see docs/solana-api-local.md.",
  chrome: "Use solana:browser-preflight before page acceptance; executable access is not browser execution.",
  docker: "Docker CLI only; verify the local daemon and postgres:15 image before database tests.",
  "sdk-artifacts": "Use sdk:artifacts verify; building still requires authorization.",
  wasm: "Use solana:runtime-preflight --local-only; fingerprints do not prove protocol compatibility.",
};
const EXTERNAL = {
  "docker-daemon-and-image": "Use the local database prerequisites in docs/solana-api-local.md.",
  rpc: "Use agent:preflight --checks rpc after preparing the authorized RPC proxy.",
  keeper: "Use agent:preflight --checks keeper; check freshness and the real trading flag.",
  "local-api-service": "Use the selected API/workspace status; dependencies do not prove a running service.",
  "remote-api": "Confirm the deployed URL, access and version; see A03 in docs/agent-acceptance-infrastructure.md.",
  wallet: "Use agent:wallet balances/tokens only when required and authorized; no signing is implied.",
  "program-version": "Use solana:runtime-preflight for explicit Mainnet deployment evidence.",
  "reviewed-contract-and-samples":
    "Confirm reviewed semantics and real account samples; local samples are not acceptance.",
};
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

async function run(file, args) {
  return execute(file, args, {
    cwd: ROOT,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: { PATH: process.env.PATH, GIT_OPTIONAL_LOCKS: "0" },
  });
}

export async function packageState({ directory, names }) {
  const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  await readFile(path.join(directory, "yarn.lock"));
  const packages = [];
  for (const name of names) {
    const declared = manifest.devDependencies?.[name] ?? manifest.dependencies?.[name];
    assert.ok(typeof declared === "string" && VERSION.test(declared), "Expected exact declared versions.");
    const installed = JSON.parse(await readFile(path.join(directory, "node_modules", name, "package.json"))).version;
    assert.ok(typeof installed === "string" && VERSION.test(installed), "Invalid installed version.");
    packages.push({ name, declared, installed });
  }
  return {
    status: packages.every((item) => item.declared === item.installed) ? "ready" : "stale",
    code: "selected-package-versions",
    packages,
  };
}

async function probe(name) {
  if (name === "node")
    return {
      status: process.versions.node.split(".")[0] === "22" ? "ready" : "blocked",
      code: "agent-node-major",
      version: process.versions.node,
    };
  if (name === "yarn") {
    const manifest = JSON.parse(await readFile(path.join(ROOT, "package.json")));
    const config = await readFile(path.join(ROOT, ".yarnrc.yml"), "utf8");
    const yarnPath = config.match(/^yarnPath: (\.yarn\/releases\/[\w.-]+\.cjs)$/m)?.[1];
    assert.ok(yarnPath, "Expected a repository-local Yarn release.");
    const version = (await run(process.execPath, [path.join(ROOT, yarnPath), "--version"])).stdout.trim();
    assert.ok(VERSION.test(version), "Invalid Yarn version.");
    return {
      status: manifest.packageManager === `yarn@${version}` ? "ready" : "stale",
      code: "local-yarn-version",
      version,
    };
  }
  if (["frontend", "sdk", "api"].includes(name)) {
    const directories = { frontend: ROOT, sdk: path.join(ROOT, "sdk"), api: path.join(ROOT, "gmx-api") };
    const names = {
      frontend: ["vite", "vitest", "tsx", "typescript"],
      sdk: ["vitest", "tsx", "typescript"],
      api: ["jest", "ts-jest", "tsx", "typescript"],
    };
    const result = await packageState({ directory: directories[name], names: names[name] });
    if (name === "sdk") {
      const frontend = JSON.parse(await readFile(path.join(ROOT, "node_modules/vitest/package.json"))).version;
      if (result.packages.find((item) => item.name === "vitest").installed !== frontend) result.status = "stale";
    }
    return result;
  }
  if (name === "chrome") {
    const dependency = await browserDependency();
    await checkChromeExecutable();
    return { status: "ready", code: "chrome-access-and-locked-playwright", playwrightVersion: dependency.version };
  }
  if (name === "docker") {
    const output = (await run("docker", ["--version"])).stdout.trim();
    const version = output.match(/^Docker version (\d+\.\d+\.\d+)/)?.[1];
    assert.ok(version, "Invalid Docker CLI version.");
    return { status: "ready", code: "docker-cli-only", version };
  }
  const args =
    name === "sdk-artifacts"
      ? ["scripts/sdk-artifacts.mjs", "verify"]
      : ["--import", "tsx", "scripts/solana-runtime-preflight.mjs", "--local-only"];
  let report;
  try {
    report = JSON.parse((await run(process.execPath, args)).stdout);
  } catch (error) {
    if (name !== "sdk-artifacts") throw error;
    const failed = JSON.parse(error.stdout);
    if (
      failed.status === "blocked" &&
      /^SDK (source, configuration or toolchain changed|build artifacts changed)/.test(failed.error)
    )
      return { status: "stale", code: "sdk-artifact-provenance-changed" };
    throw error;
  }
  assert.equal(report.status, "passed", "Local artifact check did not pass.");
  if (name === "sdk-artifacts") {
    assert.ok(Number.isSafeInteger(report.artifactCount) && report.artifactCount > 0);
    return { status: "ready", code: "sdk-artifacts-verified", artifactCount: report.artifactCount };
  }
  assert.equal(report.scope, "local-artifacts");
  assert.equal(report.chain?.code, "local-only");
  assert.ok(VERSION.test(report.local?.version));
  return { status: "ready", code: "local-wasm-verified", version: report.local.version };
}

async function identity() {
  const gitRoot = (await run("git", ["rev-parse", "--show-toplevel"])).stdout.trim();
  assert.equal(await realpath(gitRoot), await realpath(ROOT), "Use the infrastructure checkout root.");
  const sha256 = {};
  const files = [
    "package.json",
    "yarn.lock",
    ".yarnrc.yml",
    ".nvmrc",
    "scripts/agent-environment.mjs",
    "scripts/solana-browser-preflight.mjs",
    "scripts/sdk-artifacts.mjs",
    "scripts/solana-runtime-preflight.mjs",
    "src/config/gmsol/sdk.ts",
    "src/config/gmsol/program.ts",
  ];
  for (const dir of ["sdk", "gmx-api"]) files.push(`${dir}/package.json`, `${dir}/yarn.lock`);
  for (const [dir, names] of [
    ["", ["vite", "vitest", "tsx", "typescript", "@playwright/test"]],
    ["sdk/", ["vitest", "tsx", "typescript"]],
    ["gmx-api/", ["jest", "ts-jest", "tsx", "typescript"]],
  ])
    for (const name of names) files.push(`${dir}node_modules/${name}/package.json`);
  for (const file of files) {
    try {
      sha256[file] = createHash("sha256")
        .update(await readFile(path.join(ROOT, file)))
        .digest("hex");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      sha256[file] = "missing";
    }
  }
  const commit = (await run("git", ["rev-parse", "HEAD"])).stdout.trim();
  const dirty = (await run("git", ["status", "--porcelain", "--untracked-files=normal"])).stdout.length > 0;
  return { projectDir: ROOT, commit, dirty, sha256 };
}

export async function collectEnvironment({ selected = Object.keys(LOCAL), check = probe, source = identity } = {}) {
  assert.ok(selected.length > 0 && new Set(selected).size === selected.length);
  assert.ok(
    selected.every((name) => Object.prototype.hasOwnProperty.call(LOCAL, name)),
    "Unknown environment check."
  );
  const startedAt = new Date().toISOString();
  const before = await source();
  const resources = [];
  for (const [name, next] of Object.entries(LOCAL)) {
    if (!selected.includes(name)) {
      resources.push({ name, status: "not-checked", checkedAt: null, code: "not-selected", next });
      continue;
    }
    let result;
    try {
      result = await check(name);
      assert.ok(["ready", "blocked", "stale"].includes(result.status));
    } catch {
      result = { status: "blocked", code: "local-check-unavailable" };
    }
    resources.push({ ...result, name, checkedAt: new Date().toISOString(), next });
  }
  for (const [name, next] of Object.entries(EXTERNAL))
    resources.push({ name, status: "not-checked", checkedAt: null, code: "explicit-verification-required", next });
  const after = await source();
  const sourceUnchanged = JSON.stringify(before) === JSON.stringify(after);
  return {
    schemaVersion: 1,
    scope: "agent-local-environment-inventory",
    status:
      resources.some((item) => selected.includes(item.name) && item.status !== "ready") || !sourceUnchanged
        ? "blocked"
        : "ready",
    startedAt,
    finishedAt: new Date().toISOString(),
    selected,
    sourceBefore: before,
    sourceAfter: after,
    sourceUnchanged,
    code: sourceUnchanged ? "selected-local-checks-collected" : "inventory-inputs-changed",
    resources,
    environmentReadiness: "not-evaluated",
    requirementAcceptance: "not-evaluated",
  };
}

export async function runCli({
  args = process.argv.slice(2),
  stdout = process.stdout,
  collect = collectEnvironment,
} = {}) {
  try {
    const { values } = parseArgs({
      args,
      options: { checks: { type: "string" }, help: { type: "boolean", short: "h" } },
    });
    if (values.help) {
      stdout.write(
        `Usage: yarn agent:environment [--checks ${Object.keys(LOCAL).join(",")}]\nLocal read-only inventory. No services, browser launch, daemon access, installation, network, wallet or .env reads. JSON on stdout; redirect explicitly to save. Exit 0: selected local checks ready; 2: blocked/stale/source changed; 1: configuration/evidence error. External resources remain not-checked.\n`
      );
      return 0;
    }
    const report = await collect({ selected: values.checks === undefined ? undefined : values.checks.split(",") });
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "ready" ? 0 : 2;
  } catch {
    stdout.write(`${JSON.stringify({ status: "blocked", code: "environment-configuration-or-evidence-error" })}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  runCli().then((code) => {
    process.exitCode = code;
  });
