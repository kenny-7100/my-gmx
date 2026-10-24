import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";

import { checkWorksheet } from "./agent-acceptance.mjs";

const SCOPES = new Set([
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

function bindWorksheet(bytes, entries) {
  const matches = entries.filter((entry) => entry.descriptor.scope === "acceptance-worksheet-consistency");
  if (bytes === undefined) {
    check(matches.length === 0);
    return undefined;
  }
  check(bytes.length <= 1024 * 1024 && matches.length === 1);
  const entry = matches[0];
  const report = JSON.parse(entry.bytes.toString("utf8"));
  const actual = checkWorksheet(bytes.toString("utf8"));
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

export async function packEvidence({ issue, reports, outDir, worksheet }) {
  check(typeof issue === "string" && /^[A-Z][A-Z0-9]*-[1-9][0-9]*$/.test(issue));
  check(Array.isArray(reports) && reports.length > 0 && reports.length <= 20);
  check(typeof outDir === "string" && outDir.length > 0);
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
  const manifest = {
    schemaVersion: worksheetDescriptor ? 2 : 1,
    ...(worksheetDescriptor ? { worksheet: worksheetDescriptor } : {}),
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
  if (worksheetBytes) await writeFile(path.join(outDir, "worksheet.md"), worksheetBytes, { flag: "wx" });
  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return verifyEvidence({ dir: outDir });
}

export async function verifyEvidence({ dir }) {
  check(typeof dir === "string" && dir.length > 0);
  const stat = await lstat(dir);
  check(stat.isDirectory() && !stat.isSymbolicLink());
  const manifestBytes = await regularFile(path.join(dir, "manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  check(plain(manifest) && [1, 2].includes(manifest.schemaVersion) && manifest.scope === "acceptance-evidence-package");
  check(manifest.schemaVersion === 2 ? plain(manifest.worksheet) : manifest.worksheet === undefined);
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
  for (const entry of manifest.reports) {
    check(plain(entry) && typeof entry.name === "string" && NAME.test(entry.name));
    check(entry.file === `${entry.name}.json` && !files.has(entry.file));
    files.add(entry.file);
    const bytes = await regularFile(path.join(dir, entry.file));
    const actual = describe(entry.name, bytes);
    entries.push({ bytes, descriptor: actual });
    check(isDeepStrictEqual(actual, entry));
  }
  let worksheet;
  if (manifest.schemaVersion === 2) {
    check(manifest.worksheet.file === "worksheet.md");
    files.add("worksheet.md");
    worksheet = bindWorksheet(await regularFile(path.join(dir, "worksheet.md")), entries);
    check(isDeepStrictEqual(manifest.worksheet, worksheet));
  } else {
    bindWorksheet(undefined, entries);
  }
  check(isDeepStrictEqual((await readdir(dir)).sort(), [...files].sort()));
  return {
    status: "passed",
    scope: "evidence-package-integrity",
    issue: manifest.issue,
    manifestSha256: hash(manifestBytes),
    requirementAcceptance: "not-evaluated",
    reports: manifest.reports,
    ...(worksheet ? { worksheet } : {}),
  };
}

export async function runCli({ args = process.argv.slice(2), stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        issue: { type: "string" },
        report: { type: "string", multiple: true },
        out: { type: "string" },
        dir: { type: "string" },
        worksheet: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      stdout.write(
        "Usage: yarn agent:evidence pack --issue FESOL-123 --report name=report.json [--report other=other.json] [--worksheet PATH.md] --out PATH\n       yarn agent:evidence verify --dir PATH\nOffline integrity and optional worksheet consistency only. Does not execute recorded commands, infer acceptance coverage, or upload files.\n"
      );
      return 0;
    }
    check(positionals.length === 1);
    let report;
    if (positionals[0] === "pack") {
      check(values.dir === undefined && Array.isArray(values.report));
      const reports = values.report.map((item) => {
        const separator = item.indexOf("=");
        check(separator > 0);
        return { name: item.slice(0, separator), file: item.slice(separator + 1) };
      });
      report = await packEvidence({ issue: values.issue, reports, outDir: values.out, worksheet: values.worksheet });
    } else {
      check(
        positionals[0] === "verify" &&
          values.issue === undefined &&
          values.report === undefined &&
          values.out === undefined &&
          values.worksheet === undefined
      );
      report = await verifyEvidence({ dir: values.dir });
    }
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch {
    stderr.write(
      `${JSON.stringify({ status: "failed", code: "evidence-package-error", message: "Check report format, file integrity, unique names and output directory. Inputs and existing output are never overwritten. No input contents were logged." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
