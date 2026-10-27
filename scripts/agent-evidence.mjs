import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";

import { checkWorksheet } from "./agent-acceptance.mjs";

const SCOPES = new Set([
  "agent-test-run-materials",
  "solana-browser-prerequisites",
  "local-source-comparison",
  "acceptance-worksheet-consistency",
  "real-wasm-reference-vectors",
  "solana-statistics-index",
  "github-pr-preview",
  "local-artifacts",
  "local-artifacts-and-mainnet-program",
  "configured-mainnet-lookup-tables",
  "transaction-receipt",
  "local-read-only-infrastructure",
]);
const STATUSES = new Set(["passed", "failed", "blocked", "not-run", "partial"]);
const NAME = /^[a-z][a-z0-9-]{0,39}$/;
const HASH = /^[0-9a-f]{64}$/;
const MAX_BYTES = 16 * 1024 * 1024;
const ARTIFACT_EXTENSIONS = new Set([".json", ".log", ".txt", ".png", ".zip"]);
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition) => {
  if (!condition) throw new Error("Invalid evidence input or package.");
};
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

async function regularFile(file) {
  const stat = await lstat(file);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= MAX_BYTES);
  const bytes = await readFile(file);
  check(bytes.length > 0 && bytes.length <= MAX_BYTES);
  return bytes;
}

function describe(name, bytes) {
  check(NAME.test(name) && name !== "manifest");
  const report = JSON.parse(bytes.toString("utf8"));
  check(plain(report) && SCOPES.has(report.scope) && STATUSES.has(report.status));
  const observedAt = report.checkedAt ?? report.finishedAt;
  check(
    typeof observedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(observedAt) && Number.isFinite(Date.parse(observedAt))
  );
  return {
    name,
    file: `${name}.json`,
    bytes: bytes.length,
    sha256: hash(bytes),
    scope: report.scope,
    status: report.status,
    observedAt,
  };
}

function describeArtifact(name, extension, bytes) {
  check(typeof name === "string" && NAME.test(name) && name !== "manifest");
  check(ARTIFACT_EXTENSIONS.has(extension));
  return { name, file: `artifact-${name}${extension}`, bytes: bytes.length, sha256: hash(bytes) };
}

function bindWorksheet(bytes, entries) {
  const matches = entries.filter((entry) => entry.descriptor.scope === "acceptance-worksheet-consistency");
  if (bytes === undefined) {
    check(matches.length === 0);
    return undefined;
  }
  check(bytes.length <= 1024 * 1024 && matches.length === 1);
  const entry = matches[0];
  const report = JSON.parse(entry.bytes.toString("utf8"));
  const actual = checkWorksheet(bytes.toString("utf8"), { includeMapping: report.mapping !== undefined });
  check(Object.entries(actual).every(([key, value]) => isDeepStrictEqual(report[key], value)));
  check(
    report.worksheetSha256 === hash(bytes) &&
      typeof report.checkerSha256 === "string" &&
      HASH.test(report.checkerSha256)
  );
  return {
    file: "worksheet.md",
    bytes: bytes.length,
    sha256: hash(bytes),
    report: entry.descriptor.name,
    requirementAcceptance: actual.requirementAcceptance,
  };
}

function bindRunMaterials(entries, artifacts) {
  for (const entry of entries.filter((item) => item.descriptor.scope === "agent-test-run-materials")) {
    const report = JSON.parse(entry.bytes);
    check(report.status === "passed" && Array.isArray(report.materials) && report.materials.length > 0);
    check(Array.isArray(report.diagnostics) && report.diagnostics.length === 0);
    for (const material of report.materials) {
      const artifact = artifacts.find((item) => item.name === material.name);
      check(
        artifact &&
          artifact.file === material.packageFile &&
          artifact.bytes === material.bytes &&
          artifact.sha256 === material.sha256
      );
    }
  }
}

