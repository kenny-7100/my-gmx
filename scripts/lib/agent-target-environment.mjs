import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { packageState } from "../agent-environment.mjs";
import { prepareApi } from "../gmx-api-prepare.mjs";
import { inventory, verifyArtifacts } from "../sdk-artifacts.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const TARGET_CHECKS = ["node", "yarn", "frontend", "sdk", "api", "sdk-artifacts", "api-routes", "database"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const execute = (cwd, file, args) =>
  execFileSync(file, args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      GIT_OPTIONAL_LOCKS: "0",
      ...(file === "docker"
        ? Object.fromEntries(
            ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG"]
              .filter((name) => process.env[name] !== undefined)
              .map((name) => [name, process.env[name]])
          )
        : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

export async function targetIdentity(directory) {
  directory = await realpath(directory);
  const git = (...args) => execute(directory, "git", ["-C", directory, ...args]);
  assert.equal(await realpath(git("rev-parse", "--show-toplevel")), directory, "Select a Git checkout root.");
  const sha256 = {};
  const files = ["package.json", "yarn.lock", ".nvmrc", ".yarnrc.yml", "sdk/package.json", "sdk/yarn.lock"];
  for (const [prefix, names] of [
    ["", ["vite", "vitest", "tsx", "typescript", "jest", "ts-jest", "@gmx-io/sdk"]],
    ["sdk/", ["vitest", "tsx", "typescript"]],
  ])
    for (const name of names) files.push(`${prefix}node_modules/${name}/package.json`);
  for (const file of files) {
    try {
      sha256[file] = hash(await readFile(path.join(directory, file)));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      sha256[file] = "missing";
    }
  }
  return { directory, commit: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain")), sha256 };
}

// Reproduce the existing receipt input format without requiring personal tools in the target checkout.
export async function targetSdkInputs(directory) {
  const files = {};
  for (const dir of [
    "sdk/src",
    "sdk/scripts",
    "sdk/node_modules/typescript/lib",
    "sdk/node_modules/typescript-transform-paths/dist",
  ])
    for (const [file, digest] of Object.entries(await inventory(path.join(directory, dir))))
      files[`${dir}/${file}`] = digest;
  for (const file of [
    "sdk/package.json",
    "sdk/tsconfig.json",
    "sdk/tsconfig.cjs.json",
    "sdk/tsconfig.esm.json",
    "sdk/yarn.lock",
    "yarn.lock",
    "viem-override.d.ts",
    "scripts/sdk-artifacts.mjs",
    "sdk/node_modules/typescript/package.json",
    "sdk/node_modules/typescript-transform-paths/package.json",
    "sdk/node_modules/tsx/package.json",
    ".yarnrc.yml",
    "sdk/.yarnrc.yml",
  ])
    files[file] = hash(await readFile(path.join(file === "scripts/sdk-artifacts.mjs" ? ROOT : directory, file)));
  return {
    node: process.version,
    sha256: hash(JSON.stringify(Object.entries(files).sort())),
    fileCount: Object.keys(files).length,
  };
}

async function yarnState(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, "package.json")));
  const config = await readFile(path.join(directory, ".yarnrc.yml"), "utf8");
  const declaredPath = config.match(/^yarnPath: ["']?([^\s"']+)["']?$/m)?.[1];
  const runner = declaredPath
    ? path.resolve(directory, declaredPath)
    : path.join(ROOT, ".yarn/releases/yarn-4.12.0.cjs");
  const version = execute(directory, process.execPath, [runner, "--version"]);
  assert.match(version, /^\d+\.\d+\.\d+$/);
  return {
    status: manifest.packageManager === `yarn@${version}` ? "ready" : "stale",
    version,
    runner,
    runnerSource: declaredPath ? "target-yarnPath" : "infrastructure-pinned-yarn",
  };
}

