import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import { SUPPORT_CHAT_LAST_CONNECTED_STATE_KEY } from "config/localStorage";

import { SUPPORT_CHAT_OPENED_WITHOUT_WALLET_SESSION_KEY } from "./constants";
import { useShowSupportChat } from "./useShowSupportChat";

const source = vi.hoisted(() => ({
  networkId: 42161,
  evmConnected: true,
  evmInitializing: false,
  address: undefined as string | undefined,
  restoring: false,
  openChat: undefined as string | undefined,
}));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId }) }));
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: source.evmConnected }) }));
vi.mock("lib/wallets/useIsWalletInitializing", () => ({ useIsWalletInitializing: () => source.evmInitializing }));
vi.mock("lib/wallets/solanaWalletSession", () => ({
  useSolanaWalletSession: () => ({ address: source.address, isRestoring: source.restoring }),
}));
vi.mock("lib/useSearchParams", () => ({ default: () => ({ openChat: source.openChat }) }));

let result: ReturnType<typeof useShowSupportChat>;
function Entry() {
  result = useShowSupportChat();
  return null;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  source.networkId = ARBITRUM;
  source.evmConnected = true;
  source.evmInitializing = false;
  source.address = undefined;
  source.restoring = false;
  source.openChat = undefined;
});

it("uses the selected wallet session for support without overwriting EVM connection history", () => {
  const view = render(<Entry />);
  expect(result.shouldShowSupportChat).toBe(true);
  const evmHistory = localStorage.getItem(JSON.stringify(SUPPORT_CHAT_LAST_CONNECTED_STATE_KEY));
  expect(evmHistory).toBe("true");

  source.networkId = SOLANA_NETWORK_ID;
  view.rerender(<Entry />);
  expect(result.shouldShowSupportChat).toBe(false);
  source.restoring = true;
  view.rerender(<Entry />);
  expect(result.shouldShowSupportChat).toBe(true);
  source.restoring = false;
  source.address = "So11111111111111111111111111111111111111112";
  view.rerender(<Entry />);
  expect(result.shouldShowSupportChat).toBe(true);
  source.address = undefined;
  view.rerender(<Entry />);
  expect(result.shouldShowSupportChat).toBe(false);
  expect(localStorage.getItem(JSON.stringify(SUPPORT_CHAT_LAST_CONNECTED_STATE_KEY))).toBe(evmHistory);

  source.networkId = ARBITRUM;
  view.rerender(<Entry />);
  expect(result.shouldShowSupportChat).toBe(true);
  source.evmConnected = false;
  source.evmInitializing = true;
  view.rerender(<Entry />);
  expect(result.shouldShowSupportChat).toBe(true);
  source.evmInitializing = false;
  view.rerender(<Entry />);
  expect(result.shouldShowSupportChat).toBe(false);
  expect(localStorage.getItem(JSON.stringify(SUPPORT_CHAT_LAST_CONNECTED_STATE_KEY))).toBe("false");
});

it("keeps an explicitly opened anonymous support session available on Solana", () => {
  source.networkId = SOLANA_NETWORK_ID;
  source.evmConnected = false;
  source.openChat = "true";
  const view = render(<Entry />);
  expect(result).toEqual({ shouldShowSupportChat: true, shouldOpenChatOnBoot: true });
  expect(sessionStorage.getItem(SUPPORT_CHAT_OPENED_WITHOUT_WALLET_SESSION_KEY)).toBe("true");
  source.openChat = undefined;
  view.rerender(<Entry key="restored-route" />);
  expect(result).toEqual({ shouldShowSupportChat: true, shouldOpenChatOnBoot: false });
  expect(localStorage.getItem(JSON.stringify(SUPPORT_CHAT_LAST_CONNECTED_STATE_KEY))).toBeNull();
});