export async function packEvidence({ issue, reports, outDir, worksheet, artifacts = [] }) {
  check(typeof issue === "string" && /^[A-Z][A-Z0-9]*-[1-9][0-9]*$/.test(issue));
  check(Array.isArray(reports) && reports.length > 0 && reports.length <= 20);
  check(typeof outDir === "string" && outDir.length > 0);
  check(Array.isArray(artifacts) && artifacts.length <= 20);
  const entries = [];
  const names = new Set();
  for (const report of reports) {
    check(
      plain(report) &&
        typeof report.name === "string" &&
        NAME.test(report.name) &&
        report.name !== "manifest" &&
        !names.has(report.name)
    );
    names.add(report.name);
    check(typeof report.file === "string" && path.extname(report.file) === ".json");
    const bytes = await regularFile(report.file);
    entries.push({ bytes, descriptor: describe(report.name, bytes) });
  }
  check(worksheet === undefined || (typeof worksheet === "string" && path.extname(worksheet) === ".md"));
  const worksheetBytes = worksheet === undefined ? undefined : await regularFile(worksheet);
  const worksheetDescriptor = bindWorksheet(worksheetBytes, entries);
  const artifactEntries = [];
  const files = new Set(["manifest.json", "worksheet.md", ...entries.map((entry) => entry.descriptor.file)]);
  let artifactBytes = 0;
  for (const artifact of artifacts) {
    check(plain(artifact) && typeof artifact.file === "string" && !names.has(artifact.name));
    const extension = path.extname(artifact.file);
    check(ARTIFACT_EXTENSIONS.has(extension));
    const bytes = await regularFile(artifact.file);
    const descriptor = describeArtifact(artifact.name, extension, bytes);
    check(!files.has(descriptor.file));
    artifactBytes += bytes.length;
    check(artifactBytes <= MAX_ARTIFACT_BYTES);
    names.add(artifact.name);
    files.add(descriptor.file);
    artifactEntries.push({ bytes, descriptor });
  }
  bindRunMaterials(
    entries,
    artifactEntries.map((entry) => entry.descriptor)
  );
  const manifest = {
    schemaVersion: artifactEntries.length ? 3 : worksheetDescriptor ? 2 : 1,
    ...(worksheetDescriptor ? { worksheet: worksheetDescriptor } : {}),
    ...(artifactEntries.length ? { artifacts: artifactEntries.map((entry) => entry.descriptor) } : {}),
    scope: "acceptance-evidence-package",
    issue,
    createdAt: new Date().toISOString(),
    requirementAcceptance: "not-evaluated",
    packerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    reports: entries.map((entry) => entry.descriptor),
  };
  await mkdir(path.dirname(path.resolve(outDir)), { recursive: true });
  // Exclusive directory creation prevents overwriting an earlier evidence package.
  await mkdir(outDir);
  for (const entry of entries) await writeFile(path.join(outDir, entry.descriptor.file), entry.bytes, { flag: "wx" });
  for (const entry of artifactEntries)
    await writeFile(path.join(outDir, entry.descriptor.file), entry.bytes, { flag: "wx" });
  if (worksheetBytes) await writeFile(path.join(outDir, "worksheet.md"), worksheetBytes, { flag: "wx" });
  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return verifyEvidence({ dir: outDir });
}

export async function verifyEvidence({ dir, expectedManifestSha256 }) {
  check(
    expectedManifestSha256 === undefined ||
      (typeof expectedManifestSha256 === "string" && HASH.test(expectedManifestSha256))
  );
  check(typeof dir === "string" && dir.length > 0);
  const stat = await lstat(dir);
  check(stat.isDirectory() && !stat.isSymbolicLink());
  const manifestBytes = await regularFile(path.join(dir, "manifest.json"));
  const manifestSha256 = hash(manifestBytes);
  check(expectedManifestSha256 === undefined || expectedManifestSha256 === manifestSha256);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  check(
    plain(manifest) && [1, 2, 3].includes(manifest.schemaVersion) && manifest.scope === "acceptance-evidence-package"
  );
  check(
    manifest.schemaVersion === 2 || (manifest.schemaVersion === 3 && manifest.worksheet !== undefined)
      ? plain(manifest.worksheet)
      : manifest.worksheet === undefined
  );
  check(
    manifest.schemaVersion === 3
      ? Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0 && manifest.artifacts.length <= 20
      : manifest.artifacts === undefined
  );
  check(typeof manifest.issue === "string" && /^[A-Z][A-Z0-9]*-[1-9][0-9]*$/.test(manifest.issue));
  check(
    manifest.requirementAcceptance === "not-evaluated" &&
      typeof manifest.packerSha256 === "string" &&
      HASH.test(manifest.packerSha256)
  );
  check(typeof manifest.createdAt === "string" && Number.isFinite(Date.parse(manifest.createdAt)));
  check(Array.isArray(manifest.reports) && manifest.reports.length > 0 && manifest.reports.length <= 20);
  const files = new Set(["manifest.json"]);
  const entries = [];
  const names = new Set();
  for (const entry of manifest.reports) {
    check(plain(entry) && typeof entry.name === "string" && NAME.test(entry.name));
    check(entry.file === `${entry.name}.json` && !files.has(entry.file));
    files.add(entry.file);
    names.add(entry.name);
    const bytes = await regularFile(path.join(dir, entry.file));
    const actual = describe(entry.name, bytes);
    entries.push({ bytes, descriptor: actual });
    check(isDeepStrictEqual(actual, entry));
  }
  let worksheet;
  if (manifest.worksheet !== undefined) {
    check(manifest.worksheet.file === "worksheet.md");
    files.add("worksheet.md");
    worksheet = bindWorksheet(await regularFile(path.join(dir, "worksheet.md")), entries);
    check(isDeepStrictEqual(manifest.worksheet, worksheet));
  } else {
    bindWorksheet(undefined, entries);
  }
  let artifactBytes = 0;
  for (const entry of manifest.artifacts ?? []) {
    check(plain(entry) && typeof entry.file === "string" && !names.has(entry.name));
    const extension = path.extname(entry.file);
    check(ARTIFACT_EXTENSIONS.has(extension) && entry.file === `artifact-${entry.name}${extension}`);
    check(typeof entry.name === "string" && NAME.test(entry.name) && !files.has(entry.file));
    const bytes = await regularFile(path.join(dir, entry.file));
    artifactBytes += bytes.length;
    check(artifactBytes <= MAX_ARTIFACT_BYTES);
    check(isDeepStrictEqual(describeArtifact(entry.name, extension, bytes), entry));
    names.add(entry.name);
    files.add(entry.file);
  }
  bindRunMaterials(entries, manifest.artifacts ?? []);
  check(isDeepStrictEqual((await readdir(dir)).sort(), [...files].sort()));
  return {
    status: "passed",
    scope: "evidence-package-integrity",
    issue: manifest.issue,
    manifestSha256,
    manifestIdentity: expectedManifestSha256 === undefined ? "not-checked" : "matched",
    requirementAcceptance: "not-evaluated",
    reports: manifest.reports,
    ...(manifest.artifacts ? { artifacts: manifest.artifacts, artifactSemantics: "not-evaluated" } : {}),
    ...(worksheet ? { worksheet } : {}),
  };
}

