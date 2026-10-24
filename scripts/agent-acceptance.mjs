import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const STATUSES = ["passed", "failed", "blocked", "not-run", "partial"];
const CONDITION_COLUMNS = [
  "ID",
  "原要求与来源",
  "环境/数据与预期",
  "执行方法/命令",
  "状态",
  "证据及证明边界",
  "剩余操作",
];
const EVIDENCE_COLUMNS = ["证据 ID", "时间", "命令/操作", "退出码/结果", "原始产物及摘要"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function check(condition, code) {
  if (!condition) throw new Error(code);
}

function table(lines, columns, allowEmpty = false) {
  const cells = (line) =>
    line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
  const matches = lines.flatMap((line, index) => {
    if (!line.trim().startsWith("|")) return [];
    return cells(line)[0] === columns[0] ? [index] : [];
  });
  check(matches.length === 1, "missing-or-duplicate-table");
  const start = matches[0];
  check(JSON.stringify(cells(lines[start])) === JSON.stringify(columns), "invalid-table-columns");
  check(/^\s*\|/.test(lines[start + 1] ?? ""), "missing-table-separator");
  const separator = cells(lines[start + 1]);
  check(
    separator.length === columns.length && separator.every((cell) => /^:?-{3,}:?$/.test(cell)),
    "invalid-table-separator"
  );
  const rows = [];
  let end = start + 2;
  for (; end < lines.length && lines[end].trim().startsWith("|"); end++) {
    const i = end;
    check(lines[i].trim().endsWith("|"), "invalid-table-row");
    const row = cells(lines[i]);
    check(row.length === columns.length && row.every(Boolean), "invalid-or-empty-table-cell");
    rows.push(row);
  }
  for (let i = end; i < lines.length && !/^## /.test(lines[i]); i++) {
    check(!lines[i].trim().startsWith("|"), "fragmented-table");
  }
  check(allowEmpty || rows.length > 0, "empty-table");
  return rows;
}

export function checkWorksheet(markdown) {
  check(typeof markdown === "string" && !/<[^>\n]+>/.test(markdown), "unfilled-placeholder");
  // Fenced examples cannot supply tables or conclusions for the actual report.
  check(!/^\s*(`{3,}|~{3,})/m.test(markdown), "fenced-block-not-supported");
  check(!/<!--|-->/.test(markdown), "html-comment-not-supported");
  const declarations = [...markdown.matchAll(/^- 业务需求验收结论：([a-z-]+)(?:[；;。\s]|$)/gm)];
  check(declarations.length === 1 && STATUSES.includes(declarations[0][1]), "invalid-conclusion");
  const lines = markdown.split(/\r?\n/);
  const conditions = table(lines, CONDITION_COLUMNS);
  const evidence = table(lines, EVIDENCE_COLUMNS, true);
  const records = new Map();
  for (const [id, , , result] of evidence) {
    check(/^E[0-9]+$/.test(id) && !records.has(id), "invalid-or-duplicate-evidence-id");
    check(/^(?:0|[1-9][0-9]{0,2}|manual-passed|manual-failed)$/.test(result), "invalid-execution-result");
    records.set(id, result);
  }
  const ids = new Set();
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const [id, , , , status, proof, remaining] of conditions) {
    check(/^R[1-9][0-9]*$/.test(id) && !ids.has(id), "invalid-or-duplicate-condition-id");
    ids.add(id);
    check(STATUSES.includes(status), "invalid-condition-status");
    counts[status]++;
    const refs = [...proof.matchAll(/\bE[0-9]+\b/g)].map((match) => match[0]);
    check(
      refs.every((ref) => records.has(ref)),
      "unknown-evidence-reference"
    );
    if (["passed", "partial", "failed"].includes(status)) check(refs.length > 0, "missing-execution-evidence");
    if (status === "passed") {
      check(
        refs.every((ref) => ["0", "manual-passed"].includes(records.get(ref))),
        "passed-with-failed-execution"
      );
    } else {
      check(remaining !== "—" && remaining !== "-", "missing-next-action");
    }
  }
  const overall = counts.failed
    ? "failed"
    : counts.blocked
      ? "blocked"
      : counts.passed === conditions.length
        ? "passed"
        : counts["not-run"] === conditions.length
          ? "not-run"
          : "partial";
  check(declarations[0][1] === overall, "inconsistent-conclusion");
  return {
    status: "passed",
    scope: "acceptance-worksheet-consistency",
    requirementAcceptance: overall,
    evidenceSufficiency: "not-evaluated",
    requirementCoverage: "not-evaluated",
    counts,
    evidenceRecords: records.size,
  };
}

export async function runCli({ args = process.argv.slice(2), stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    const { values } = parseArgs({
      args,
      options: { file: { type: "string" }, help: { type: "boolean", short: "h" } },
    });
    if (values.help) {
      stdout.write(
        "Usage: yarn agent:acceptance --file PATH.md\nOffline worksheet consistency only; does not assess evidence sufficiency or requirement coverage.\nExit 0: consistent and all passed; 2: consistent but incomplete; 1: invalid or requirement failed.\n"
      );
      return 0;
    }
    check(typeof values.file === "string" && path.extname(values.file) === ".md", "invalid-file-option");
    const stat = await lstat(values.file);
    check(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 1024 * 1024, "invalid-input-file");
    const bytes = await readFile(values.file);
    check(bytes.length <= 1024 * 1024, "invalid-input-file");
    const report = {
      ...checkWorksheet(bytes.toString("utf8")),
      checkedAt: new Date().toISOString(),
      worksheetSha256: hash(bytes),
      checkerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    };
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.requirementAcceptance === "passed" ? 0 : report.requirementAcceptance === "failed" ? 1 : 2;
  } catch (error) {
    const code =
      error instanceof Error && /^[a-z]+(?:-[a-z]+)+$/.test(error.message) ? error.message : "worksheet-input-error";
    stderr.write(
      `${JSON.stringify({ status: "failed", scope: "acceptance-worksheet-consistency", code, requirementAcceptance: "not-evaluated" })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
