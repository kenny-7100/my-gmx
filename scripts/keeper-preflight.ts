import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { ARBITRUM } from "sdk/configs/chains";
import { getOracleKeeperFallbackUrls, getOracleKeeperUrl } from "sdk/configs/oracleKeeper";
import { getTokenBySymbol, getWrappedToken, NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";

export const KEEPER_ENDPOINTS = {
  primary: getOracleKeeperUrl(ARBITRUM),
  "fallback-1": getOracleKeeperFallbackUrls(ARBITRUM)[0],
  "fallback-2": getOracleKeeperFallbackUrls(ARBITRUM)[1],
};
export const REQUIRED_SYMBOLS = ["SOL", "BTC", "ETH", "USDC", "USDT"];
export const CHART_SYMBOLS = ["SOL", "BTC", "ETH"];
export const MAX_PRICE_AGE_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0";

type Check = {
  name: string;
  status: "passed" | "failed" | "blocked" | "not-run";
  code: string;
  details?: unknown;
};

class CheckError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CheckError("invalid-response", message);
}

function validOhlc(values: unknown[]): boolean {
  const [open, high, low, close] = values;
  return (
    values.length === 4 &&
    values.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0) &&
    Number(low) <= Math.min(Number(open), Number(close)) &&
    Number(high) >= Math.max(Number(open), Number(close))
  );
}

export function checkTickers(data: unknown, now: number): Check[] {
  requireValid(Array.isArray(data) && data.length > 0, "Expected a non-empty ticker array.");
  return REQUIRED_SYMBOLS.map((symbol) => {
    let token = getTokenBySymbol(ARBITRUM, symbol);
    if (token.address === NATIVE_TOKEN_ADDRESS) token = getWrappedToken(ARBITRUM);
    const matches = data.filter(
      (item) =>
        isRecord(item) &&
        typeof item.tokenAddress === "string" &&
        item.tokenAddress.toLowerCase() === token.address.toLowerCase()
    );
    const name = `ticker:${symbol}`;
    if (matches.length === 0)
      return { name, status: "failed", code: "missing-price", details: { address: token.address } };
    const ticker: unknown = matches[0];
    if (
      matches.length !== 1 ||
      !isRecord(ticker) ||
      typeof ticker.minPrice !== "string" ||
      typeof ticker.maxPrice !== "string" ||
      !/^\d+$/.test(ticker.minPrice) ||
      !/^\d+$/.test(ticker.maxPrice) ||
      BigInt(ticker.minPrice) <= 0n ||
      BigInt(ticker.maxPrice) < BigInt(ticker.minPrice) ||
      typeof ticker.updatedAt !== "number" ||
      !Number.isSafeInteger(ticker.updatedAt) ||
      ticker.updatedAt <= 0
    ) {
      return { name, status: "failed", code: "invalid-price" };
    }
    const ageMs = now - ticker.updatedAt;
    const code = ageMs < 0 ? "future-price" : ageMs > MAX_PRICE_AGE_MS ? "stale-price" : "fresh-price";
    return {
      name,
      status: code === "fresh-price" ? "passed" : "failed",
      code,
      details: { address: token.address, arbitrumDecimals: token.decimals, updatedAt: ticker.updatedAt, ageMs },
    };
  });
}

export function checkDayPrices(data: unknown): Check[] {
  requireValid(Array.isArray(data) && data.length > 0, "Expected a non-empty 24h price array.");
  return CHART_SYMBOLS.map((symbol) => {
    const matches = data.filter((item) => isRecord(item) && item.tokenSymbol === symbol);
    const candle: unknown = matches[0];
    const valid =
      matches.length === 1 && isRecord(candle) && validOhlc([candle.open, candle.high, candle.low, candle.close]);
    return { name: `24h:${symbol}`, status: valid ? "passed" : "failed", code: valid ? "valid-ohlc" : "invalid-24h" };
  });
}

export function checkCandles(data: unknown, symbol: string, now: number): Check[] {
  requireValid(isRecord(data) && data.period === "1m", "Expected 1m candles.");
  requireValid(Array.isArray(data.candles) && data.candles.length > 0, "Expected non-empty candles.");
  let previousTime = Infinity;
  for (const candle of data.candles) {
    requireValid(
      Array.isArray(candle) &&
        candle.length >= 5 &&
        Number.isSafeInteger(candle[0]) &&
        candle[0] > 0 &&
        candle[0] < previousTime &&
        candle[0] * 1000 <= now &&
        validOhlc(candle.slice(1, 5)),
      "Expected descending second timestamps and positive OHLC ranges."
    );
    previousTime = candle[0];
  }
  return [
    {
      name: `candles:${symbol}`,
      status: "passed",
      code: "valid-candles",
      details: {
        count: data.candles.length,
        latestTimestamp: data.candles[0][0],
        latestAgeMs: now - data.candles[0][0] * 1000,
      },
    },
  ];
}

