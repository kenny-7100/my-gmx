import assert from "node:assert/strict";
import test from "node:test";

import { githubClient, previewEvidence, runCli } from "./agent-preview.mjs";

const sha = "a".repeat(40);
const deployed = {
  id: 123,
  name: "Cloudflare Pages: gmx-interface",
  app: { slug: "cloudflare-workers-and-pages" },
  head_sha: sha,
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/gmx-io/gmx-interface/runs/123",
  output: {
    summary:
      '<tr><td><strong>Preview URL:</strong></td><td><a href="https://1234abcd.gmx-interface.pages.dev">preview</a></td></tr>',
  },
};
function source({ changed = false, state = "open", check = deployed } = {}) {
  let reads = 0;
  return async (endpoint) => {
    if (endpoint.includes("/pulls/")) return { state, head: { sha: changed && reads++ > 0 ? "b".repeat(40) : sha } };
    return { total_count: 1, check_runs: [check] };
  };
}

test("reuses the CI resolver and refuses stale or unverified preview identities", async () => {
  const report = await previewEvidence({ pr: "3138", expectedSha: sha, request: source() });
  assert.equal(report.headSha, sha);
  assert.equal(report.url, "https://1234abcd.gmx-interface.pages.dev");
  assert.equal(report.pageVerification, "not-run");
  assert.match(report.sha256["autotests/regression/ci/resolvePreview.cjs"], /^[0-9a-f]{64}$/);
  for (const config of [
    { changed: true },
    { state: "closed" },
    { check: { ...deployed, conclusion: "failure" } },
    { check: { ...deployed, html_url: "https://example.test/123" } },
    { check: { ...deployed, output: { summary: deployed.output.summary.replace("1234abcd", "branch") } } },
  ])
    await assert.rejects(previewEvidence({ pr: "3138", request: source(config) }));
  await assert.rejects(previewEvidence({ pr: "3138", expectedSha: "b".repeat(40), request: source() }));
});

test("reads all check pages and rejects incomplete, duplicated or changing pagination", async () => {
  const first = Array.from({ length: 100 }, (_v, i) => ({ id: i }));
  for (const tail of [[], [{ id: 101 }]]) {
    const urls = [];
    const client = githubClient(async (url) => {
      urls.push(url);
      return { total_count: 100 + tail.length, check_runs: url.endsWith("page=1") ? first : tail };
    });
    const rows = await client.paginate(client.rest.checks.listForRef, { ref: sha, check_name: deployed.name });
    assert.equal(rows.length, 100 + tail.length);
    assert.equal(urls.length, 2);
    assert.ok(urls.every((url) => url.includes("filter=all&per_page=100")));
    assert.ok(urls[1].endsWith("page=2"));
  }
  for (const pages of [
    [{ total_count: 2, check_runs: [] }],
    [
      { total_count: 100, check_runs: first },
      { total_count: 100, check_runs: [{ id: 0 }] },
    ],
    [
      { total_count: 101, check_runs: first },
      { total_count: 102, check_runs: [{ id: 101 }] },
    ],
    [{ total_count: 1, check_runs: null }],
  ]) {
    let i = 0;
    const client = githubClient(async () => pages[i++]);
    await assert.rejects(client.paginate(client.rest.checks.listForRef, { ref: sha, check_name: deployed.name }));
  }
});

test("CLI rejects invalid input and transport errors without logging input or credentials", async () => {
  for (const args of [
    [],
    ["--pr", "-1"],
    ["--pr", "01"],
    ["--pr", "3138", "--expected-sha", "secret-invalid"],
    ["--pr", "3138", "--project", "unknown"],
  ]) {
    let output = "";
    let requests = 0;
    const code = await runCli({
      args,
      request: async () => {
        requests++;
        throw new Error("secret-token");
      },
      stderr: {
        write: (s) => {
          output += s;
        },
      },
    });
    assert.equal(code, 1);
    assert.equal(requests, 0);
    assert.ok(!output.includes("secret-"));
  }
  let output = "";
  assert.equal(
    await runCli({
      args: ["--pr", "3138"],
      request: async () => {
        throw new Error("secret-token");
      },
      stderr: {
        write: (s) => {
          output += s;
        },
      },
    }),
    1
  );
  assert.ok(!output.includes("secret-token"));
  let success = "";
  assert.equal(
    await runCli({
      args: ["--pr", "3138"],
      request: source(),
      stdout: {
        write: (s) => {
          success += s;
        },
      },
    }),
    0
  );
  assert.equal(JSON.parse(success).scope, "github-pr-preview");
});
