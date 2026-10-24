import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { checkWorksheet, runCli } from "./agent-acceptance.mjs";

const example = readFileSync(new URL("../docs/acceptance/FESOL-55.md", import.meta.url), "utf8");
function worksheet(statuses, overall) {
  return `- 业务需求验收结论：${overall}；test report.

## 条件映射

| ID | 原要求与来源 | 环境/数据与预期 | 执行方法/命令 | 状态 | 证据及证明边界 | 剩余操作 |
| --- | --- | --- | --- | --- | --- | --- |
${statuses.map((status, i) => `| R${i + 1} | Scope ${i + 1} | unit-mock | run tests | ${status} | E1: unit only | Verify live behavior |`).join("\n")}

## 执行记录

| 证据 ID | 时间 | 命令/操作 | 退出码/结果 | 原始产物及摘要 |
| --- | --- | --- | --- | --- |
| E1 | 2026-10-25T00:00:00Z | yarn test:ci | 0 | local unit.log |
`;
}

test("summarizes mixed conditions without treating worksheet validity as business acceptance", () => {
  for (const [statuses, overall] of [
    [["passed"], "passed"],
    [["failed", "blocked"], "failed"],
    [["passed", "blocked", "not-run"], "blocked"],
    [["not-run", "not-run"], "not-run"],
    [["passed", "not-run"], "partial"],
    [["partial"], "partial"],
  ]) {
    const result = checkWorksheet(worksheet(statuses, overall));
    assert.equal(result.requirementAcceptance, overall);
    assert.equal(result.evidenceSufficiency, "not-evaluated");
    assert.equal(result.requirementCoverage, "not-evaluated");
    assert.equal(
      Object.values(result.counts).reduce((a, b) => a + b),
      statuses.length
    );
  }
  const actual = checkWorksheet(example);
  assert.equal(actual.requirementAcceptance, "partial");
  assert.deepEqual(actual.counts, { passed: 1, failed: 0, blocked: 0, "not-run": 2, partial: 5 });
  assert.equal(
    checkWorksheet(
      worksheet(["not-run"], "not-run")
        .replace(/\| E1 \|.*\n/, "")
        .replace("E1: unit only", "No execution yet")
    ).evidenceRecords,
    0
  );
});

test("rejects misleading conclusions, unfilled reports and broken evidence mappings", () => {
  const valid = worksheet(["passed", "not-run"], "partial");
  for (const invalid of [
    valid.replace("结论：partial", "结论：passed"),
    valid.replace("| not-run |", "| skipped |"),
    valid.replace("| R2 |", "| R1 |"),
    valid.replace("E1: unit", "E99: unit"),
    valid.replace("E1: unit", "No execution"),
    valid.replace("| 0 |", "| 1 |"),
    valid.replace("| 0 |", "| pending |"),
    valid.replace("Scope 1", "<requirement>"),
    valid.replace("| E1 |", "| E1 | 2026 | command | 0 | log |\n| E1 |"),
    valid.replace("| 状态 |", "| Result |"),
    valid.replace("| not-run | E1: unit only | Verify live behavior |", "| not-run | E1: unit only | — |"),
    `${valid}\n- 业务需求验收结论：partial`,
    `\`\`\`markdown\n${valid}\n\`\`\``,
    valid.replace("Scope 1", "Scope | 1"),
    valid.replace("| R2 |", "\n| R2 |"),
    `<!--\n${valid}\n-->`,
  ])
    assert.throws(() => checkWorksheet(invalid));
});

test("returns distinct CLI exit codes and only hashes the current input without rewriting it", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-worksheet-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "worksheet.md");
  for (const [content, expected, acceptance] of [
    [example, 2, "partial"],
    [worksheet(["passed"], "passed"), 0, "passed"],
    [worksheet(["failed"], "failed"), 1, "failed"],
    [await readFile(new URL("../docs/acceptance/template.md", import.meta.url), "utf8"), 1, "not-evaluated"],
    ["private-input-content", 1, "not-evaluated"],
  ]) {
    await writeFile(file, content);
    let output = "";
    const stream = {
      write: (text) => {
        output += text;
      },
    };
    assert.equal(await runCli({ args: ["--file", file], stdout: stream, stderr: stream }), expected);
    const report = JSON.parse(output);
    assert.equal(report.requirementAcceptance, acceptance);
    assert.ok(!output.includes("private-input-content"));
    if (acceptance !== "not-evaluated") assert.match(report.worksheetSha256, /^[0-9a-f]{64}$/);
    assert.equal(await readFile(file, "utf8"), content);
  }
});
