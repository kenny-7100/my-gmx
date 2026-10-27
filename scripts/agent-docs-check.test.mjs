import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { checkDocuments, runCli } from "./agent-docs-check.mjs";

async function fixture(t) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "gmx-doc-links-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(path.join(rootDir, "docs"));
  await writeFile(path.join(rootDir, "docs", "目标 file.md"), "# 中文 `API`\n## Same\n## Same-1\n## Same\n");
  await writeFile(path.join(rootDir, "asset.txt"), "asset");
  await writeFile(path.join(rootDir, "docs", "file name.md"), "# English\n");
  await writeFile(path.join(rootDir, "docs", "emphasis.md"), "# _Emphasis_\n");
  await writeFile(path.join(rootDir, "docs", "setext.md"), "Legacy heading\n===\n");
  await writeFile(path.join(rootDir, "docs", "html-heading.md"), "# <em>Heading</em>\n");
  return { rootDir, file: path.join(rootDir, "docs", "start.md") };
}

test("checks local paths and ordered duplicate heading anchors while ignoring code and external destinations", async (t) => {
  const { rootDir, file } = await fixture(t);
  const input = [
    "# Start",
    "[self](#start)",
    "[Unicode](%E7%9B%AE%E6%A0%87%20file.md#中文-api)",
    "[duplicate](<目标 file.md#same-2>)",
    "[English angle](<file name.md#english>)",
    "[asset](../asset.txt)",
    "[directory](../docs)",
    "[external](https://invalid.example/a#no-network)",
    "[mail](mailto:nobody@example.invalid)",
    "[connector](app://connector)",
    "`[not a link](missing.md)`",
    "~~~sh",
    "[not a link](missing-fenced.md)",
    "# Not a heading",
    "~~~",
    "```sh",
    "node missing-script.mjs",
    "[ignored](missing.md)",
    "```",
  ].join("\n");
  await writeFile(file, input);
  const report = await checkDocuments({ rootDir, files: ["docs/start.md"] });
  assert.equal(report.status, "passed");
  assert.equal(report.localLinks, 6);
  assert.equal(report.externalLinksSkipped, 3);
  assert.equal(report.inputs.length, 3);
  assert.equal(report.externalReachability, "not-checked");
  assert.equal(await readFile(file, "utf8"), input);
});

test("reports missing targets, unsupported syntax and workspace escapes with source line numbers", async (t) => {
  const { rootDir, file } = await fixture(t);
  await symlink("目标 file.md", path.join(rootDir, "docs", "link.md"));
  await symlink(tmpdir(), path.join(rootDir, "outside"));
  for (const [link, code] of [
    ["[missing](missing.md)", "missing-target"],
    ["[missing](<目标 file.md#absent>)", "missing-heading-anchor"],
    ["[setext](setext.md#legacy-heading)", "unsupported-setext-heading"],
    ["[emphasis](emphasis.md#emphasis)", "unsupported-heading-syntax"],
    ["[html heading](html-heading.md#heading)", "unsupported-heading-syntax"],
    ["[code heading](#not-a-heading)", "missing-heading-anchor"],
    ["[link](link.md)", "symbolic-link-not-supported"],
    ["[escape](../../outside.md)", "path-outside-workspace"],
    ["[escape](../outside/)", "symbolic-link-not-supported"],
    ["[absolute](/tmp/x)", "absolute-target-not-supported"],
    ["[bad](%zz)", "invalid-url-encoding"],
    ["[query](../asset.txt?raw=1)", "unsupported-local-query"],
    ["[fragment](../asset.txt#x)", "unsupported-fragment-target"],
    ["[empty](#)", "unsupported-fragment-target"],
    ["[local](file:///tmp/x)", "unsupported-link-scheme"],
    ['[title](../asset.txt "title")', "unsupported-link-syntax"],
    ["[nested](file(a).md)", "unsupported-link-syntax"],
    ["    [indented](missing.md)", "unsupported-indented-link"],
    ["[reference][name]", "unsupported-link-syntax"],
    ["[name]: ../asset.txt", "unsupported-link-syntax"],
    ["<a href='missing.md'>link</a>", "unsupported-link-syntax"],
  ]) {
    await writeFile(file, `# Start\n${link}\n\`\`\`\n# Not a heading\n\`\`\`\n`);
    const report = await checkDocuments({ rootDir, files: ["docs/start.md"] });
    assert.equal(report.status, "failed", link);
    assert.deepEqual(report.diagnostics, [{ file: "docs/start.md", line: 2, code }], link);
  }
});

test("keeps invocation failures distinct from document diagnostics and leaves inputs unchanged", async (t) => {
  const { rootDir, file } = await fixture(t);
  await writeFile(file, "# Start\n[self](#start)\n");
  for (const [args, code, field] of [
    [["--file", "docs/start.md"], 0, "passed"],
    [["--file", "docs/absent.md"], 1, "failed"],
    [["--file", "asset.txt"], 1, "failed"],
    [["--file", "../outside.md"], 1, "failed"],
    [[], 2, "failed"],
    [["--file", "docs/start.md", "--file", "docs/start.md"], 2, "failed"],
    [["--unknown"], 2, "failed"],
  ]) {
    let output = "";
    const stream = {
      write: (s) => {
        output += s;
      },
    };
    assert.equal(await runCli({ rootDir, args, stdout: stream, stderr: stream }), code);
    assert.equal(JSON.parse(output).status, field);
  }
  assert.equal(await readFile(file, "utf8"), "# Start\n[self](#start)\n");
});
