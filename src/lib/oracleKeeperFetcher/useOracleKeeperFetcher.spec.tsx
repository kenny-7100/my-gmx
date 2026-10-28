import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ARBITRUM, AVALANCHE, SOLANA_NETWORK_ID } from "config/chains";
import { ORACLE_FALLBACK_TRACKER_CONFIG } from "sdk/configs/oracleKeeper";

import { setEvmOracleEnabled } from "./lifecycle";
import { OracleKeeperFetcher } from "./oracleKeeperFetcher";
import { getOracleKeeperFetcher, useOracleKeeperFetcher } from "./useOracleKeeperFetcher";

const source = vi.hoisted(() => ({ networkId: -501, subscribe: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId }) }));
vi.mock("lib/metrics/oracleTrackerMetrics", () => ({ subscribeForOracleTrackerMetrics: source.subscribe }));
afterEach(() => {
  cleanup();
  for (const chainId of [ARBITRUM, AVALANCHE] as const) {
    const fetcher = getOracleKeeperFetcher(chainId);
    if (fetcher instanceof OracleKeeperFetcher) {
      fetcher.pauseTracking();
      fetcher.oracleTracker.fallbackTracker.cleanup();
    }
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

it("pauses every cached oracle on Solana, ignores cancelled probes, resumes once and preserves report HTTP", async () => {
  vi.useFakeTimers();
  const pending: ((value: Response) => void)[] = [];
  const signals: AbortSignal[] = [];
  let hold = true;
  const request = vi.fn((url: string, options: RequestInit = {}) => {
    if (url.includes("batch_report")) return Promise.resolve(new Response("{}"));
    if (!hold) return Promise.resolve(new Response('[{"tokenAddress":"test"}]'));
    if (options.signal) signals.push(options.signal);
    return new Promise<Response>((resolve) => {
      pending.push(resolve);
    });
  });
  vi.stubGlobal("fetch", request);
  function Probe() {
    useOracleKeeperFetcher(ARBITRUM);
    useOracleKeeperFetcher(AVALANCHE);
    return null;
  }
  const view = render(<Probe />);
  await act(() => vi.advanceTimersByTimeAsync(20_000));
  expect(request).not.toHaveBeenCalled();
  const arb = getOracleKeeperFetcher(ARBITRUM);
  const avax = getOracleKeeperFetcher(AVALANCHE);
  if (!(arb instanceof OracleKeeperFetcher) || !(avax instanceof OracleKeeperFetcher))
    throw new Error("Missing oracle");
  source.networkId = ARBITRUM;
  view.rerender(<Probe />);
  await act(() => vi.advanceTimersByTimeAsync(ORACLE_FALLBACK_TRACKER_CONFIG.delay));
  expect(signals.length).toBeGreaterThan(0);
  source.networkId = SOLANA_NETWORK_ID;
  await act(async () => {
    view.rerender(<Probe />);
  });
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  expect(arb.oracleTracker.fallbackTracker.getLastCheckResults()).toBeUndefined();
  const pausedCount = request.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(20_000));
  expect(request).toHaveBeenCalledTimes(pausedCount);
  hold = false;
  source.networkId = ARBITRUM;
  view.rerender(<Probe />);
  await act(() => vi.advanceTimersByTimeAsync(ORACLE_FALLBACK_TRACKER_CONFIG.delay));
  expect(request.mock.calls.length).toBeGreaterThan(pausedCount);
  const results = arb.oracleTracker.fallbackTracker.getLastCheckResults();
  expect(results).toBeDefined();
  expect(Object.values(results ?? {}).every((result) => result.success)).toBe(true);
  await act(async () => {
    pending.forEach((finish) => finish(new Response("[]")));
  });
  expect(arb.oracleTracker.fallbackTracker.getLastCheckResults()).toEqual(results);
  expect(source.subscribe).toHaveBeenCalledTimes(2);
  source.networkId = SOLANA_NETWORK_ID;
  view.rerender(<Probe />);
  const beforeReport = request.mock.calls.length;
  await arb.fetchPostBatchReport({ items: [] });
  expect(request.mock.calls.length).toBe(beforeReport + 1);
  expect(request.mock.calls.at(-1)?.[0]).toContain("/report/ui/batch_report");
});

it("cancels late EVM oracle results and retries across rapid network returns FESOL-48", async () => {
  vi.useFakeTimers();
  setEvmOracleEnabled(true);
  const arb = getOracleKeeperFetcher(ARBITRUM);
  if (!(arb instanceof OracleKeeperFetcher)) throw new Error("Missing oracle");
  const ticker = { tokenAddress: "test", minPrice: "1", maxPrice: "2" };
  const failure = vi.spyOn(arb, "handleFailure");
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
  try {
    for (const outcome of ["resolve", "reject", "incomplete"] as const) {
      let finish!: (response: Response) => void;
      let fail!: (error: Error) => void;
      request.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            finish = resolve;
            fail = reject;
          })
      );
      if (outcome === "incomplete") request.mockResolvedValueOnce(new Response(JSON.stringify([ticker])));
      const calls = request.mock.calls.length;
      const expectedAddresses = new Set<string>(outcome === "incomplete" ? ["missing"] : []);
      arb.expectedTickerAddresses = expectedAddresses;
      const pending = arb.fetchTickers().catch((error) => error);
      await vi.advanceTimersByTimeAsync(0);
      const signal = request.mock.calls.at(-1)?.[1]?.signal;
      setEvmOracleEnabled(false);
      setEvmOracleEnabled(true);
      expect(signal?.aborted).toBe(true);
      if (outcome !== "reject") finish(new Response(JSON.stringify([ticker])));
      else fail(new Error("Late endpoint failure"));
      expect((await pending).name).toBe("AbortError");
      expect(arb.expectedTickerAddresses).toBe(expectedAddresses);
      expect(request.mock.calls.length).toBe(calls + (outcome === "incomplete" ? 2 : 1));
      expect(failure).not.toHaveBeenCalled();
    }
    let finishPrefetch!: (value: unknown) => void;
    window.__uiFlagsPrefetch = {
      [`${arb.url}/ui-flags/v2`]: new Promise((resolve) => {
        finishPrefetch = resolve;
      }),
    };
    const pendingFlags = arb.fetchUiFlags().catch((error) => error);
    const calls = request.mock.calls.length;
    setEvmOracleEnabled(false);
    setEvmOracleEnabled(true);
    finishPrefetch(null);
    expect((await pendingFlags).name).toBe("AbortError");
    expect(request.mock.calls.length).toBe(calls);

    arb.expectedTickerAddresses = new Set();
    request
      .mockRejectedValueOnce(new Error("Primary unavailable"))
      .mockImplementation(async () => new Response(JSON.stringify([ticker])));
    await expect(arb.fetchTickers()).resolves.toEqual([ticker]);
    expect(failure).toHaveBeenCalledTimes(1);
    setEvmOracleEnabled(false);
    await expect(arb.fetchTickers()).rejects.toMatchObject({ name: "AbortError" });
    // An explicitly independent reader and shared reports do not inherit the EVM lifecycle.
    const shared = new OracleKeeperFetcher({ chainId: ARBITRUM, track: false });
    await expect(shared.fetchTickers()).resolves.toEqual([ticker]);
    await expect(arb.fetchPostBatchReport({ items: [] })).resolves.toBeInstanceOf(Response);
    shared.oracleTracker.fallbackTracker.cleanup();
  } finally {
    delete window.__uiFlagsPrefetch;
    failure.mockRestore();
    setEvmOracleEnabled(true);
  }
});
