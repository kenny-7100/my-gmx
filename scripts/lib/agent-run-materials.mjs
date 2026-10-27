import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ACCEPTANCE = path.join(ROOT, ".local/acceptance");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const MODES = new Set([
  "frontend-source-offline",
  "sdk-source-offline",
  "offline-fixtures",
  "isolated-postgres-integration",
]);

async function readMaterial(file) {
  assert.ok(typeof file === "string" && path.isAbsolute(file), "Use an absolute generated material path.");
  const actual = await realpath(file);
  const root = await realpath(ACCEPTANCE);
  assert.ok(
    actual.startsWith(`${root}${path.sep}`) && actual === path.resolve(file),
    "Material must be a regular file within local acceptance output, without symlinks."
  );
  const stat = await lstat(file);
  assert.ok(
    stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 16 * 1024 * 1024,
    "Material must be a nonempty regular file within the artifact size limit."
  );
  const bytes = await readFile(file);
  return { bytes, sha256: hash(bytes) };
}

export async function collectRunMaterials(runFile) {
  runFile = path.resolve(runFile);
  const runBytes = await readMaterial(runFile);
  const run = JSON.parse(runBytes.bytes);
  assert.equal(run.mode, "agent-test-run");
  assert.equal(run.schemaVersion, 2, "Use a fullstack execution report.");
  assert.ok(["passed", "partial", "failed", "blocked"].includes(run.status));
  const materials = [];
  const diagnostics = [];
  async function add(name, file, expected) {
    try {
      const item = await readMaterial(file);
      assert.match(expected, /^[0-9a-f]{64}$/, "Missing execution-time material digest.");
      assert.equal(item.sha256, expected, "Material changed after execution.");
      const extension = path.extname(file);
      assert.ok([".json", ".log", ".txt", ".png", ".zip"].includes(extension), "Unsupported artifact extension.");
      assert.ok(
        item.bytes.length > 0 && item.bytes.length <= 16 * 1024 * 1024,
        "Material is empty or exceeds the artifact size limit."
      );
      materials.push({
        name,
        originalPath: file,
        packageFile: `artifact-${name}${extension}`,
        bytes: item.bytes.length,
        sha256: item.sha256,
      });
      return item;
    } catch {
      diagnostics.push({ name, code: "missing-changed-or-unsupported-material" });
      return undefined;
    }
  }
  await add("run", runFile, runBytes.sha256);
  const planBytes = await add("plan", run.planFile, run.planSha256);
  if (planBytes) {
    const plan = JSON.parse(planBytes.bytes);
    assert.equal(plan.mode, "agent-test-plan");
    assert.deepEqual(plan.targets, run.targets, "Run and plan targets differ.");
  }
  for (const [scope, entry] of Object.entries(run.scopes)) {
    assert.ok(["frontend", "sdk", "api-offline", "api-database"].includes(scope), "Unknown execution scope.");
    if (!entry.reportFile) {
      if (entry.testsExecuted || entry.status === "passed")
        diagnostics.push({ name: scope, code: "missing-original-report" });
      continue;
    }
    const item = await add(`${scope}-report`, entry.reportFile, entry.reportSha256);
    if (!item) continue;
    const original = JSON.parse(item.bytes);
    assert.ok(MODES.has(original.mode), "Unsupported native runner report.");
    assert.equal(
      original.mode,
      {
        frontend: "frontend-source-offline",
        sdk: "sdk-source-offline",
        "api-offline": "offline-fixtures",
        "api-database": "isolated-postgres-integration",
      }[scope],
      "Runner mode differs from execution scope."
    );
    assert.equal(original.status, entry.status, "Original runner status differs.");
    assert.deepEqual(original.suites, entry.suites, "Original runner suites differ.");
    const target = scope.startsWith("api-")
      ? run.targets.config.api.directory
      : scope === "sdk"
        ? path.join(run.targets.config.frontend.directory, "sdk")
        : run.targets.config.frontend.directory;
    assert.equal(original.apiDir ?? original.sdkDir ?? original.projectDir, target, "Original report target differs.");
    for (const [kind, file] of [
      ["log", original.logFile],
      ["results", original.resultsFile],
      ["network", original.network?.eventsFile],
    ]) {
      if (typeof file === "string" && entry.artifacts?.[kind]?.file === file && entry.artifacts[kind].sha256)
        await add(`${scope}-${kind}`, file, entry.artifacts[kind].sha256);
      else diagnostics.push({ name: `${scope}-${kind}`, code: "missing-original-reference" });
    }
  }
  if (materials.length > 20 || materials.reduce((sum, item) => sum + item.bytes, 0) > 64 * 1024 * 1024)
    diagnostics.push({ code: "existing-evidence-package-limits-exceeded" });
  return {
    schemaVersion: 1,
    scope: "agent-test-run-materials",
    status: diagnostics.length ? "blocked" : "passed",
    checkedAt: new Date().toISOString(),
    executionStatus: run.status,
    runFile,
    runSha256: runBytes.sha256,
    targets: run.targets,
    materials,
    diagnostics,
    requirementAcceptance: "not-evaluated",
    boundary:
      "Execution reports and their known log/results/network fields only. Discovery artifacts, browser directories, source checkouts and business acceptance are not collected. No upload or secret redaction.",
  };
}

export async function packRunMaterials({ runFile, issue, outDir }) {
  const report = await collectRunMaterials(runFile);
  assert.equal(report.status, "passed", "Resolve material diagnostics before packing.");
  const root = path.join(ACCEPTANCE, "fullstack");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "materials-"));
  const file = path.join(directory, "report.json");
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  const { packEvidence } = await import("../agent-evidence.mjs");
  const packed = await packEvidence({
    issue,
    outDir,
    reports: [{ name: "materials", file }],
    artifacts: report.materials.map((item) => ({ name: item.name, file: item.originalPath })),
  });
  return { ...packed, executionStatus: report.executionStatus, materialsReport: file };
}
