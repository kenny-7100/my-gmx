import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCTION_PREVIEW_KEY } from "config/localStorage";

import { ARBITRUM, getRpcProviders, getSolanaRpcUrl } from "../rpc";
import solanaRpc from "../solanaRpc.json";

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.removeItem(PRODUCTION_PREVIEW_KEY);
});

describe("Solana RPC environment routing", () => {
  it("uses the local proxy only in Vite development and keeps deployed builds on Alchemy", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_APP_SOLANA_RPC_URL", "");
    expect(getSolanaRpcUrl()).toBe("http://127.0.0.1:3030");
    vi.stubEnv("VITE_APP_SOLANA_RPC_URL", "http://127.0.0.1:3031");
    expect(getSolanaRpcUrl()).toBe("http://127.0.0.1:3031");
    vi.stubEnv("DEV", false);
    const evmUrl = getRpcProviders(ARBITRUM, "fallback").find(({ isPublic }) => !isPublic)!.url;
    expect(getSolanaRpcUrl()).toBe(evmUrl.replace("arb-mainnet", "solana-mainnet"));
    localStorage.setItem(PRODUCTION_PREVIEW_KEY, "true");
    expect(getSolanaRpcUrl()).toBe(`${solanaRpc.upstreamHost}/${solanaRpc.fallbackKey}`);
  });
});
