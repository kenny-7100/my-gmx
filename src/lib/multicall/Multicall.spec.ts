import {
  CallExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  InternalRpcError,
  RpcRequestError,
  toHex,
  encodeFunctionResult,
  multicall3Abi,
} from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentRpcEndpoints } from "lib/rpc/RpcTracker";

import { executeMulticall } from "./executeMulticall";
import { getMulticallSignal, setMulticallEnabled } from "./lifecycle";
import { Multicall } from "./Multicall";

vi.mock("lib/metrics/emitMetricEvent", () => ({
  emitMetricCounter: vi.fn(),
  emitMetricEvent: vi.fn(),
  emitMetricTiming: vi.fn(),
}));
vi.mock("lib/FallbackTracker/events", () => ({ emitReportEndpointFailure: vi.fn() }));

const endpoints = {
  primary: "https://primary.invalid",
  fallbacks: ["https://fallback.invalid"],
  trackerKey: "test",
} as CurrentRpcEndpoints;
const request = {
  balance: {
    abiId: "Token" as const,
    contractAddress: "0x1111111111111111111111111111111111111111",
    calls: {
      amount: { methodName: "balanceOf", params: ["0x2222222222222222222222222222222222222222"] },
      supply: { methodName: "totalSupply", params: [] },
    },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setMulticallEnabled(true);
});

describe("multicall result isolation", () => {
  it("rejects queued and delayed old work across a rapid Solana and EVM round trip", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const signal = getMulticallSignal();
    const queued = executeMulticall(42161, request);
    const rejected = expect(queued).rejects.toMatchObject({ name: "AbortError" });
    setMulticallEnabled(false);
    setMulticallEnabled(true);
    await rejected;
    await vi.advanceTimersByTimeAsync(100);
    await expect(executeMulticall(42161, request, "urgent", "delayed", false, signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("aborts the old transport without fallback or stale results and restores EVM reads", async () => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let transportSignal: AbortSignal | undefined;
    const fetch = vi.fn().mockImplementationOnce((_url: string, init: RequestInit) => {
      transportSignal = init.signal!;
      started();
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetch);
    const oldSignal = getMulticallSignal();
    const pending = new Multicall(42161, {}).call(endpoints, request, false, undefined, oldSignal);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await ready;
    setMulticallEnabled(false);
    await rejected;
    expect(transportSignal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    setMulticallEnabled(true);
    expect(getMulticallSignal()).not.toBe(oldSignal);
    await expect(new Multicall(42161, {}).call(endpoints, request, false, undefined, oldSignal)).rejects.toMatchObject({
      name: "AbortError",
    });
    const result = encodeFunctionResult({
      abi: multicall3Abi,
      functionName: "aggregate3",
      result: [50_000_000n, 100_000_000n].map((value) => ({
        success: true,
        returnData: toHex(value, { size: 32 }) as `0x${string}`,
      })),
    });
    fetch.mockRejectedValueOnce(new Error("primary unavailable"));
    fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const reply = (item: { id: number }) => ({ jsonrpc: "2.0", id: item.id, result });
      return Response.json(Array.isArray(body) ? body.map(reply) : reply(body));
    });
    const recovered = await new Multicall(42161, {}).call(endpoints, request, false, undefined, getMulticallSignal());
    expect(recovered.data.balance.amount.returnValues).toEqual([50_000_000n]);
    expect(recovered.data.balance.supply.returnValues).toEqual([100_000_000n]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("retains a valid balance when another contract read reverts", async () => {
    const call = vi.fn().mockResolvedValue([
      { status: "success", result: 50_000_000n },
      { status: "failure", error: new ContractFunctionZeroDataError({ functionName: "totalSupply" }) },
    ]);
    vi.spyOn(Multicall, "getViemClient").mockReturnValue({ multicall: call } as unknown as ReturnType<
      typeof Multicall.getViemClient
    >);
    const result = await new Multicall(42161, {}).call(endpoints, request, false);
    expect(result.success).toBe(false);
    expect(result.data.balance.amount).toMatchObject({ success: true, returnValues: [50_000_000n] });
    expect(result.data.balance.supply).toMatchObject({
      success: false,
      returnValues: [],
      error: expect.stringContaining("totalSupply"),
    });
    expect(result.errors.balance.supply).toBeDefined();
    expect(call).toHaveBeenCalledTimes(1);
  });

  const chunkProviderError = () =>
    new ContractFunctionRevertedError({
      abi: [],
      functionName: "aggregate3",
      message: "Internal JSON-RPC error.",
      cause: new CallExecutionError(
        new InternalRpcError(
          new RpcRequestError({ body: {}, error: { code: -32603, message: "internal error" }, url: endpoints.primary })
        ),
        {}
      ),
    });

  const success = { status: "success", result: 1n };
  const failure = (error: Error) => ({ status: "failure", error });

  it.each([
    ["transport", () => Promise.reject(new Error("network unavailable"))],
    ["all reads", async () => [failure(new Error("RPC failure")), failure(new Error("RPC failure"))]],
    [
      "one chunk's transport",
      async () => [success, failure(new HttpRequestError({ url: endpoints.primary, status: 429 }))],
    ],
    ["one chunk's provider error", async () => [success, failure(chunkProviderError())]],
  ])("still tries the fallback after %s fail", async (_, primary) => {
    const call = vi.fn().mockImplementationOnce(primary);
    call.mockResolvedValueOnce([
      { status: "success", result: 50_000_000n },
      { status: "success", result: 100_000_000n },
    ]);
    vi.spyOn(Multicall, "getViemClient").mockReturnValue({ multicall: call } as unknown as ReturnType<
      typeof Multicall.getViemClient
    >);
    const result = await new Multicall(42161, {}).call(endpoints, request, false);
    expect(result.success).toBe(true);
    expect(result.data.balance.amount.returnValues).toEqual([50_000_000n]);
    expect(call).toHaveBeenCalledTimes(2);
  });
});
