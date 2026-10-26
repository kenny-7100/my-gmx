import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

import { inventory, promote, verifyArtifacts } from "./sdk-artifacts.mjs";

test("SDK provenance rejects unknown, stale, missing, modified and extra artifacts", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-sdk-artifacts-"));
  const source = { node: process.version, sha256: "fixture-source", fileCount: 1 };
  try {
    for (const version of ["v1", "v2"]) {
      for (const format of ["types", "cjs", "esm"]) {
        const name = `${format}/src/clients/${version}/index.${format === "types" ? "d.ts" : "js"}`;
        await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
        await writeFile(path.join(dir, name), "fixture content");
      }
    }
    for (const mode of ["cjs", "esm"]) await writeFile(path.join(dir, mode, "src/package.json"), "{}");
    await assert.rejects(verifyArtifacts(dir, source));
    const receipt = { schemaVersion: 1, source, artifacts: await inventory(dir) };
    const receiptPath = path.join(dir, ".agent-build.json");
    await writeFile(receiptPath, JSON.stringify(receipt));
    assert.equal((await verifyArtifacts(dir, source)).status, "passed");
    await assert.rejects(verifyArtifacts(dir, { ...source, sha256: "changed-source" }), /changed/);
    const target = path.join(dir, "cjs/src/package.json");
    await writeFile(target, "damaged");
    await assert.rejects(verifyArtifacts(dir, source), /artifacts changed/);
    await rm(target);
    await assert.rejects(verifyArtifacts(dir, source), /Missing/);
    await writeFile(target, "{}");
    await writeFile(path.join(dir, "extra.js"), "extra");
    await assert.rejects(verifyArtifacts(dir, source), /artifacts changed/);
    await rm(path.join(dir, "extra.js"));
    await symlink(target, path.join(dir, "linked.js"));
    await assert.rejects(verifyArtifacts(dir, source), /Unsupported non-file/);
    await rm(path.join(dir, "linked.js"));
    await writeFile(receiptPath, JSON.stringify({ ...receipt, schemaVersion: 2 }));
    await assert.rejects(verifyArtifacts(dir, source), /schema/);
    await writeFile(receiptPath, "broken json");
    await assert.rejects(verifyArtifacts(dir, source), SyntaxError);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("SDK promotion preserves the old build when replacement fails", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-sdk-promote-"));
  try {
    const target = path.join(dir, "build");
    const backup = path.join(dir, "backup");
    const staged = path.join(dir, "staged");
    await mkdir(target);
    await writeFile(path.join(target, "previous"), "old build");
    await assert.rejects(promote(staged, target, backup));
    assert.equal(await readFile(path.join(target, "previous"), "utf8"), "old build");
    await mkdir(staged);
    await writeFile(path.join(staged, "current"), "new build");
    await promote(staged, target, backup);
    assert.equal(await readFile(path.join(target, "current"), "utf8"), "new build");
    assert.equal(await readFile(path.join(backup, "previous"), "utf8"), "old build");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
