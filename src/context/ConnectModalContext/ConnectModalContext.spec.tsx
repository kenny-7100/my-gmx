import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAbFlagEnabled } from "config/ab";
import { SOLANA_NETWORK_ID } from "config/chains";
import { SolanaWalletSessionContext } from "lib/wallets/solanaWalletSession";

import { ConnectModalProvider, useConnectModal } from "./ConnectModalContext";

const mocks = vi.hoisted(() => ({
  authenticated: false,
  networkId: 42161,
  remember: vi.fn(),
  connectOrCreateWalletCallbacks: undefined as
    | undefined
    | {
        onError: (error: string) => void;
        onSuccess: (result: { wallet: { type: string; meta: { id: string; name: string } } }) => void;
      },
  isPrivyModalOpen: false,
  connectOrCreateWallet: vi.fn(),
  connectWalletCallbacks: undefined as
    | undefined
    | {
        onError: (error: string) => void;
        onSuccess: (result: { wallet: { type: string; meta: { id: string; name: string } } }) => void;
      },
  connectWallet: vi.fn(),
  pushError: vi.fn(),
  switchNetwork: vi.fn(),
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    authenticated: mocks.authenticated,
  }),
  useModalStatus: () => ({
    isOpen: mocks.isPrivyModalOpen,
  }),
  useConnectOrCreateWallet: (callbacks: {
    onError: (error: string) => void;
    onSuccess: (result: { wallet: { type: string; meta: { id: string; name: string } } }) => void;
  }) => {
    mocks.connectOrCreateWalletCallbacks = callbacks;
    return { connectOrCreateWallet: mocks.connectOrCreateWallet };
  },
  useConnectWallet: (callbacks: {
    onError: (error: string) => void;
    onSuccess: (result: { wallet: { type: string; meta: { id: string; name: string } } }) => void;
  }) => {
    mocks.connectWalletCallbacks = callbacks;
    return { connectWallet: mocks.connectWallet };
  },
}));

vi.mock("context/GmxAccountContext/hooks", () => ({
  useGmxAccountSettlementChainId: () => [42161],
}));

vi.mock("lib/chains", () => ({
  useChainId: () => ({ networkId: mocks.networkId }),
}));

vi.mock("lib/metrics", () => ({
  metrics: {
    pushError: mocks.pushError,
  },
}));

vi.mock("lib/wallets", () => ({
  switchNetwork: mocks.switchNetwork,
}));

const session = {
  address: undefined,
  disconnect: undefined,
  isRestoring: false,
  rememberConnectedWallet: mocks.remember,
};

function setup() {
  let context!: ReturnType<typeof useConnectModal>;

  function TestComponent() {
    context = useConnectModal();
    return null;
  }

  render(
    <SolanaWalletSessionContext.Provider value={session}>
      <ConnectModalProvider>
        <TestComponent />
      </ConnectModalProvider>
    </SolanaWalletSessionContext.Provider>
  );

  return () => context;
}

describe("ConnectModalProvider", () => {
  beforeEach(() => {
    mocks.authenticated = false;
    mocks.networkId = 42161;
    setAbFlagEnabled("solanaNetwork", false);
    mocks.connectOrCreateWalletCallbacks = undefined;
    mocks.isPrivyModalOpen = false;
    mocks.connectWalletCallbacks = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    setAbFlagEnabled("solanaNetwork", false);
    localStorage.clear();
  });

  it("uses connectOrCreateWallet for unauthenticated users", () => {
    const getContext = setup();

    act(() => {
      getContext().openConnectModal?.();
    });

    expect(mocks.connectOrCreateWallet).toHaveBeenCalledTimes(1);
    expect(mocks.connectWallet).not.toHaveBeenCalled();
    expect(getContext().connectModalOpen).toBe(true);
  });

  it("uses connectWallet for authenticated users after extension-side disconnects", () => {
    mocks.authenticated = true;
    const getContext = setup();

    act(() => {
      getContext().openConnectModal?.();
    });

    expect(mocks.connectWallet).toHaveBeenCalledTimes(1);
    expect(mocks.connectOrCreateWallet).not.toHaveBeenCalled();
    expect(getContext().connectModalOpen).toBe(true);
  });

  it("does not start another Privy wallet request while one is pending", () => {
    mocks.authenticated = true;
    const getContext = setup();

    act(() => {
      getContext().openConnectModal?.();
      getContext().openConnectModal?.();
    });

    expect(mocks.connectWallet).toHaveBeenCalledTimes(1);
  });

  it("reports connect-or-create errors and allows another attempt", () => {
    const getContext = setup();

    act(() => {
      getContext().openConnectModal?.();
      mocks.connectOrCreateWalletCallbacks?.onError("connect_or_create_failed");
      getContext().openConnectModal?.();
    });

    expect(mocks.pushError).toHaveBeenCalledWith("connect_or_create_failed", "connectModal.connectOrCreateWallet");
    expect(mocks.connectOrCreateWallet).toHaveBeenCalledTimes(2);
  });

  it("reports connect errors and allows another attempt", () => {
    mocks.authenticated = true;
    const getContext = setup();

    act(() => {
      getContext().openConnectModal?.();
      mocks.connectWalletCallbacks?.onError("connect_failed");
      getContext().openConnectModal?.();
    });

    expect(mocks.pushError).toHaveBeenCalledWith("connect_failed", "connectModal.connectWallet");
    expect(mocks.connectWallet).toHaveBeenCalledTimes(2);
  });
  it("routes Solana through the explicit external connection and never selects an incidental modal-close wallet", async () => {
    setAbFlagEnabled("solanaNetwork", true);
    mocks.networkId = SOLANA_NETWORK_ID;
    const getContext = setup();
    act(() => getContext().openConnectModal?.());
    expect(mocks.connectWallet).toHaveBeenCalledWith({
      walletChainType: "solana-only",
      walletList: ["phantom", "solflare", "okx_wallet", "tokenpocket"],
    });
    expect(mocks.connectOrCreateWallet).not.toHaveBeenCalled();
    const result = { wallet: { type: "solana", meta: { id: "Phantom", name: "Phantom" } } };
    act(() => mocks.connectOrCreateWalletCallbacks?.onSuccess(result));
    expect(mocks.remember).not.toHaveBeenCalled();
    act(() => mocks.connectWalletCallbacks?.onSuccess(result));
    expect(mocks.remember).toHaveBeenCalledWith("Phantom");
    expect(mocks.switchNetwork).not.toHaveBeenCalled();
    expect(getContext().connectModalOpen).toBe(false);
    // Wait for the bounded reconnect-start observation before unmounting.
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
});