export async function runCli({ args = process.argv.slice(2), stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        run: { type: "string" },
        issue: { type: "string" },
        report: { type: "string", multiple: true },
        artifact: { type: "string", multiple: true },
        out: { type: "string" },
        dir: { type: "string" },
        worksheet: { type: "string" },
        "expected-manifest-sha256": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      stdout.write(
        "Usage: yarn agent:evidence collect-run --run PATH.json [--issue FESOL-123 --out PATH]\nLists known execution materials by default; --out explicitly packages them with original-to-package mapping. No recursive scan or upload.\n       yarn agent:evidence pack --issue FESOL-123 --report name=report.json [--report other=other.json] [--worksheet PATH.md] [--artifact name=PATH ...] --out PATH\n       yarn agent:evidence verify --dir PATH [--expected-manifest-sha256 SHA256]\nOffline integrity and optional worksheet consistency only. Explicit opaque artifacts: .json/.log/.txt/.png/.zip, up to 20 files, 16 MiB each, 64 MiB total. Does not discover files, execute contents, infer acceptance coverage, or upload files.\n"
      );
      return 0;
    }
    check(positionals.length === 1);
    if (positionals[0] === "collect-run") {
      check(
        values.run &&
          !values.dir &&
          !values.report &&
          !values.artifact &&
          !values.worksheet &&
          !values["expected-manifest-sha256"]
      );
      check(Boolean(values.out) === Boolean(values.issue));
      const { collectRunMaterials, packRunMaterials } = await import("./lib/agent-run-materials.mjs");
      const collected = values.out
        ? await packRunMaterials({ runFile: values.run, issue: values.issue, outDir: values.out })
        : await collectRunMaterials(values.run);
      stdout.write(`${JSON.stringify(collected, null, 2)}\n`);
      return collected.status === "passed" ? 0 : 2;
    }
    check(values.run === undefined);
    let report;
    if (positionals[0] === "pack") {
      check(
        values.dir === undefined && values["expected-manifest-sha256"] === undefined && Array.isArray(values.report)
      );
      const parseFile = (item) => {
        const separator = item.indexOf("=");
        check(separator > 0);
        return { name: item.slice(0, separator), file: item.slice(separator + 1) };
      };
      report = await packEvidence({
        issue: values.issue,
        reports: values.report.map(parseFile),
        artifacts: values.artifact?.map(parseFile),
        outDir: values.out,
        worksheet: values.worksheet,
      });
    } else {
      check(
        positionals[0] === "verify" &&
          values.issue === undefined &&
          values.report === undefined &&
          values.artifact === undefined &&
          values.out === undefined &&
          values.worksheet === undefined
      );
      report = await verifyEvidence({ dir: values.dir, expectedManifestSha256: values["expected-manifest-sha256"] });
    }
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch {
    stderr.write(
      `${JSON.stringify({ status: "failed", code: "evidence-package-error", message: "Check expected manifest SHA-256, report format, file integrity, unique names and output directory. Inputs and existing output are never overwritten. No input contents were logged." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
