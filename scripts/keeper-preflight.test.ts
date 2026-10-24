import assert from "node:assert/strict";
import { test } from "node:test";

import tickers from "sdk/test/fixtures/arbitrumTickers.json";

import { checkCandles, checkDayPrices, checkTickers, runKeeperPreflight } from "./keeper-preflight";

const NOW = 1_792_850_867_062;
const prices = () => tickers.map((ticker) => ({ ...ticker, updatedAt: NOW }));
const candle = [Math.floor(NOW / 60_000) * 60, 101.3, 101.36, 101.29, 101.33];
const days = ["SOL", "BTC", "ETH"].map((tokenSymbol) => ({ tokenSymbol, open: 100, high: 102, low: 99, close: 101 }));

test("ticker validation rejects absent, stale, future, duplicate and malformed prices without losing integer precision", () => {
  assert.equal(
    checkTickers(prices(), NOW).every((check) => check.status === "passed"),
    true
  );
  const target = "0x2bcc6d6cdbbdc0a4071e48bb3b969b06b3330c07";
  const scenarios = [
    { patch: { updatedAt: NOW - 30_000 }, code: "fresh-price" },
    { patch: { updatedAt: NOW - 30_001 }, code: "stale-price" },
    { patch: { updatedAt: NOW + 1 }, code: "future-price" },
    { patch: { updatedAt: Math.floor(NOW / 1000) }, code: "stale-price" },
    { patch: { updatedAt: 0 }, code: "invalid-price" },
    { patch: { updatedAt: "1792850867062" }, code: "invalid-price" },
    { patch: { minPrice: "0" }, code: "invalid-price" },
    { patch: { minPrice: "NaN" }, code: "invalid-price" },
    { patch: { minPrice: "9007199254740993", maxPrice: "9007199254740992" }, code: "invalid-price" },
  ];
  for (const { patch, code } of scenarios) {
    const input = prices().map((ticker) =>
      ticker.tokenAddress.toLowerCase() === target ? { ...ticker, ...patch } : ticker
    );
    assert.equal(checkTickers(input, NOW).find((check) => check.name === "ticker:SOL")?.code, code);
  }
  const input = prices().filter((ticker) => ticker.tokenAddress.toLowerCase() !== target);
  assert.equal(checkTickers(input, NOW)[0].code, "missing-price");
  const sol = prices().find((ticker) => ticker.tokenAddress.toLowerCase() === target);
  assert.equal(checkTickers([...prices(), sol], NOW)[0].code, "invalid-price");
  assert.throws(() => checkTickers({ error: "unavailable" }, NOW));
});

test("charts reject empty, invalid OHLC, future and unordered candle data", () => {
  assert.equal(
    checkDayPrices(days).every((check) => check.status === "passed"),
    true
  );
  assert.equal(checkDayPrices(days.slice(1))[0].status, "failed");
  assert.equal(checkDayPrices(days.map((day) => ({ ...day, high: 99 })))[0].status, "failed");
  const valid = { period: "1m", candles: [candle, [candle[0] - 60, ...candle.slice(1)]] };
  assert.equal(checkCandles(valid, "SOL", NOW)[0].status, "passed");
  for (const input of [
    { ...valid, period: "5m" },
    { ...valid, candles: [] },
    { ...valid, candles: [candle, candle] },
    { ...valid, candles: [[NOW, ...candle.slice(1)]] },
    { ...valid, candles: [[candle[0], 100, 99, 101, 100]] },
  ])
    assert.throws(() => checkCandles(input, "SOL", NOW));
});

test("readiness fails closed and distinguishes transport, body, flag and dependency failures", async () => {
  const scenarios = [
    { flag: { solanaTrading: { enabled: true } }, code: "flag-enabled", exitCode: 0 },
    { flag: {}, code: "flag-missing", exitCode: 2 },
    { flag: { solanaTrading: { enabled: false } }, code: "flag-disabled", exitCode: 2 },
    { flag: { solanaTrading: { enabled: "true" } }, code: "invalid-flag", exitCode: 1 },
    { flag: [], code: "invalid-response", exitCode: 1 },
    { flag: { error: "unavailable" }, code: "business-error", exitCode: 1 },
    { status: 403, text: "error code: 1010", code: "cloudflare-denied", exitCode: 1 },
    { status: 403, text: "denied", code: "access-denied", exitCode: 1 },
    { status: 429, text: "limit", code: "rate-limited", exitCode: 1 },
    { status: 503, text: "unavailable", code: "http-error", exitCode: 1 },
    { status: 200, text: "not json", code: "invalid-json", exitCode: 1 },
    { error: new DOMException("Timed out", "TimeoutError"), code: "timeout", exitCode: 1 },
    { error: new TypeError("fetch failed"), code: "network-error", exitCode: 1 },
  ];
  for (const scenario of scenarios) {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/ui-flags/v2")) {
        if (scenario.error) throw scenario.error;
        return new Response(scenario.text ?? JSON.stringify(scenario.flag), { status: scenario.status ?? 200 });
      }
      return Response.json(
        url.endsWith("/tickers") ? prices() : url.endsWith("/24h") ? days : { period: "1m", candles: [candle] }
      );
    };
    const report = await runKeeperPreflight({ fetchImpl, now: () => NOW });
    assert.equal(report.exitCode, scenario.exitCode, scenario.code);
    assert.ok(
      report.checks.some((check) => check.code === scenario.code),
      scenario.code
    );
    if (report.checks.some((check) => check.name === "ui-flags" && check.status === "failed")) {
      assert.equal(report.checks.find((check) => check.name === "solanaTrading")?.status, "not-run");
    }
    assert.equal(
      report.checks.filter((check) => check.name.startsWith("ticker:") && check.status === "passed").length,
      5
    );
  }
});
