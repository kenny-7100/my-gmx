import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyEvidence } from "./agent-evidence.mjs";
import { collectRunMaterials, packRunMaterials } from "./lib/agent-run-materials.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixture(t, status = "passed") {
  const parent = path.join(ROOT, ".local/acceptance/fullstack");
  await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(path.join(parent, "material-fixture-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const save = async (name, value) => {
    const file = path.join(dir, name);
    const bytes = typeof value === "string" ? value : JSON.stringify(value);
    await writeFile(file, bytes);
    return { file, sha256: hash(bytes) };
  };
  const targets = { config: { api: { directory: "/fixture/api" } } };
  const plan = await save("plan.json", { mode: "agent-test-plan", targets });
  const artifacts = {
    log: await save("jest.log", "original failure or success log\n"),
    results: await save("jest-results.json", { testResults: [] }),
    network: await save("network.log", "installed\n"),
  };
  const original = await save("report.json", {
    mode: "offline-fixtures",
    status,
    apiDir: "/fixture/api",
    suites: ["src/value.test.ts"],
    logFile: artifacts.log.file,
    resultsFile: artifacts.results.file,
    network: { eventsFile: artifacts.network.file },
  });
  const run = await save("run.json", {
    schemaVersion: 2,
    mode: "agent-test-run",
    status,
    targets,
    planFile: plan.file,
    planSha256: plan.sha256,
    scopes: {
      "api-offline": {
        status,
        testsExecuted: true,
        suites: ["src/value.test.ts"],
        reportFile: original.file,
        reportSha256: original.sha256,
        artifacts,
      },
    },
  });
  return { dir, run, artifacts, original };
}

test("execution material packages preserve success and failure away from original paths", async (t) => {
  for (const status of ["passed", "failed"]) {
    const f = await fixture(t, status);
    const list = await collectRunMaterials(f.run.file);
    assert.equal(list.status, "passed");
    assert.equal(list.executionStatus, status);
    assert.equal(list.materials.length, 6);
    const outDir = path.join(f.dir, "package");
    const packed = await packRunMaterials({ runFile: f.run.file, issue: "INFRA-1", outDir });
    const received = path.join(f.dir, "received");
    await cp(outDir, received, { recursive: true });
    await rm(f.original.file);
    const verified = await verifyEvidence({ dir: received, expectedManifestSha256: packed.manifestSha256 });
    assert.equal(verified.manifestIdentity, "matched");
    assert.equal(verified.requirementAcceptance, "not-evaluated");
    assert.equal(JSON.parse(await readFile(path.join(received, "artifact-run.json"))).status, status);
    await writeFile(path.join(received, "artifact-api-offline-log.log"), "tampered\n");
    await assert.rejects(verifyEvidence({ dir: received, expectedManifestSha256: packed.manifestSha256 }));
  }
});

test("material discovery rejects missing, changed and symlinked original evidence", async (t) => {
  for (const mutation of ["missing", "changed", "symlink", "report", "missing-digest"]) {
    const f = await fixture(t);
    const file = mutation === "report" ? f.original.file : f.artifacts.log.file;
    if (mutation === "missing-digest") {
      const run = JSON.parse(await readFile(f.run.file));
      delete run.planSha256;
      await writeFile(f.run.file, JSON.stringify(run));
    }
    if (mutation === "missing" || mutation === "symlink") await rm(file);
    if (mutation === "symlink") await symlink(f.artifacts.network.file, file);
    if (mutation === "changed" || mutation === "report") await writeFile(file, "changed\n");
    const list = await collectRunMaterials(f.run.file);
    assert.equal(list.status, "blocked");
    assert.ok(list.diagnostics.length);
    await assert.rejects(
      packRunMaterials({ runFile: f.run.file, issue: "INFRA-1", outDir: path.join(f.dir, "package") })
    );
  }
});
