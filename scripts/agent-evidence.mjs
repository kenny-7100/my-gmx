import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";

const SCOPES = new Set([
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

export async function packEvidence({ issue, reports, outDir }) {
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
  const manifest = {
    schemaVersion: 1,
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
  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return verifyEvidence({ dir: outDir });
}

export async function verifyEvidence({ dir }) {
  check(typeof dir === "string" && dir.length > 0);
  const stat = await lstat(dir);
  check(stat.isDirectory() && !stat.isSymbolicLink());
  const manifestBytes = await regularFile(path.join(dir, "manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  check(plain(manifest) && manifest.schemaVersion === 1 && manifest.scope === "acceptance-evidence-package");
  check(typeof manifest.issue === "string" && /^[A-Z][A-Z0-9]*-[1-9][0-9]*$/.test(manifest.issue));
  check(
    manifest.requirementAcceptance === "not-evaluated" &&
      typeof manifest.packerSha256 === "string" &&
      HASH.test(manifest.packerSha256)
  );
  check(typeof manifest.createdAt === "string" && Number.isFinite(Date.parse(manifest.createdAt)));
  check(Array.isArray(manifest.reports) && manifest.reports.length > 0 && manifest.reports.length <= 20);
  const files = new Set(["manifest.json"]);
  for (const entry of manifest.reports) {
    check(plain(entry) && typeof entry.name === "string" && NAME.test(entry.name));
    check(entry.file === `${entry.name}.json` && !files.has(entry.file));
    files.add(entry.file);
    const actual = describe(entry.name, await regularFile(path.join(dir, entry.file)));
    check(isDeepStrictEqual(actual, entry));
  }
  check(isDeepStrictEqual((await readdir(dir)).sort(), [...files].sort()));
  return {
    status: "passed",
    scope: "evidence-package-integrity",
    issue: manifest.issue,
    manifestSha256: hash(manifestBytes),
    requirementAcceptance: "not-evaluated",
    reports: manifest.reports,
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
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      stdout.write(
        "Usage: yarn agent:evidence pack --issue FESOL-123 --report name=report.json [--report other=other.json] --out PATH\n       yarn agent:evidence verify --dir PATH\nOffline integrity only. Does not run checks, infer requirement acceptance, or upload files.\n"
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
      report = await packEvidence({ issue: values.issue, reports, outDir: values.out });
    } else {
      check(
        positionals[0] === "verify" &&
          values.issue === undefined &&
          values.report === undefined &&
          values.out === undefined
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