export function checkFlags(data: unknown): Check[] {
  requireValid(isRecord(data), "Expected a UI flags object.");
  const flag = data.solanaTrading;
  const access: Check = {
    name: "ui-flags",
    status: "passed",
    code: "flags-readable",
    details: { count: Object.keys(data).length },
  };
  if (!Object.prototype.hasOwnProperty.call(data, "solanaTrading")) {
    return [access, { name: "solanaTrading", status: "blocked", code: "flag-missing" }];
  }
  if (!isRecord(flag) || typeof flag.enabled !== "boolean") {
    return [access, { name: "solanaTrading", status: "failed", code: "invalid-flag" }];
  }
  return [
    access,
    {
      name: "solanaTrading",
      status: flag.enabled ? "passed" : "blocked",
      code: flag.enabled ? "flag-enabled" : "flag-disabled",
    },
  ];
}

async function requestJson({
  url,
  userAgent,
  fetchImpl,
}: {
  url: string;
  userAgent: string;
  fetchImpl: typeof fetch;
}): Promise<unknown> {
  let response: Response;
  let text: string;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": userAgent },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    text = await response.text();
  } catch (error) {
    const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw new CheckError(timedOut ? "timeout" : "network-error", "Request failed before the body was received.");
  }
  if (!response.ok) {
    const code =
      /error code:\s*1010|cloudflare|cf-ray/i.test(text) && response.status === 403
        ? "cloudflare-denied"
        : [401, 403].includes(response.status)
          ? "access-denied"
          : response.status === 429
            ? "rate-limited"
            : "http-error";
    throw new CheckError(code, `HTTP ${response.status}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CheckError("invalid-json", "Expected a JSON response.");
  }
  if (
    isRecord(data) &&
    (Object.prototype.hasOwnProperty.call(data, "error") || Object.prototype.hasOwnProperty.call(data, "errors"))
  ) {
    throw new CheckError("business-error", "The endpoint returned an error object.");
  }
  return data;
}

export async function runKeeperPreflight({
  endpoint = "primary",
  userAgent = USER_AGENT,
  fetchImpl = fetch,
  now = Date.now,
}: {
  endpoint?: keyof typeof KEEPER_ENDPOINTS;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
} = {}) {
  const host = KEEPER_ENDPOINTS[endpoint];
  const checks: Check[] = [];
  const requests = [
    { name: "tickers", path: "/prices/tickers", validate: checkTickers },
    { name: "24h", path: "/prices/24h", validate: checkDayPrices },
    ...CHART_SYMBOLS.map((symbol) => ({
      name: `candles:${symbol}`,
      path: `/prices/candles?tokenSymbol=${symbol}&period=1m&limit=3`,
      validate: (data: unknown, checkedAt: number) => checkCandles(data, symbol, checkedAt),
    })),
    { name: "ui-flags", path: "/ui-flags/v2", validate: checkFlags },
  ];
  for (const request of requests) {
    try {
      const data = await requestJson({ url: `${host}${request.path}`, userAgent, fetchImpl });
      checks.push(...request.validate(data, now()));
    } catch (error) {
      if (!(error instanceof CheckError)) throw error;
      checks.push({ name: request.name, status: "failed", code: error.code, details: error.message });
      if (request.name === "ui-flags") {
        checks.push({ name: "solanaTrading", status: "not-run", code: "flags-unavailable" });
      }
    }
  }
  const exitCode = checks.some((check) => check.status === "failed")
    ? 1
    : checks.some((check) => check.status !== "passed")
      ? 2
      : 0;
  return {
    checkedAt: new Date(now()).toISOString(),
    endpoint,
    host,
    userAgent,
    criteria: {
      symbols: REQUIRED_SYMBOLS,
      maxPriceAgeMs: MAX_PRICE_AGE_MS,
      chartSymbols: CHART_SYMBOLS,
      candlePeriod: "1m",
    },
    checks,
    status: exitCode === 0 ? "passed" : exitCode === 1 ? "failed" : "blocked",
    exitCode,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      endpoint: { type: "string", default: "primary" },
      "user-agent": { type: "string", default: USER_AGENT },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(
      "Usage: yarn keeper:preflight [--endpoint primary|fallback-1|fallback-2] [--user-agent VALUE]\nRead-only JSON report. Exit: 0 ready, 1 failed, 2 blocked, 3 configuration/internal error.\n"
    );
    return;
  }
  const endpoint = values.endpoint;
  if (endpoint !== "primary" && endpoint !== "fallback-1" && endpoint !== "fallback-2")
    throw new Error("Unknown keeper endpoint.");
  const userAgent = values["user-agent"];
  if (!userAgent?.trim() || /[\r\n]/.test(userAgent)) throw new Error("Invalid User-Agent.");
  const report = await runKeeperPreflight({
    endpoint,
    userAgent,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.stderr.write(
      `${JSON.stringify({
        status: "failed",
        code: "configuration-or-internal-error",
        message: "Check arguments and local configuration; use --help.",
      })}\n`
    );
    process.exitCode = 3;
  });
}
