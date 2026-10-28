import { afterEach, expect, it, vi } from "vitest";

import type { LibrarySymbolInfo, ResolutionString } from "charting_library";
import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import { DataFeed } from "domain/tradingview/DataFeed";
import type { Bar } from "domain/tradingview/types";
import { OracleKeeperFetcher } from "lib/oracleKeeperFetcher";

import { getGmsolChartDataSource } from "./gmsolOracleFetcher";

const resolution = "1" as ResolutionString;
const bar = { time: 120, open: 1, close: 2, high: 3, low: 0 };
const params = { from: 0, to: 180, countBack: 2, firstDataRequest: true };
const feeds: DataFeed[] = [];
function feed(solana = true) {
  const result = new DataFeed(
    solana ? SOLANA_NETWORK_ID : ARBITRUM,
    new OracleKeeperFetcher({ chainId: ARBITRUM, track: false }),
    solana ? getGmsolChartDataSource() : undefined
  );
  result.setTokenPriceGetter(() => 10n ** 30n);
  feeds.push(result);
  return result;
}
async function symbol(datafeed: DataFeed, name: string) {
  const resolved = vi.fn();
  datafeed.resolveSymbol(name, resolved);
  await vi.advanceTimersByTimeAsync(0);
  expect(resolved).toHaveBeenCalledTimes(1);
  return resolved.mock.calls[0][0] as LibrarySymbolInfo;
}
afterEach(() => {
  feeds.forEach((f) => f.destroy());
  feeds.length = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("uses the shared candle path and scales mapped assets once while preserving EVM behavior", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(180_000);
  const read = vi
    .spyOn(OracleKeeperFetcher.prototype, "fetchOracleCandles")
    .mockResolvedValue([bar, { ...bar, time: 60 }]);
  const solana = feed();
  for (const [name, keeperSymbol, multiplier] of [
    ["SOL", "SOL", 1],
    ["ETH", "ETH", 1],
    ["NEAR", "NEAR", 1],
    ["1000@BONK", "BONK", 1000],
  ] as const) {
    const info = await symbol(solana, name);
    if (name === "SOL") solana.prefetchBars(name, resolution);
    const history = vi.fn();
    await solana.getBars(info, resolution, params, history, vi.fn());
    expect(info.name).toBe(keeperSymbol);
    expect(info.unit_id).toBe(String(multiplier));
    expect(read.mock.lastCall).toEqual([keeperSymbol, "1m", name === "SOL" ? 300 : 2]);
    expect(history.mock.lastCall?.[0]).toEqual([
      { time: 60_000, open: multiplier, close: 2 * multiplier, high: 3 * multiplier, low: 0 },
      { time: 120_000, open: multiplier, close: 2 * multiplier, high: 3 * multiplier, low: 0 },
    ]);
  }
  const tick = vi.fn();
  solana.subscribeBars(await symbol(solana, "1000@BONK"), resolution, tick, "scaled");
  await vi.advanceTimersByTimeAsync(0);
  expect(tick.mock.lastCall?.[0]).toEqual({ time: 120_000, open: 1000, close: 2000, high: 3000, low: 0 });
  solana.unsubscribeBars("scaled");
  const bad = vi.fn();
  solana.resolveSymbol("unknown", vi.fn(), bad);
  expect(bad).toHaveBeenCalledWith("Unsupported chart symbol: unknown");
  const failed = vi.fn();
  read.mockRejectedValueOnce(new Error("Keeper unavailable"));
  await solana.getBars(await symbol(solana, "SOL"), resolution, params, vi.fn(), failed);
  expect(failed).toHaveBeenCalledWith("Error: Keeper unavailable");
  const evm = feed(false);
  const history = vi.fn();
  await evm.getBars(await symbol(evm, "ETH"), resolution, params, history, vi.fn());
  expect(history.mock.lastCall?.[0][1]).toEqual({ ...bar, time: 120_000 });
  const fallback = await symbol(evm, "unknown");
  expect(fallback.name).toBe("ETH");
  await evm.getBars(await symbol(evm, "USDC"), resolution, params, history, vi.fn());
  expect(history.mock.lastCall?.[0].every((value: Bar) => value.close === 1)).toBe(true);
});

it("rejects late history, subscription and symbol callbacks after switching or destroying", async () => {
  vi.useFakeTimers();
  let finish!: (bars: Bar[]) => void;
  const read = vi.spyOn(OracleKeeperFetcher.prototype, "fetchOracleCandles").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const datafeed = feed();
  const sol = await symbol(datafeed, "SOL");
  const history = vi.fn();
  const request = datafeed.getBars(sol, resolution, params, history, vi.fn());
  datafeed.resolveSymbol("ETH", vi.fn());
  finish([bar]);
  await request;
  expect(history).not.toHaveBeenCalled();
  const tick = vi.fn();
  datafeed.subscribeBars(sol, resolution, tick, "current");
  await vi.advanceTimersByTimeAsync(0);
  datafeed.unsubscribeBars("current");
  finish([bar]);
  await vi.advanceTimersByTimeAsync(0);
  expect(tick).not.toHaveBeenCalled();
  datafeed.subscribeBars(sol, resolution, tick, "current");
  await vi.advanceTimersByTimeAsync(0);
  const ready = vi.fn();
  datafeed.onReady(ready);
  const resolved = vi.fn();
  datafeed.resolveSymbol("SOL", resolved);
  datafeed.destroy();
  finish([bar]);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(tick).not.toHaveBeenCalled();
  expect(ready).not.toHaveBeenCalled();
  expect(resolved).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(3);
  datafeed.unsubscribeBars("current");
});
