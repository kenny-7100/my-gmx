import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import resolvePreview from "../autotests/regression/ci/resolvePreview.cjs";

const REPOSITORY = { owner: "gmx-io", repo: "gmx-interface" };
const execute = promisify(execFile);

export async function ghJson(endpoint) {
  const { stdout } = await execute("gh", ["api", "--hostname", "github.com", endpoint], {
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export function githubClient(request = ghJson) {
  const listForRef = Symbol("listForRef");
  return {
    rest: {
      pulls: {
        get: async ({ pull_number }) => ({
          data: await request(`repos/${REPOSITORY.owner}/${REPOSITORY.repo}/pulls/${pull_number}`),
        }),
      },
      checks: { listForRef },
    },
    paginate: async (method, { ref, check_name }) => {
      if (method !== listForRef) throw new Error("Unsupported GitHub operation.");
      const checks = [];
      let expectedCount;
      for (let page = 1; ; page++) {
        const data = await request(
          `repos/${REPOSITORY.owner}/${REPOSITORY.repo}/commits/${ref}/check-runs?check_name=${encodeURIComponent(check_name)}&filter=all&per_page=100&page=${page}`
        );
        if (
          !Array.isArray(data.check_runs) ||
          !Number.isSafeInteger(data.total_count) ||
          data.total_count < 0 ||
          data.check_runs.length > 100
        ) {
          throw new Error("Invalid GitHub check response.");
        }
        if (expectedCount === undefined) expectedCount = data.total_count;
        if (data.total_count !== expectedCount) throw new Error("GitHub check count changed during pagination.");
        checks.push(...data.check_runs);
        if (checks.length > data.total_count || new Set(checks.map((entry) => entry.id)).size !== checks.length) {
          throw new Error("Inconsistent GitHub check pagination.");
        }
        if (data.check_runs.length < 100) {
          if (checks.length !== data.total_count) throw new Error("GitHub checks changed during pagination.");
          return checks;
        }
      }
    },
  };
}

export async function previewEvidence({ pr, expectedSha, project = "gmx-interface", request = ghJson }) {
  if (
    typeof pr !== "string" ||
    !/^[1-9][0-9]*$/.test(pr) ||
    !Number.isSafeInteger(Number(pr)) ||
    (expectedSha !== undefined && !/^[0-9a-f]{40}$/.test(expectedSha)) ||
    !["gmx-interface", "gmx-interface-home"].includes(project)
  )
    throw new Error("Invalid preview arguments.");
  const result = await resolvePreview({
    github: githubClient(request),
    repository: REPOSITORY,
    prNumber: pr,
    expectedHeadSha: expectedSha,
    project,
  });
  if (
    !/^[0-9a-f]{40}$/.test(result.headSha) ||
    typeof result.checkUrl !== "string" ||
    !/^https:\/\/github\.com\/gmx-io\/gmx-interface\/(runs\/\d+|actions\/runs\/\d+(\/job\/\d+)?)$/.test(result.checkUrl)
  )
    throw new Error("Invalid deployment identity.");
  const sha256 = {};
  for (const file of ["scripts/agent-preview.mjs", "autotests/regression/ci/resolvePreview.cjs"]) {
    sha256[file] = createHash("sha256")
      .update(await readFile(new URL(`../${file}`, import.meta.url)))
      .digest("hex");
  }
  return {
    status: "passed",
    scope: "github-pr-preview",
    checkedAt: new Date().toISOString(),
    repository: "gmx-io/gmx-interface",
    project,
    prUrl: `https://github.com/gmx-io/gmx-interface/pull/${pr}`,
    ...result,
    evidenceType: "github-deployment-metadata",
    pageVerification: "not-run",
    sha256,
  };
}

export async function runCli({
  args = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  request,
} = {}) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        pr: { type: "string" },
        "expected-sha": { type: "string" },
        project: { type: "string", default: "gmx-interface" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      stdout.write(
        "Usage: yarn agent:preview --pr NUMBER [--expected-sha SHA] [--project gmx-interface|gmx-interface-home]\nRead-only GitHub deployment metadata. Does not open, fetch or test the preview page.\n"
      );
      return 0;
    }
    const report = await previewEvidence({
      pr: values.pr,
      expectedSha: values["expected-sha"],
      project: values.project,
      request,
    });
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch {
    stderr.write(
      `${JSON.stringify({ status: "failed", code: "preview-resolution-failed", message: "Check PR arguments, current head, successful Cloudflare check and gh GitHub access. No preview fallback was selected; request details were not logged." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
