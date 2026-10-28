import { getAbFlags } from "config/ab";
import { type AnyChainId } from "config/chains";
import { getIsLargeAccount } from "domain/stats/isLargeAccount";
import type { CurrentRpcEndpoints } from "lib/rpc/RpcTracker";
import { getCurrentRpcUrls } from "lib/rpc/useRpcUrls";

import { _debugMulticall } from "./_debug";
import { getMulticallSignal } from "./lifecycle";
import { Multicall } from "./Multicall";
import type { MulticallRequestConfig } from "./types";

export async function executeMulticallMainThread(
  chainId: AnyChainId,
  request: MulticallRequestConfig<any>,
  signal = getMulticallSignal()
) {
  signal.throwIfAborted();
  const multicall = await Multicall.getInstance(chainId, getAbFlags());
  const providerUrls = getCurrentRpcUrls(chainId);
  const isLargeAccount = getIsLargeAccount();
  const debugState = _debugMulticall?.getDebugState();

  return multicall?.call(providerUrls as CurrentRpcEndpoints, request, isLargeAccount, debugState, signal);
}
