import type { ConnectedWallet } from "@privy-io/react-auth";
import { createConfig, createStorage } from "@wagmi/core";
import { http } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "wagmi";
import { injected } from "wagmi/connectors";

import { setAbFlagEnabled } from "config/ab";
import { getViemChain, MEGAETH } from "config/chains";
import { SOLANA_LINKED_EVM_CONNECTORS_LOCAL_STORAGE_KEY } from "config/localStorage";

import {
  getPrivyWagmiConnectorId,
  captureEvmSession,
  disconnectPrivyWalletsFromWagmi,
  restoreEvmSessionAfterSolanaConnect,
} from "./privyWagmi";

function setup() {
  const provider = { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
  const config = createConfig({
    chains: [getViemChain(MEGAETH)],
    connectors: ["io.metamask", "app.phantom"].map((id) => injected({ target: { id, name: id, provider } })),
    transports: { [MEGAETH]: http() },
    storage: createStorage({ storage: localStorage }),
  });
  const [metamask, phantom] = config.connectors;
  const connect = (connector: typeof metamask) =>
    config.setState((state) => ({
      ...state,
      connections: new Map(state.connections).set(connector.uid, {
        accounts: ["0x0000000000000000000000000000000000000001"],
        chainId: MEGAETH,
        connector,
      }),
      current: connector.uid,
      status: "connected",
    }));
  return { config, metamask, phantom, connect, provider };
}

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  setAbFlagEnabled("solanaNetwork", false);
});

it("preserves the selected MegaETH EVM account across delayed reconnect without requesting a chain switch", async () => {
  vi.useFakeTimers();
  const { config, metamask, phantom, connect, provider } = setup();
  connect(metamask);
  await config.storage?.setItem("recentConnectorId", metamask.id);
  const snapshot = captureEvmSession(config);
  await config.storage?.setItem("recentConnectorId", "Phantom");
  const restored = restoreEvmSessionAfterSolanaConnect(snapshot, config);
  await vi.advanceTimersByTimeAsync(50);
  config.setState((state) => ({ ...state, status: "reconnecting" }));
  connect(phantom);
  await restored;
  expect(config.state.current).toBe(metamask.uid);
  expect(config.state.connections.get(metamask.uid)?.chainId).toBe(MEGAETH);
  expect(config.state.connections.size).toBe(2);
  expect(await config.storage?.getItem("recentConnectorId")).toBe(metamask.id);
  expect(provider.request).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("restores an empty preference, ignores superseded work and rejects a stuck reconnect with cleanup", async () => {
  vi.useFakeTimers();
  const { config } = setup();
  const snapshot = captureEvmSession(config);
  await config.storage?.setItem("recentConnectorId", "Phantom");
  const restored = restoreEvmSessionAfterSolanaConnect(snapshot, config);
  await vi.advanceTimersByTimeAsync(250);
  await restored;
  expect(await config.storage?.getItem("recentConnectorId")).toBeNull();
  expect(config.state.current).toBeNull();
  await config.storage?.setItem("recentConnectorId", "new-user-pick");
  const stale = restoreEvmSessionAfterSolanaConnect(snapshot, config, () => false);
  await vi.advanceTimersByTimeAsync(250);
  await stale;
  expect(await config.storage?.getItem("recentConnectorId")).toBe("new-user-pick");
  config.setState((state) => ({ ...state, status: "reconnecting" }));
  const failure = expect(restoreEvmSessionAfterSolanaConnect(snapshot, config)).rejects.toThrow(
    "EVM reconnect timed out"
  );
  await vi.advanceTimersByTimeAsync(4_000);
  await failure;
  expect(vi.getTimerCount()).toBe(0);
  expect(await config.storage?.getItem("recentConnectorId")).toBe("new-user-pick");
});

it("keeps flag-off disconnect persistence compatible and forgets recorded EVM picks", async () => {
  const { config } = setup();
  setAbFlagEnabled("solanaNetwork", false);
  const wallets = [
    {
      address: "0x0000000000000000000000000000000000000001",
      meta: { id: "io.metamask", name: "MetaMask" },
      walletClientType: "metamask",
    },
  ];
  await disconnectPrivyWalletsFromWagmi(wallets, config);
  expect(localStorage.getItem(SOLANA_LINKED_EVM_CONNECTORS_LOCAL_STORAGE_KEY)).toBeNull();
  expect(await config.storage?.getItem("io.metamask.disconnected")).toBe(true);
  localStorage.setItem(
    SOLANA_LINKED_EVM_CONNECTORS_LOCAL_STORAGE_KEY,
    JSON.stringify({ pickedConnectorIds: ["io.metamask"], connectorIds: ["app.phantom"] })
  );
  await disconnectPrivyWalletsFromWagmi(wallets, config);
  const stored = JSON.parse(localStorage.getItem(SOLANA_LINKED_EVM_CONNECTORS_LOCAL_STORAGE_KEY)!);
  expect(stored).toEqual({ pickedConnectorIds: [], connectorIds: ["app.phantom"] });
});

function createWallet({
  address = "0x0000000000000000000000000000000000000001",
  metaId = "io.metamask",
  walletClientType = "metamask",
}: {
  address?: string;
  metaId?: string;
  walletClientType?: string;
}) {
  return {
    address,
    walletClientType,
    meta: {
      id: metaId,
      name: metaId,
    },
  } as ConnectedWallet;
}

describe("privyWagmi", () => {
  it("uses Privy's embedded wallet connector id format", () => {
    const wallet = createWallet({
      address: "0x0000000000000000000000000000000000000002",
      metaId: "io.privy.wallet",
      walletClientType: "privy",
    });

    expect(getPrivyWagmiConnectorId(wallet)).toBe("io.privy.wallet.0x0000000000000000000000000000000000000002");
  });

  it("uses the wallet metadata id for external wallets", () => {
    const wallet = createWallet({
      metaId: "io.phantom",
      walletClientType: "phantom",
    });

    expect(getPrivyWagmiConnectorId(wallet)).toBe("io.phantom");
  });

  it("marks all Privy-backed wagmi connectors disconnected", async () => {
    const removeItem = vi.fn();
    const setItem = vi.fn();
    const config = {
      storage: {
        removeItem,
        setItem,
      },
    } as unknown as Config;

    await disconnectPrivyWalletsFromWagmi(
      [
        createWallet({ metaId: "io.phantom", walletClientType: "phantom" }),
        createWallet({ metaId: "io.phantom", walletClientType: "phantom" }),
        createWallet({
          address: "0x0000000000000000000000000000000000000003",
          metaId: "io.privy.wallet",
          walletClientType: "privy",
        }),
      ],
      config
    );

    expect(removeItem).toHaveBeenCalledWith("recentConnectorId");
    expect(setItem).toHaveBeenCalledWith("io.phantom.disconnected", true);
    expect(setItem).toHaveBeenCalledWith(
      "io.privy.wallet.0x0000000000000000000000000000000000000003.disconnected",
      true
    );
    expect(setItem).toHaveBeenCalledTimes(2);
  });
});
