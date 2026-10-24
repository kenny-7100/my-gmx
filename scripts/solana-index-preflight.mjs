import { decodeBase58 } from "ethers";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

const execute = promisify(execFile);
const CONFIG = "gmx-api/src/config/protocolStats.ts";
export const QUERY =
  "query AgentSolanaIndex { squidStatus { height } volumeRecords(limit: 1, orderBy: timestamp_DESC) { id timestamp marketToken volume } }";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code) => {
  throw Object.assign(new Error("Index preflight failed."), { code });
};
const requireValid = (condition) => {
  if (!condition) fail("invalid-response");
};

export async function readIndexConfig() {
  const bytes = await readFile(new URL(`../${CONFIG}`, import.meta.url));
  const text = bytes.toString("utf8");
  const urls = [...text.matchAll(/PROTOCOL_STATS_GMTRADE_SQUID_URL:\s*str\(\{\s*default:\s*"([^"]+)"/g)];
  const ages = [...text.matchAll(/PROTOCOL_STATS_FRESH_MAX_AGE_SECONDS:\s*num\(\{\s*default:\s*(\d+)\s*\}\)/g)];
  if (urls.length !== 1 || ages.length !== 1) fail("configuration-error");
  const endpoint = new URL(urls[0][1]);
  const maxAgeSeconds = Number(ages[0][1]);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !endpoint.hostname.endsWith(".squids.live") ||
    !endpoint.pathname.endsWith("/api/graphql") ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds <= 0
  )
    fail("configuration-error");
  return { endpoint: endpoint.href, maxAgeSeconds, configFile: CONFIG, configSha256: hash(bytes) };
}

export async function queryIndex(endpoint, query = QUERY, run = execute) {
  let stdout;
  try {
    ({ stdout } = await run(
      "curl",
      [
        "--silent",
        "--show-error",
        "--fail",
        "--max-time",
        "25",
        "--request",
        "POST",
        "--header",
        "content-type: application/json",
        "--data",
        JSON.stringify({ query }),
        endpoint,
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 }
    ));
  } catch {
    fail("request-failed");
  }
  try {
    return JSON.parse(stdout);
  } catch {
    fail("invalid-json");
  }
}

export function interpretIndex(body, { maxAgeSeconds, now = Date.now() }) {
  if (body?.errors !== undefined && (!Array.isArray(body.errors) || body.errors.length > 0)) fail("graphql-error");
  const data = body?.data;
  requireValid(Number.isSafeInteger(data?.squidStatus?.height) && data.squidStatus.height >= 0);
  requireValid(Array.isArray(data.volumeRecords) && data.volumeRecords.length <= 1);
  const base = {
    indexHeight: String(data.squidStatus.height),
    maxEventAgeSeconds: maxAgeSeconds,
    processingLag: "not-evaluated",
    historyCompleteness: "not-evaluated",
  };
  if (data.volumeRecords.length === 0)
    return { ...base, status: "blocked", code: "no-volume-record", latestRecord: null };
  const record = data.volumeRecords[0];
  requireValid(record && typeof record.id === "string" && record.id.length > 0 && record.id.length <= 512);
  requireValid(typeof record.volume === "string" && /^(0|[1-9][0-9]*)$/.test(record.volume));
  requireValid(typeof record.marketToken === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(record.marketToken));
  const key = decodeBase58(record.marketToken);
  const size = record.marketToken.match(/^1*/)[0].length + (key === 0n ? 0 : Math.ceil(key.toString(16).length / 2));
  requireValid(size === 32);
  requireValid(
    typeof record.timestamp === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(record.timestamp)
  );
  const timestamp = Date.parse(record.timestamp);
  requireValid(
    Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 19) === record.timestamp.slice(0, 19)
  );
  const ageSeconds = (now - timestamp) / 1000;
  requireValid(Number.isFinite(ageSeconds));
  const code =
    ageSeconds < 0
      ? "future-volume-record"
      : ageSeconds > maxAgeSeconds
        ? "stale-volume-record"
        : "recent-volume-record";
  return {
    ...base,
    status: code === "recent-volume-record" ? "passed" : "blocked",
    code,
    latestEventAgeSeconds: ageSeconds,
    latestRecord: record,
  };
}

export async function indexPreflight({ query = queryIndex, now = () => Date.now() } = {}) {
  const config = await readIndexConfig();
  const body = await query(config.endpoint);
  const observedAt = now();
  return {
    scope: "solana-statistics-index",
    checkedAt: new Date(observedAt).toISOString(),
    ...config,
    ...interpretIndex(body, { maxAgeSeconds: config.maxAgeSeconds, now: observedAt }),
    querySha256: hash(QUERY),
    checkerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  };
}

export async function runCli({
  args = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  ...options
} = {}) {
  try {
    const { values } = parseArgs({ args, options: { help: { type: "boolean", short: "h" } } });
    if (values.help) {
      stdout.write(
        "Usage: yarn solana:index-preflight\nRead-only existing Solana statistics index. Reports latest event age, not processor lag or historical completeness.\n"
      );
      return 0;
    }
    const report = await indexPreflight(options);
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 2;
  } catch (error) {
    const known = ["configuration-error", "request-failed", "invalid-json", "graphql-error", "invalid-response"];
    stderr.write(
      `${JSON.stringify({ status: "failed", code: known.includes(error?.code) ? error.code : "configuration-or-index-error", message: "Check configured SQD endpoint, API source, curl availability and index response. No response body or credential details were logged." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
