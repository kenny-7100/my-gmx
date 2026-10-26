import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

export async function apiTestTooling(apiDir, mode) {
  assert.ok(["offline-fixtures", "isolated-postgres-integration"].includes(mode), "Unknown API test mode.");
  const profile = mode === "offline-fixtures" ? "gmx-api-offline" : "gmx-api-integration";
  const toolSha256 = {};
  for (const file of [
    "scripts/gmx-api-offline-tests.mjs",
    "scripts/gmx-api-integration-tests.mjs",
    "scripts/lib/gmx-api-source.mjs",
    "scripts/lib/agent-test-process.mjs",
    "scripts/lib/agent-network-audit.mjs",
    `tools/${profile}/network-guard.cjs`,
  ])
    toolSha256[file] = createHash("sha256")
      .update(await readFile(path.join(ROOT, file)))
      .digest("hex");
  const runtime = { node: process.version, executable: process.execPath };
  for (const name of ["jest", "ts-jest", "typescript"])
    runtime[name] = JSON.parse(await readFile(path.join(apiDir, "node_modules", name, "package.json"), "utf8")).version;
  return { toolSha256, runtime };
}

export async function readApiTestSource(apiDir, files) {
  apiDir = await realpath(apiDir);
  const git = (...args) =>
    execFileSync("git", ["-C", apiDir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
  assert.equal(await realpath(git("rev-parse", "--show-toplevel")), apiDir, "Use the API Git checkout root.");
  const sha256 = {};
  for (const file of new Set(["package.json", "yarn.lock", "tsconfig.json", ...files]))
    sha256[file] = createHash("sha256")
      .update(await readFile(path.join(apiDir, file)))
      .digest("hex");
  return { commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain").length > 0, sha256 };
}

export async function sourceInputs(apiDir) {
  const files = ["package.json", "yarn.lock", "tsconfig.json"];
  const scan = async (dir) => {
    for (const entry of await readdir(path.join(apiDir, dir), { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "API source symlinks require explicit review.");
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await scan(file);
      else if (/\.(ts|js|json)$/.test(file)) files.push(file);
    }
  };
  await scan("src");
  const digest = createHash("sha256");
  for (const file of files.sort())
    digest
      .update(file)
      .update("\0")
      .update(
        createHash("sha256")
          .update(await readFile(path.join(apiDir, file)))
          .digest()
      );
  return { sha256: digest.digest("hex"), fileCount: files.length };
}
