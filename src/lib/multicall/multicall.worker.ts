import { type AnyChainId } from "config/chains";
import { fallbackTrackerEventKeys } from "lib/FallbackTracker/events";
import {
  METRIC_EVENT_DISPATCH_NAME,
  METRIC_COUNTER_DISPATCH_NAME,
  METRIC_TIMING_DISPATCH_NAME,
} from "lib/metrics/emitMetricEvent";
import { CurrentRpcEndpoints } from "lib/rpc/RpcTracker";

import { MULTICALL_DEBUG_EVENT_NAME } from "./_debug";
import type { MulticallDebugState } from "./_debug";
import { Multicall } from "./Multicall";
import type { MulticallRequestConfig } from "./types";

async function executeMulticall(
  chainId: AnyChainId,
  providerUrls: CurrentRpcEndpoints,
  request: MulticallRequestConfig<any>,
  abFlags: Record<string, boolean>,
  isLargeAccount: boolean,
  debugState?: MulticallDebugState,
  signal?: AbortSignal
) {
  const multicall = await Multicall.getInstance(chainId, abFlags);

  signal?.throwIfAborted();
  return multicall?.call(providerUrls, request, isLargeAccount, debugState, signal);
}

self.addEventListener("message", run);
const controllers = new Map<string, AbortController>();

async function run(event: MessageEvent) {
  if (event.data.cancelId) {
    controllers.get(event.data.cancelId)?.abort();
    return;
  }
  const { PRODUCTION_PREVIEW_KEY, chainId, providerUrls, request, id, abFlags, isLargeAccount, debugState } =
    event.data;
  // @ts-ignore
  self.PRODUCTION_PREVIEW_KEY = PRODUCTION_PREVIEW_KEY;
  const controller = new AbortController();
  controllers.set(id, controller);

  try {
    const result = await executeMulticall(
      chainId,
      providerUrls,
      request,
      abFlags,
      isLargeAccount,
      debugState,
      controller.signal
    );
    if (controller.signal.aborted) return;

    postMessage({
      id,
      result,
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    postMessage({
      id,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  } finally {
    controllers.delete(id);
  }
}

// Register listeners for metric and debug events
// In worker context, these listeners forward events to main thread via postMessage
globalThis.addEventListener(METRIC_EVENT_DISPATCH_NAME, (event) => {
  postMessage({
    isMetrics: true,
    detail: (event as CustomEvent).detail,
  });
});

globalThis.addEventListener(METRIC_COUNTER_DISPATCH_NAME, (event) => {
  postMessage({
    isCounter: true,
    detail: (event as CustomEvent).detail,
  });
});

globalThis.addEventListener(METRIC_TIMING_DISPATCH_NAME, (event) => {
  postMessage({
    isTiming: true,
    detail: (event as CustomEvent).detail,
  });
});

globalThis.addEventListener(MULTICALL_DEBUG_EVENT_NAME, (event) => {
  postMessage({
    isDebug: true,
    detail: (event as CustomEvent).detail,
  });
});

globalThis.addEventListener(fallbackTrackerEventKeys.reportEndpointFailure, (event) => {
  postMessage({
    isFallbackTrackerFailure: true,
    detail: (event as CustomEvent).detail,
  });
});
