import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  collectPages,
  compareSnapshots,
  createClient,
  fetchSnapshot,
  loadSnapshot,
  publishSnapshot,
  readApiKey,
  selectIssues,
} from "./linear-requirements.mjs";

const TEAM_ID = "64f06d97-6f54-4d0a-a064-fe7e5f342719";
const PROJECT_ID = "7de89d39-ee4e-46d4-9d70-48ef42c87886";

function issue(number, overrides = {}) {
  return {
    id: `uuid-${number}`,
    identifier: `FESOL-${number}`,
    title: `Issue ${number}`,
    description: "Acceptance criteria",
    url: `https://linear.app/gmx-io/issue/FESOL-${number}`,
    state: { name: "Todo", type: "unstarted" },
    project: { id: PROJECT_ID, name: "Migration" },
    ...overrides,
  };
}

function snapshot(issues) {
  return {
    schemaVersion: 1,
    team: { id: TEAM_ID, key: "FESOL" },
    fetchedAt: "2026-10-24T00:00:00.000Z",
    coverage: { allPages: true, includeArchived: true },
    issues,
  };
}

function page(nodes, hasNextPage = false, endCursor = null) {
  return { nodes, pageInfo: { hasNextPage, endCursor } };
}

test("pagination preserves archived records and rejects incomplete or unstable reads", async () => {
  const archived = issue(2, { archivedAt: "2026-10-01T00:00:00Z" });
  const cases = [
    { pages: [page([issue(1)], true, "next"), page([archived])], count: 2 },
    { pages: [page([issue(1)], true, "next"), page([issue(1)])], error: /Duplicate/ },
    { pages: [page([], true, "same"), page([], true, "same")], error: /did not advance/ },
    { pages: [page([], true, null)], error: /did not advance/ },
    { pages: [{ nodes: [] }], error: /invalid connection/ },
  ];
  for (const entry of cases) {
    let index = 0;
    const result = collectPages(async () => entry.pages[index++]);
    if (entry.error) await assert.rejects(result, entry.error);
    else assert.equal((await result).length, entry.count);
  }
});

test("snapshot publication retains the previous latest after a later page fails", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gmx-linear-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await publishSnapshot(directory, snapshot([issue(1)]));
  const before = await fs.readFile(path.join(directory, "latest.json"), "utf8");
  let calls = 0;
  const client = async () => {
    if (++calls === 2) throw new Error("Upstream unavailable");
    return { team: { id: TEAM_ID, key: "FESOL", name: "Solana Frontend", issues: page([issue(2)], true, "next") } };
  };
  await assert.rejects(async () => publishSnapshot(directory, await fetchSnapshot(client)), /Upstream/);
  assert.equal(await fs.readFile(path.join(directory, "latest.json"), "utf8"), before);
  assert.equal((await loadSnapshot(directory)).issues[0].identifier, "FESOL-1");
  await assert.rejects(publishSnapshot(directory, { ...snapshot([]), coverage: { allPages: false } }), /incomplete/);
  assert.equal(await fs.readFile(path.join(directory, "latest.json"), "utf8"), before);
});

test("diff separates status changes, archival, and movement across project scope", () => {
  const before = snapshot([issue(1), issue(2), issue(3), issue(4, { project: null })]);
  const after = snapshot([
    issue(1, { state: { name: "Done", type: "completed" } }),
    issue(2, { project: null }),
    issue(3, { archivedAt: "2026-10-24T00:00:00Z" }),
    issue(4),
    issue(5),
  ]);
  const all = compareSnapshots(before, after);
  assert.deepEqual(
    all.added.map((entry) => entry.identifier),
    ["FESOL-5"]
  );
  assert.equal(all.removed.length, 0);
  assert.deepEqual(
    all.changed.map((entry) => entry.identifier),
    ["FESOL-1", "FESOL-2", "FESOL-3", "FESOL-4"]
  );
  const scoped = compareSnapshots(before, after, { project: "migration" });
  assert.deepEqual(
    scoped.added.map((entry) => entry.identifier),
    ["FESOL-4", "FESOL-5"]
  );
  assert.deepEqual(
    scoped.removed.map((entry) => entry.identifier),
    ["FESOL-2"]
  );
  assert.deepEqual(
    selectIssues(after, { status: "completed", search: "FESOL-1" }).map((entry) => entry.identifier),
    ["FESOL-1"]
  );
  assert.deepEqual(compareSnapshots(after, after).changed, []);
});

test("request failures reject partial data without leaking credentials or upstream error text", async () => {
  const secret = "test-credential-never-log";
  const responses = [
    async () => {
      throw new Error(secret);
    },
    async () => ({ ok: false, status: 401 }),
    async () => ({ ok: false, status: 429 }),
    async () => ({
      ok: true,
      json: async () => {
        throw new Error(secret);
      },
    }),
    async () => ({ ok: true, json: async () => ({ data: { team: {} }, errors: [{ message: secret }] }) }),
  ];
  for (const response of responses) {
    await assert.rejects(createClient(secret, response)("query { team { id } }"), (error) => {
      assert.ok(!error.message.includes(secret));
      return true;
    });
  }
});

test("env parsing accepts quoted tokens without executing values and rejects ambiguous entries", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gmx-linear-env-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const envFile = path.join(directory, ".env.local");
  const previous = process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_API_KEY;
  t.after(() => {
    if (previous === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = previous;
  });
  for (const line of [
    "LINEAR_API_KEY=example-token",
    'export LINEAR_API_KEY="example-token" # local',
    "LINEAR_API_KEY='example-token'",
  ]) {
    await fs.writeFile(envFile, line);
    assert.equal(await readApiKey(envFile), "example-token");
  }
  await fs.writeFile(envFile, "LINEAR_API_KEY=$(not-executed)");
  assert.equal(await readApiKey(envFile), "$(not-executed)");
  for (const line of ["LINEAR_API_KEY=", 'LINEAR_API_KEY="unclosed', "LINEAR_API_KEY=one\nLINEAR_API_KEY=two"]) {
    await fs.writeFile(envFile, line);
    await assert.rejects(readApiKey(envFile));
  }
  process.env.LINEAR_API_KEY = "environment-token";
  assert.equal(await readApiKey(envFile), "environment-token");
});
