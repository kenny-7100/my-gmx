import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SOLANA_WALLET_LOCAL_STORAGE_KEY } from "config/localStorage";

import { SolanaWalletSessionProvider, useSolanaWalletSession } from "./solanaWalletSession";

function createWallet(name: string, address: string, canDisconnect = true) {
  return {
    address,
    standardWallet: { name, features: canDisconnect ? { "standard:disconnect": {} } : {} },
    disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

const source = vi.hoisted(() => ({
  wallets: [] as ReturnType<typeof createWallet>[],
  standardWallets: [] as { name: string; features: { "standard:connect": { connect: ReturnType<typeof vi.fn> } } }[],
  ready: true,
  reads: 0,
}));

vi.mock("lib/metrics", () => ({ metrics: { pushError: vi.fn() } }));

vi.mock("@privy-io/react-auth/solana", () => ({
  useWallets: () => {
    source.reads++;
    return { wallets: source.wallets, ready: source.ready };
  },
  useStandardWallets: () => ({ wallets: source.standardWallets, ready: source.ready }),
}));

async function setup(enabled = true) {
  let session!: ReturnType<typeof useSolanaWalletSession>;
  function Consumer() {
    session = useSolanaWalletSession();
    return null;
  }
  const tree = (on: boolean) => (
    <SolanaWalletSessionProvider enabled={on}>
      <Consumer />
    </SolanaWalletSessionProvider>
  );
  const view = render(tree(enabled));
  if (enabled) {
    await act(async () => {
      await vi.dynamicImportSettled();
    });
  }
  return { get: () => session, refresh: (on = enabled) => view.rerender(tree(on)), unmount: view.unmount };
}

function remember(walletId: string) {
  localStorage.setItem(SOLANA_WALLET_LOCAL_STORAGE_KEY, JSON.stringify({ walletId }));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  source.wallets = [];
  source.standardWallets = [];
  source.ready = true;
  source.reads = 0;
});

describe("Solana wallet session", () => {
  it("does not read the Solana source or change persistence while disabled", async () => {
    remember("Phantom");
    const stored = localStorage.getItem(SOLANA_WALLET_LOCAL_STORAGE_KEY);
    const view = await setup(false);
    expect(view.get().address).toBeUndefined();
    expect(view.get().isRestoring).toBe(false);
    expect(source.reads).toBe(0);
    expect(localStorage.getItem(SOLANA_WALLET_LOCAL_STORAGE_KEY)).toBe(stored);
  });

  it("uses only the selected wallet, follows its account and clears selection even if disconnect fails", async () => {
    const phantom = createWallet("Phantom", "Phantom111");
    source.wallets = [createWallet("Privy", "Embedded111"), phantom, createWallet("Solflare", "Solflare111")];
    const view = await setup();
    expect(view.get().address).toBeUndefined();
    act(() => view.get().rememberConnectedWallet("Phantom"));
    expect(view.get().address).toBe("Phantom111");
    const oldDisconnect = view.get().disconnect;
    source.wallets = [createWallet("Phantom", "Phantom222"), createWallet("Solflare", "Solflare222")];
    view.refresh();
    expect(view.get().address).toBe("Phantom222");
    act(() => view.get().rememberConnectedWallet("Solflare"));
    await act(async () => oldDisconnect?.());
    expect(view.get().address).toBe("Solflare222");
    source.wallets[1].disconnect.mockRejectedValueOnce(new Error("Disconnect failed"));
    await act(async () => {
      await expect(view.get().disconnect?.()).rejects.toThrow("Disconnect failed");
    });
    expect(view.get().address).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(SOLANA_WALLET_LOCAL_STORAGE_KEY)!).walletId).toBeUndefined();
    view.unmount();
    const restored = await setup();
    expect(restored.get().address).toBeUndefined();
  });

  it("bounds restoration, restarts it for a new selection and ignores late results after forgetting", async () => {
    remember("Phantom");
    source.ready = false;
    vi.useFakeTimers();
    const view = await setup();
    // Restart the timer under the fake clock by reporting source readiness.
    source.ready = true;
    const connect = vi.fn().mockRejectedValue(new Error("Not authorized"));
    source.standardWallets = [{ name: "Phantom", features: { "standard:connect": { connect } } }];
    await act(async () => view.refresh());
    expect(view.get().isRestoring).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(4_000));
    expect(view.get().isRestoring).toBe(false);
    act(() => view.get().rememberConnectedWallet("Solflare"));
    expect(view.get().isRestoring).toBe(true);
    act(() => view.get().rememberConnectedWallet(undefined));
    source.wallets = [createWallet("Phantom", "LatePhantom111"), createWallet("Solflare", "LateSolflare111")];
    view.refresh();
    expect(view.get().address).toBeUndefined();
    expect(view.get().isRestoring).toBe(false);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restores all supported selections and keeps an explicit TokenPocket disconnect forgotten", async () => {
    for (const name of ["Phantom", "Solflare", "OKX Wallet", "TokenPocket"]) {
      remember(name);
      const wallet = createWallet(name, `${name}111`, name !== "TokenPocket");
      source.wallets = [createWallet("Privy", "Embedded111"), wallet];
      const view = await setup();
      expect(view.get().address).toBe(wallet.address);
      await act(async () => view.get().disconnect?.());
      expect(view.get().address).toBeUndefined();
      view.refresh(false);
      source.wallets = [wallet];
      view.refresh(true);
      await act(async () => undefined);
      expect(view.get().address).toBeUndefined();
      view.unmount();
    }
  });
});
