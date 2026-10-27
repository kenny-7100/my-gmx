import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MAX_BYTES = 2 * 1024 * 1024;

function fail(code) {
  throw new Error(code);
}

function visibleLines(markdown) {
  let fence;
  return markdown.split(/\r?\n/).map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = undefined;
      }
      return "";
    }
    if (marker) {
      fence = marker[1];
      return "";
    }
    return line;
  });
}

function headingIds(lines) {
  const ids = new Set();
  for (const [index, line] of lines.entries()) {
    if (/^ {0,3}(?:=+|-+)\s*$/.test(line) && lines[index - 1]?.trim() && !/^\s*[#|]/.test(lines[index - 1]))
      fail("unsupported-setext-heading");
    const match = line.match(/^ {0,3}#{1,6}[ \t]+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const text = match[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    if (/<|&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i.test(text) || text.replace(/(`+)(.*?)\1/g, "").includes("_"))
      fail("unsupported-heading-syntax");
    const slug = text
      .toLowerCase()
      // eslint-disable-next-line es-x/no-regexp-unicode-property-escapes -- Node supports Unicode categories for heading anchors.
      .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, "")
      .replace(/ /g, "-");
    let id = slug;
    let duplicate = 0;
    while (ids.has(id)) id = `${slug}-${++duplicate}`;
    ids.add(id);
  }
  return ids;
}

function linksOnLine(line) {
  if (/^(?: {4}|\t)/.test(line) && /\]\(|\]\s*\[/.test(line)) fail("unsupported-indented-link");
  const masked = line.replace(/(`+)(.*?)\1/g, (match) => " ".repeat(match.length));
  const links = [];
  const pattern = /\]\((<[^>\n]+>|[^\s()<>]+)\)/g;
  let match;
  while ((match = pattern.exec(masked))) links.push(match[1].replace(/^<|>$/g, ""));
  const remaining = masked.replace(pattern, "");
  if (/`|\]\s*\[|^ {0,3}\[[^\]]+\]:|<\/?[a-z!]/i.test(remaining) || remaining.includes("]("))
    fail("unsupported-link-syntax");
  return links;
}

export async function checkDocuments({ rootDir = ROOT, files }) {
  if (!Array.isArray(files) || !files.length || files.length > 50 || new Set(files).size !== files.length) {
    fail("invalid-file-selection");
  }
  const root = await realpath(rootDir);
  const documents = new Map();
  const diagnostics = [];
  let localLinks = 0;
  let externalLinks = 0;
  const inside = (file) => {
    const relative = path.relative(root, file);
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  async function resolveFile(file) {
    if (!inside(file)) fail("path-outside-workspace");
    const stat = await lstat(file).catch(() => fail("missing-target"));
    if (stat.isSymbolicLink()) fail("symbolic-link-not-supported");
    if (!inside(await realpath(file))) fail("path-outside-workspace");
    if (!stat.isFile() && !stat.isDirectory()) fail("unsupported-target-type");
    return stat;
  }
  async function document(file) {
    if (documents.has(file)) return documents.get(file);
    const stat = await resolveFile(file);
    if (!stat.isFile() || stat.size > MAX_BYTES || path.extname(file).toLowerCase() !== ".md")
      fail("invalid-markdown-file");
    const bytes = await readFile(file);
    if (bytes.length > MAX_BYTES) fail("invalid-markdown-file");
    const result = {
      lines: visibleLines(bytes.toString("utf8")),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    documents.set(file, result);
    return result;
  }
  for (const name of files) {
    const file = path.resolve(root, name);
    const add = (line, code) => diagnostics.push({ file: name, line, code });
    let source;
    try {
      if (path.isAbsolute(name) || !inside(file)) fail("invalid-source-path");
      source = await document(file);
    } catch (error) {
      add(1, error.message);
      continue;
    }
    for (const [index, line] of source.lines.entries()) {
      try {
        for (const raw of linksOnLine(line)) {
          if (/^(?:https?:|mailto:|app:|plugin:|\/\/)/i.test(raw)) {
            externalLinks++;
            continue;
          }
          if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) fail("unsupported-link-scheme");
          if (raw.includes("?")) fail("unsupported-local-query");
          const hash = raw.indexOf("#");
          const targetPath = decodeURIComponent(hash < 0 ? raw : raw.slice(0, hash));
          const fragment = hash < 0 ? undefined : decodeURIComponent(raw.slice(hash + 1));
          if (path.isAbsolute(targetPath)) fail("absolute-target-not-supported");
          const target = targetPath ? path.resolve(path.dirname(file), targetPath) : file;
          const stat = await resolveFile(target);
          localLinks++;
          if (fragment !== undefined) {
            if (!fragment || !stat.isFile() || path.extname(target).toLowerCase() !== ".md")
              fail("unsupported-fragment-target");
            const doc = await document(target);
            if (!headingIds(doc.lines).has(fragment)) fail("missing-heading-anchor");
          }
        }
      } catch (error) {
        add(index + 1, error instanceof URIError ? "invalid-url-encoding" : error.message);
      }
    }
  }
  return {
    scope: "local-markdown-links",
    status: diagnostics.length ? "failed" : "passed",
    checkedAt: new Date().toISOString(),
    selected: files,
    localLinks,
    externalLinksSkipped: externalLinks,
    inputs: [...documents].map(([file, doc]) => ({ file: path.relative(root, file), sha256: doc.sha256 })),
    diagnostics,
    externalReachability: "not-checked",
    contentAccuracy: "not-evaluated",
  };
}

export async function runCli({
  args = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  rootDir = ROOT,
} = {}) {
  try {
    const { values } = parseArgs({
      args,
      options: { file: { type: "string", multiple: true }, help: { type: "boolean", short: "h" } },
    });
    if (values.help) {
      stdout.write(
        "Usage: yarn agent:docs-check --file docs/PATH.md [--file docs/OTHER.md ...]\nOffline explicit Markdown links and ATX heading anchors only. No network, execution, or writes.\nExit 0: supported links valid; 1: diagnostics; 2: invalid invocation.\n"
      );
      return 0;
    }
    const report = await checkDocuments({ rootDir, files: values.file });
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 1;
  } catch {
    stderr.write(
      `${JSON.stringify({ scope: "local-markdown-links", status: "failed", code: "invalid-docs-check-invocation" })}\n`
    );
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
