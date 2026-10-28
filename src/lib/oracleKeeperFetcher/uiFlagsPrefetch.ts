import { getIsSolanaNetworkSelected } from "lib/chains/selectedNetwork";

import { getEvmOracleSignal } from "./lifecycle";

declare global {
  interface Window {
    __uiFlagsPrefetch?: Record<string, Promise<unknown> | undefined>;
  }
}

const PREFETCH_MAX_AGE_MS = 15_000;
const PREFETCH_WAIT_TIMEOUT_MS = 5_000;

const PREFETCH_REQUEST_TIMEOUT_MS = 10_000;
const PREFETCH_URLS = [
  [
    "https://arbitrum-api.gmxinfra.io/ui-flags/v2",
    "https://arbitrum-api-fallback.gmxinfra.io/ui-flags/v2",
    "https://arbitrum-api-fallback.gmxinfra2.io/ui-flags/v2",
  ],
  [
    "https://avalanche-api.gmxinfra.io/ui-flags/v2",
    "https://avalanche-api-fallback.gmxinfra.io/ui-flags/v2",
    "https://avalanche-api-fallback.gmxinfra2.io/ui-flags/v2",
  ],
];

// Runs before loading the app; aliases share one promise and are consumed at most once.
export function startUiFlagsPrefetch() {
  if (getIsSolanaNetworkSelected()) return;

  const lifecycleSignal = getEvmOracleSignal();
  if (lifecycleSignal.aborted) return;

  const registry: NonNullable<Window["__uiFlagsPrefetch"]> = {};
  window.__uiFlagsPrefetch = registry;
  for (const urls of PREFETCH_URLS) {
    const attempt = async (index: number): Promise<unknown> => {
      if (index >= urls.length || lifecycleSignal.aborted || getIsSolanaNetworkSelected()) return null;
      const controller = new AbortController();
      const abort = () => controller.abort(lifecycleSignal.reason);
      lifecycleSignal.addEventListener("abort", abort, { once: true });
      const timeout = window.setTimeout(() => controller.abort(), PREFETCH_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(urls[index], { signal: controller.signal });
        const result = response.ok ? await response.json() : undefined;
        if (lifecycleSignal.aborted) return null;
        return response.ok ? result : attempt(index + 1);
      } catch {
        return attempt(index + 1);
      } finally {
        window.clearTimeout(timeout);
        lifecycleSignal.removeEventListener("abort", abort);
      }
    };
    const promise = attempt(0);
    for (const url of urls) registry[url] = promise;
  }
}

export function consumeUiFlagsPrefetch(url: string): Promise<unknown> | undefined {
  if (typeof window === "undefined" || !window.__uiFlagsPrefetch) {
    return undefined;
  }

  const prefetched = window.__uiFlagsPrefetch[url];

  if (prefetched === undefined) {
    return undefined;
  }

  for (const [key, value] of Object.entries(window.__uiFlagsPrefetch)) {
    if (value === prefetched) {
      delete window.__uiFlagsPrefetch[key];
    }
  }

  if (performance.now() > PREFETCH_MAX_AGE_MS) {
    return undefined;
  }

  return Promise.race([
    prefetched,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), PREFETCH_WAIT_TIMEOUT_MS);
    }),
  ]);
}
