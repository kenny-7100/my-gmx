import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TEAM_ID = "64f06d97-6f54-4d0a-a064-fe7e5f342719";
const PROJECT_ID = "7de89d39-ee4e-46d4-9d70-48ef42c87886";
const API_URL = "https://api.linear.app/graphql";
const ISSUE_FIELDS = `id identifier title description url createdAt updatedAt archivedAt completedAt
  priority dueDate state { id name type } assignee { id name }
  project { id name } parent { id identifier } labels { nodes { name } }`;

function fail(message) {
  throw new Error(message);
}

export async function readApiKey(envFile = path.join(ROOT, ".env.local")) {
  if (process.env.LINEAR_API_KEY?.trim()) return process.env.LINEAR_API_KEY.trim();
  let content;
  try {
    content = await fs.readFile(envFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    fail("Set LINEAR_API_KEY in the environment or the selected env file.");
  }
  const entries = content.split(/\r?\n/).filter((line) => /^\s*(?:export\s+)?LINEAR_API_KEY\s*=/.test(line));
  if (entries.length !== 1) fail("The env file must contain exactly one LINEAR_API_KEY entry.");
  let value = entries[0].replace(/^\s*(?:export\s+)?LINEAR_API_KEY\s*=\s*/, "").trim();
  if (value.startsWith('"') || value.startsWith("'")) {
    const match = value.match(/^(["'])(.*?)\1\s*(?:#.*)?$/);
    if (!match) fail("LINEAR_API_KEY must be a single-line value with balanced quotes.");
    value = match[2];
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }
  if (!value || /\s/.test(value)) fail("LINEAR_API_KEY must be a nonempty single-line token.");
  return value;
}

export function createClient(apiKey, fetchImpl = fetch) {
  return async (query, variables = {}) => {
    let response;
    try {
      response = await fetchImpl(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: apiKey },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
    } catch {
      fail("Linear request failed or timed out. No snapshot was published.");
    }
    if (!response.ok) fail(`Linear returned HTTP ${response.status}. Check credentials, access, or rate limits.`);
    let result;
    try {
      result = await response.json();
    } catch {
      fail("Linear returned invalid JSON.");
    }
    // Never print upstream bodies or errors: they may contain sensitive request data.
    if (result.errors?.length || !result.data)
      fail("Linear GraphQL request failed. Check access and query compatibility.");
    return result.data;
  };
}

export async function collectPages(loadPage) {
  const nodes = [];
  const ids = new Set();
  const cursors = new Set();
  let cursor;
  do {
    const page = await loadPage(cursor);
    if (!Array.isArray(page?.nodes) || typeof page?.pageInfo?.hasNextPage !== "boolean") {
      fail("Linear returned an invalid connection.");
    }
    for (const node of page.nodes) {
      if (!node?.id || ids.has(node.id)) fail("Duplicate or invalid record during pagination. Run sync again.");
      ids.add(node.id);
      nodes.push(node);
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
    if (!cursor || cursors.has(cursor)) fail("Linear pagination did not advance.");
    cursors.add(cursor);
  } while (true);
  return nodes;
}

export async function fetchSnapshot(client) {
  const startedAt = new Date().toISOString();
  let team;
  const issues = await collectPages(async (after) => {
    const data = await client(
      `query TeamIssues($after: String) {
      team(id: "${TEAM_ID}") { id key name
        issues(first: 50, after: $after, includeArchived: true, orderBy: createdAt) {
          nodes { ${ISSUE_FIELDS} } pageInfo { hasNextPage endCursor }
        }
      }
    }`,
      { after }
    );
    if (data.team?.id !== TEAM_ID || data.team.key !== "FESOL")
      fail("The API key cannot access the expected FESOL team.");
    team = { id: data.team.id, key: data.team.key, name: data.team.name };
    return data.team.issues;
  });
  issues.sort((a, b) => Number(a.identifier.split("-").at(-1)) - Number(b.identifier.split("-").at(-1)));
  return {
    schemaVersion: 1,
    source: API_URL,
    team,
    projectId: PROJECT_ID,
    startedAt,
    fetchedAt: new Date().toISOString(),
    coverage: {
      allPages: true,
      includeArchived: true,
      descriptions: true,
      relations: false,
      comments: false,
      attachments: false,
    },
    issues,
  };
}

export function validateSnapshot(snapshot) {
  if (
    snapshot?.schemaVersion !== 1 ||
    snapshot.team?.id !== TEAM_ID ||
    !snapshot.coverage?.allPages ||
    !snapshot.coverage.includeArchived ||
    !Array.isArray(snapshot.issues) ||
    !Number.isFinite(Date.parse(snapshot.fetchedAt))
  ) {
    fail("Invalid or incomplete FESOL snapshot.");
  }
  const ids = new Set();
  for (const issue of snapshot.issues) {
    if (!issue.id || !/^FESOL-\d+$/.test(issue.identifier) || !issue.state?.type || ids.has(issue.id)) {
      fail("Snapshot contains invalid or duplicate issues.");
    }
    ids.add(issue.id);
  }
  return snapshot;
}

export function selectIssues(snapshot, options = {}) {
  return snapshot.issues.filter(
    (issue) =>
      (!options.project ||
        (options.project === "migration"
          ? issue.project?.id === PROJECT_ID
          : [issue.project?.id, issue.project?.name].includes(options.project))) &&
      (!options.status || [issue.state.name, issue.state.type].includes(options.status)) &&
      (!options.search ||
        `${issue.identifier} ${issue.title} ${issue.description ?? ""}`
          .toLowerCase()
          .includes(options.search.toLowerCase()))
  );
}

function counts(issues) {
  const result = {};
  for (const issue of issues) result[issue.state.name] = (result[issue.state.name] ?? 0) + 1;
  return Object.entries(result)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `| ${name} | ${count} |`)
    .join("\n");
}

export async function renderSummary(snapshot) {
  const migration = selectIssues(snapshot, { project: "migration" });
  const escape = (value) => value.replace(/\|/g, "\\|").replace(/[\r\n]/g, " ");
  const values = {
    fetchedAt: snapshot.fetchedAt,
    total: snapshot.issues.length,
    migrationTotal: migration.length,
    allStates: counts(snapshot.issues),
    migrationStates: counts(migration),
    migrationIssues: migration
      .map((issue) => `| [${issue.identifier}](${issue.url}) | ${escape(issue.title)} | ${issue.state.name} |`)
      .join("\n"),
  };
  const template = await fs.readFile(path.join(ROOT, "docs/linear-summary.template.md"), "utf8");
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) fail(`Unknown summary template field: ${key}`);
    return String(values[key]);
  });
}

export async function publishSnapshot(directory, snapshot) {
  validateSnapshot(snapshot);
  const summary = await renderSummary(snapshot);
  const id = `${snapshot.fetchedAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const target = path.join(directory, "snapshots", id);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await fs.writeFile(path.join(target, "summary.md"), summary, { flag: "wx", mode: 0o600 });
  const pointer = path.join(directory, `.latest-${randomUUID()}.tmp`);
  await fs.writeFile(pointer, `${JSON.stringify({ snapshot: `snapshots/${id}/snapshot.json` })}\n`, { mode: 0o600 });
  await fs.rename(pointer, path.join(directory, "latest.json"));
  return path.join(target, "snapshot.json");
}

export async function loadSnapshot(directory, filename) {
  if (!filename) {
    const pointer = JSON.parse(await fs.readFile(path.join(directory, "latest.json"), "utf8"));
    if (typeof pointer.snapshot !== "string" || !/^snapshots\/[^/]+\/snapshot\.json$/.test(pointer.snapshot)) {
      fail("Invalid latest snapshot pointer.");
    }
    filename = path.join(directory, pointer.snapshot);
  }
  return validateSnapshot(JSON.parse(await fs.readFile(filename, "utf8")));
}

export function compareSnapshots(before, after, options = {}) {
  validateSnapshot(before);
  validateSnapshot(after);
  const left = new Map(selectIssues(before, options).map((issue) => [issue.id, issue]));
  const right = new Map(selectIssues(after, options).map((issue) => [issue.id, issue]));
  const added = [...right.values()].filter((issue) => !left.has(issue.id));
  const removed = [...left.values()].filter((issue) => !right.has(issue.id));
  const changed = [];
  for (const [id, issue] of right) {
    const previous = left.get(id);
    if (!previous) continue;
    const fields = Object.keys(issue).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(issue[key]));
    if (fields.length)
      changed.push({
        identifier: issue.identifier,
        title: issue.title,
        fields,
        before: Object.fromEntries(fields.map((key) => [key, previous[key]])),
        after: Object.fromEntries(fields.map((key) => [key, issue[key]])),
      });
  }
  return { before: before.fetchedAt, after: after.fetchedAt, added, removed, changed };
}

export async function fetchLiveIssue(client, identifier) {
  if (!/^FESOL-\d+$/.test(identifier)) fail("Expected a FESOL issue identifier, such as FESOL-97.");
  const { issue } = await client(
    `query Issue($id: String!) {
    issue(id: $id) { ${ISSUE_FIELDS} team { id key } }
  }`,
    { id: identifier }
  );
  if (issue?.team?.id !== TEAM_ID) fail("The issue is unavailable or outside FESOL.");
  const selections = {
    relations: "id type relatedIssue { identifier title url state { name type } }",
    inverseRelations: "id type issue { identifier title url state { name type } }",
    comments: "id body createdAt updatedAt user { name } parent { id }",
  };
  const detail = {};
  // Sequential reads keep request load bounded and make authorization failures explicit.
  for (const [name, fields] of Object.entries(selections)) {
    detail[name] = await collectPages(async (after) => {
      const data = await client(
        `query IssueDetails($id: String!, $after: String) {
        issue(id: $id) { ${name}(first: 50, after: $after) {
          nodes { ${fields} } pageInfo { hasNextPage endCursor }
        } }
      }`,
        { id: issue.id, after }
      );
      return data.issue?.[name];
    });
  }
  return {
    fetchedAt: new Date().toISOString(),
    coverage: { relations: true, comments: true, attachments: false },
    issue: { ...issue, ...detail },
  };
}

const HELP = `Read-only FESOL requirements tool (Node.js >=20).
Usage:
  node scripts/linear-requirements.mjs sync
  node scripts/linear-requirements.mjs list [--project migration] [--status Todo] [--search text] [--json]
  node scripts/linear-requirements.mjs show FESOL-97 [--live] [--json]
  node scripts/linear-requirements.mjs diff BEFORE.json AFTER.json [--project migration] [--json]
Options:
  --directory PATH   Snapshot directory (default: .local/linear/FESOL under the repository)
  --snapshot PATH    Snapshot file for offline list/show (default: latest)
  --env-file PATH    Env file for online reads (default: repository .env.local)
  --help             Show this help
Online commands use LINEAR_API_KEY from the environment, then the env file.
Sync saves descriptions and metadata, not comments, relations, or attachment contents.
Show --live reads the current issue, all relation pages, and all comment pages.
Local data is a dated cache, not proof of implementation or deployment.
Diff 'removed' means absent from the selected scope, not necessarily deleted in Linear.`;

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: "boolean" },
      json: { type: "boolean" },
      live: { type: "boolean" },
      directory: { type: "string" },
      snapshot: { type: "string" },
      "env-file": { type: "string" },
      project: { type: "string" },
      status: { type: "string" },
      search: { type: "string" },
    },
  });
  if (values.help || !positionals.length) return console.log(HELP);
  const [command, ...operands] = positionals;
  const allowed = {
    sync: ["directory", "env-file"],
    list: ["directory", "snapshot", "project", "status", "search", "json"],
    show: ["directory", "snapshot", "live", "env-file", "json"],
    diff: ["project", "json"],
  };
  if (!allowed[command]) fail(`Unknown command: ${command}`);
  for (const key of Object.keys(values))
    if (!allowed[command].includes(key)) fail(`--${key} is not supported by ${command}.`);
  const expected = { sync: 0, list: 0, show: 1, diff: 2 }[command];
  if (operands.length !== expected) fail(`${command} expects ${expected} positional arguments. Use --help.`);
  if (values.live && values.snapshot) fail("--live and --snapshot cannot be combined.");
  const directory = path.resolve(values.directory ?? path.join(ROOT, ".local/linear/FESOL"));
  const online = async () => createClient(await readApiKey(values["env-file"]));
  if (command === "sync") {
    const snapshot = await fetchSnapshot(await online());
    const filename = await publishSnapshot(directory, snapshot);
    console.log(
      `Synced ${snapshot.issues.length} FESOL issues (${selectIssues(snapshot, { project: "migration" }).length} in the migration project).\nSnapshot: ${filename}\nSummary: ${path.join(path.dirname(filename), "summary.md")}\nFetched at: ${snapshot.fetchedAt}`
    );
  } else if (command === "list") {
    const snapshot = await loadSnapshot(directory, values.snapshot);
    const issues = selectIssues(snapshot, values);
    if (values.json)
      console.log(JSON.stringify({ fetchedAt: snapshot.fetchedAt, coverage: snapshot.coverage, issues }, null, 2));
    else {
      console.log(`Snapshot fetched at: ${snapshot.fetchedAt}\nMatched: ${issues.length}`);
      for (const issue of issues) console.log(`${issue.identifier}\t${issue.state.name}\t${issue.title}`);
    }
  } else if (command === "show") {
    let result;
    if (values.live) result = await fetchLiveIssue(await online(), operands[0]);
    else {
      const snapshot = await loadSnapshot(directory, values.snapshot);
      const issue = snapshot.issues.find((issue) => issue.identifier === operands[0]);
      if (!issue) fail("Issue not found in this snapshot. Try show --live.");
      result = { fetchedAt: snapshot.fetchedAt, coverage: snapshot.coverage, issue };
    }
    if (values.json) console.log(JSON.stringify(result, null, 2));
    else {
      const issue = result.issue;
      console.log(
        `${issue.identifier}: ${issue.title}\nStatus: ${issue.state.name}\nURL: ${issue.url}\nFetched at: ${result.fetchedAt}\nCoverage: ${JSON.stringify(result.coverage)}\n\n${issue.description ?? ""}`
      );
      if (values.live)
        console.log(
          `\nRelations and comments:\n${JSON.stringify({ relations: issue.relations, inverseRelations: issue.inverseRelations, comments: issue.comments }, null, 2)}`
        );
    }
  } else {
    const [before, after] = await Promise.all(operands.map((file) => loadSnapshot(directory, file)));
    if (Date.parse(after.fetchedAt) < Date.parse(before.fetchedAt))
      fail("AFTER is older than BEFORE. Reverse the arguments.");
    const diff = compareSnapshots(before, after, values);
    if (values.json) console.log(JSON.stringify(diff, null, 2));
    else {
      console.log(
        `Before: ${diff.before}\nAfter: ${diff.after}\nAdded: ${diff.added.length}; removed from scope: ${diff.removed.length}; changed: ${diff.changed.length}`
      );
      for (const issue of diff.added) console.log(`+ ${issue.identifier}: ${issue.title}`);
      for (const issue of diff.removed) console.log(`- ${issue.identifier}: ${issue.title}`);
      for (const issue of diff.changed)
        console.log(`~ ${issue.identifier}: ${JSON.stringify({ before: issue.before, after: issue.after })}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // Keep credentials out of diagnostics, including filesystem and upstream errors.
    console.error(`Error: ${error.message.replace(/lin_api_[A-Za-z0-9_-]+/g, "[redacted]")}`);
    process.exitCode = 1;
  });
}
