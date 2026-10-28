import { afterEach, describe, expect, it, vi } from "vitest";

import { getIsSolanaNetworkEnabled, setAbFlagEnabled } from "config/ab";
import { SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY } from "config/localStorage";

import { setEvmOracleEnabled } from "./lifecycle";
import { consumeUiFlagsPrefetch, startUiFlagsPrefetch } from "./uiFlagsPrefetch";

const PRIMARY_URL = "https://arbitrum-api.gmxinfra.io/ui-flags/v2";
const FALLBACK_URL = "https://arbitrum-api-fallback.gmxinfra.io/ui-flags/v2";
const OTHER_CHAIN_URL = "https://avalanche-api.gmxinfra.io/ui-flags/v2";

describe("consumeUiFlagsPrefetch", () => {
  afterEach(() => {
    delete window.__uiFlagsPrefetch;
    setEvmOracleEnabled(true);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("isolates boot and fallback requests by the effective selected network FESOL-48", async () => {
    const originalFlag = getIsSolanaNetworkEnabled();
    const originalSelection = localStorage.getItem(SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY);
    const flags = { apiPositions: true };
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      for (const [enabled, selected] of [
        [false, true],
        [true, false],
        [true, true],
      ]) {
        delete window.__uiFlagsPrefetch;
        setAbFlagEnabled("solanaNetwork", enabled);
        localStorage.setItem(SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY, String(selected));
        fetcher.mockImplementation(async () => new Response(JSON.stringify(flags)));
        startUiFlagsPrefetch();
        if (enabled && selected) {
          expect(window.__uiFlagsPrefetch).toBeUndefined();
        } else {
          await expect(consumeUiFlagsPrefetch(FALLBACK_URL)).resolves.toEqual(flags);
          expect(consumeUiFlagsPrefetch(PRIMARY_URL)).toBeUndefined();
          await expect(consumeUiFlagsPrefetch(OTHER_CHAIN_URL)).resolves.toEqual(flags);
        }
      }
      // Both EVM boot requests fail only after the user selects Solana.
      localStorage.setItem(SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY, "false");
      let finish!: (response: Response) => void;
      const response = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      fetcher.mockReturnValue(response);
      startUiFlagsPrefetch();
      const pending = window.__uiFlagsPrefetch![OTHER_CHAIN_URL];
      const signals = fetcher.mock.calls.slice(-2).map(([, options]) => options?.signal);
      setEvmOracleEnabled(false);
      setEvmOracleEnabled(true);
      expect(signals.every((signal) => signal?.aborted)).toBe(true);
      localStorage.setItem(SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY, "true");
      fetcher.mockRejectedValue(new Error("Unexpected fallback request"));
      finish(new Response("", { status: 503 }));
      await expect(pending).resolves.toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(6);
    } finally {
      setAbFlagEnabled("solanaNetwork", originalFlag);
      if (originalSelection === null) localStorage.removeItem(SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY);
      else localStorage.setItem(SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY, originalSelection);
    }
  });

  it("returns undefined when no prefetch was registered", () => {
    expect(consumeUiFlagsPrefetch(PRIMARY_URL)).toBeUndefined();

    window.__uiFlagsPrefetch = {};
    expect(consumeUiFlagsPrefetch(PRIMARY_URL)).toBeUndefined();
  });

  it("resolves with the prefetched value and consumes all aliases of the same promise", async () => {
    const promise = Promise.resolve({ apiPositions: true });
    const otherChainPromise = Promise.resolve({ apiPositions: false });
    window.__uiFlagsPrefetch = {
      [PRIMARY_URL]: promise,
      [FALLBACK_URL]: promise,
      [OTHER_CHAIN_URL]: otherChainPromise,
    };

    await expect(consumeUiFlagsPrefetch(FALLBACK_URL)).resolves.toEqual({ apiPositions: true });
    expect(consumeUiFlagsPrefetch(PRIMARY_URL)).toBeUndefined();
    expect(window.__uiFlagsPrefetch[OTHER_CHAIN_URL]).toBe(otherChainPromise);
  });

  it("does not consume prefetches registered for other urls", () => {
    const promise = Promise.resolve(null);
    window.__uiFlagsPrefetch = { [PRIMARY_URL]: promise };

    expect(consumeUiFlagsPrefetch(OTHER_CHAIN_URL)).toBeUndefined();
    expect(window.__uiFlagsPrefetch[PRIMARY_URL]).toBe(promise);
  });

  it("does not consume a prefetch after the boot window", () => {
    const promise = Promise.resolve({ apiPositions: true });
    window.__uiFlagsPrefetch = { [PRIMARY_URL]: promise };
    vi.spyOn(performance, "now").mockReturnValue(20_000);

    expect(consumeUiFlagsPrefetch(PRIMARY_URL)).toBeUndefined();
    expect(window.__uiFlagsPrefetch[PRIMARY_URL]).toBeUndefined();
  });

  it("resolves null instead of waiting forever on a hung prefetch", async () => {
    vi.useFakeTimers();
    window.__uiFlagsPrefetch = { [PRIMARY_URL]: new Promise(() => undefined) };

    const consumed = consumeUiFlagsPrefetch(PRIMARY_URL)!;
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(consumed).resolves.toBeNull();
  });
});