export async function collectTargetEnvironment({
  projectDir,
  apiDir,
  selected = ["node", "yarn", ...(projectDir ? ["frontend", "sdk"] : []), ...(apiDir ? ["api"] : [])],
}) {
  assert.ok(projectDir || apiDir, "Select at least one target.");
  assert.ok(
    selected.length &&
      new Set(selected).size === selected.length &&
      selected.every((name) => TARGET_CHECKS.includes(name)),
    "Unknown or duplicate target check."
  );
  const targets = {};
  if (projectDir) targets.frontend = await realpath(projectDir);
  if (apiDir) targets.api = await realpath(apiDir);
  const identity = async () =>
    Object.fromEntries(
      await Promise.all(Object.entries(targets).map(async ([name, dir]) => [name, await targetIdentity(dir)]))
    );
  const before = await identity();
  const startedAt = new Date().toISOString();
  const resources = [];
  for (const name of TARGET_CHECKS) {
    if (!selected.includes(name)) {
      resources.push({ name, status: "not-checked", checkedAt: null });
      continue;
    }
    let result;
    try {
      if (name === "node")
        result = { status: process.versions.node.startsWith("22.") ? "ready" : "blocked", version: process.version };
      else if (name === "yarn") {
        const versions = {};
        for (const [target, dir] of Object.entries(targets)) versions[target] = await yarnState(dir);
        result = {
          status: Object.values(versions).every((value) => value.status === "ready") ? "ready" : "stale",
          targets: versions,
        };
      } else if (["frontend", "sdk", "api"].includes(name)) {
        const directory =
          name === "api"
            ? targets.api
            : name === "sdk"
              ? targets.frontend && path.join(targets.frontend, "sdk")
              : targets.frontend;
        assert.ok(directory, "Check requires the corresponding target.");
        const names =
          name === "api"
            ? ["jest", "ts-jest", "tsx", "typescript"]
            : name === "sdk"
              ? ["vitest", "tsx", "typescript"]
              : ["vite", "vitest", "tsx", "typescript"];
        result = { status: "ready", packages: [], problems: [] };
        for (const tool of names) {
          try {
            const state = await packageState({ directory, names: [tool] });
            result.packages.push(...state.packages);
            if (state.status !== "ready" && result.status !== "blocked") result.status = state.status;
          } catch (error) {
            result.status = "blocked";
            result.problems.push({
              package: tool,
              code:
                error.code === "ENOENT" ? "missing-package-or-lockfile" : "invalid-package-declaration-or-installation",
            });
          }
        }
        if (name !== "api") {
          for (const tool of name === "sdk" ? ["vitest"] : ["vite", "vitest"]) {
            const expected = JSON.parse(await readFile(path.join(ROOT, "node_modules", tool, "package.json"))).version;
            const installed = result.packages.find((item) => item.name === tool)?.installed;
            if (installed && installed !== expected && result.status !== "blocked") result.status = "stale";
          }
        }
        result.directory = directory;
      } else if (name === "sdk-artifacts") {
        assert.ok(targets.frontend, "Select a frontend target.");
        const verified = await verifyArtifacts(
          path.join(targets.frontend, "sdk/build"),
          await targetSdkInputs(targets.frontend)
        );
        result = { status: "ready", artifactCount: verified.artifactCount };
      } else if (name === "api-routes") {
        assert.ok(targets.api, "Select an API target.");
        const verified = await prepareApi(targets.api, true);
        result = { status: verified.status === "passed" ? "ready" : "stale" };
      } else {
        const context = JSON.parse(execute(ROOT, "docker", ["context", "inspect"]))[0];
        assert.ok(
          context.Endpoints.docker.Host.startsWith("unix://") &&
            (!process.env.DOCKER_HOST || process.env.DOCKER_HOST.startsWith("unix://")),
          "Use a local Docker context."
        );
        const version = execute(ROOT, "docker", ["info", "--format", "{{.ServerVersion}}"]);
        const image = JSON.parse(execute(ROOT, "docker", ["image", "inspect", "postgres:15"]))[0];
        result = { status: "ready", version, image: image.Id };
      }
    } catch (error) {
      result = {
        status: name === "sdk-artifacts" && /changed|incomplete/.test(error.message) ? "stale" : "blocked",
        code: "target-prerequisite-unavailable",
      };
    }
    resources.push({
      ...result,
      name,
      checkedAt: new Date().toISOString(),
      next: {
        node: "Use Node 22; see docs/agent-runtime-matrix.md.",
        yarn: "Prepare the target's declared Yarn locally.",
        frontend: "Prepare target frontend locked dependencies compatible with the existing runner.",
        sdk: "Prepare target SDK locked dependencies and matching Vitest.",
        api: "Prepare the target API locked dependencies.",
        "sdk-artifacts": "Verify target SDK receipt inputs; prepare artifacts explicitly when authorized.",
        "api-routes": "Use gmx-api:prepare --api-dir TARGET --verify; generate explicitly if required.",
        database: "Prepare local Docker and postgres:15; no download or container was started.",
      }[name],
    });
  }
  const consumption = {};
  if (targets.frontend) consumption.frontend = { kind: "source", directory: path.join(targets.frontend, "sdk/src") };
  if (targets.api) {
    const manifest = JSON.parse(await readFile(path.join(targets.api, "package.json")));
    let installed;
    try {
      installed = JSON.parse(await readFile(path.join(targets.api, "node_modules/@gmx-io/sdk/package.json"))).version;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      installed = null;
    }
    consumption.api = { kind: "package", declared: manifest.dependencies?.["@gmx-io/sdk"] ?? null, installed };
  }
  const after = await identity();
  const sourceUnchanged = JSON.stringify(before) === JSON.stringify(after);
  return {
    schemaVersion: 2,
    scope: "agent-target-environment-inventory",
    status:
      sourceUnchanged &&
      resources.filter((entry) => selected.includes(entry.name)).every((entry) => entry.status === "ready")
        ? "ready"
        : "blocked",
    startedAt,
    finishedAt: new Date().toISOString(),
    selected,
    sourceBefore: before,
    sourceAfter: after,
    sourceUnchanged,
    resources,
    sdkConsumption: consumption,
    environmentReadiness: "not-evaluated",
    requirementAcceptance: "not-evaluated",
    externalResources: "not-checked",
  };
}
