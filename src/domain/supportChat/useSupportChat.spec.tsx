import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ARBITRUM, AVALANCHE, isSolanaNetwork, SOLANA_NETWORK_ID } from "config/chains";
import { expandDecimals } from "lib/numbers";

import { SupportChatEvmAttributes, useSupportChat } from "./useSupportChat";

const source = vi.hoisted(() => ({
  networkId: 42161,
  account: "0x0000000000000000000000000000000000000001" as string | undefined,
  loading: false,
  visible: true,
  openOnBoot: false,
  theme: "dark",
  unread: 0,
  stopClipping: vi.fn(),
  booted: false,
  attributes: {} as Record<string, unknown>,
  updatesBeforeBoot: 0,
  unreadListener: undefined as ((count: number) => void) | undefined,
}));

vi.mock("@intercom/messenger-js-sdk", () => {
  let initialized = false;
  const boot = (settings: Record<string, unknown>) => {
    source.booted = true;
    source.attributes = { ...settings };
  };
  return {
    default: (settings: Record<string, unknown>) => {
      if (initialized) return;
      initialized = true;
      boot(settings);
    },
    boot,
    shutdown: () => {
      source.booted = false;
      source.attributes = {};
    },
    update: (attributes: Record<string, unknown>) => {
      if (!source.booted) {
        source.updatesBeforeBoot++;
        return;
      }
      Object.assign(source.attributes, attributes);
    },
    show: vi.fn(),
    onUnreadCountChange: (listener: (count: number) => void) => {
      source.unreadListener = listener;
    },
  };
});
vi.mock("lib/chains", () => ({ useChainId: () => ({ chainId: ARBITRUM, srcChainId: undefined }) }));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: source.account, connector: { name: "MetaMask" } }) }));
vi.mock("context/ThemeContext/ThemeContext", () => ({ useTheme: () => ({ themeMode: source.theme }) }));
vi.mock("context/SettingsContext/SettingsContextProvider", () => ({
  useSettings: () => ({ expressOrdersEnabled: true }),
}));
vi.mock("context/SubaccountContext/SubaccountContextProvider", () => ({
  useSubaccountContext: () => ({ subaccount: undefined }),
}));
vi.mock("./useShowSupportChat", () => ({
  useShowSupportChat: () => ({ shouldShowSupportChat: source.visible, shouldOpenChatOnBoot: source.openOnBoot }),
}));
vi.mock("./useSupportChatUnreadCount", () => ({ useSupportChatUnreadCount: () => [0, setUnread] }));
function setUnread(count: number) {
  source.unread = count;
}
vi.mock("./clipNotificationFrame", () => ({ clipNotificationFrame: () => source.stopClipping }));
vi.mock("lib/wallets/useAccountType", () => ({
  AccountType: { EOA: "eoa", SmartAccount: "smart", PostEip7702EOA: "7702" },
  useAccountType: () => {
    requireEvm();
    return { accountType: "eoa", isLoading: source.loading };
  },
}));
vi.mock("domain/synthetics/accountStats/useIsLargeAccountData", () => ({
  useIsLargeAccountVolumeStats: () => {
    requireEvm();
    return {
      data: { totalVolume: expandDecimals(3_000_000, 30), last30DaysVolume: expandDecimals(300_000, 30) },
      isLoading: false,
    };
  },
}));
vi.mock("./useWalletPortfolioUsd", () => ({
  useWalletPortfolioUsd: () => {
    requireEvm();
    return { walletPortfolioUsd: expandDecimals(100, 30), isWalletPortfolioUsdLoading: false };
  },
}));
vi.mock("components/GmxAccountModal/hooks", () => ({
  useAvailableToTradeAssetMultichain: () => {
    requireEvm();
    return { gmxAccountUsd: 0n, isLoading: false };
  },
}));

function requireEvm() {
  if (isSolanaNetwork(source.networkId)) throw new Error("EVM support attributes read on Solana");
}

function Entry() {
  useSupportChat();
  return isSolanaNetwork(source.networkId) ? null : <SupportChatEvmAttributes />;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  source.visible = true;
  source.openOnBoot = false;
  source.loading = false;
  source.networkId = ARBITRUM;
  source.account = "0x0000000000000000000000000000000000000001";
  source.theme = "dark";
  source.updatesBeforeBoot = 0;
});

it("restores EVM attributes after warm Solana switches and messenger restarts FESOL-48", () => {
  source.loading = true;
  const view = render(<Entry />);
  expect(source.booted).toBe(true);
  expect(source.attributes.Tier).toBeUndefined();
  source.loading = false;
  view.rerender(<Entry />);
  expect(source.attributes).toMatchObject({
    Tier: "Active",
    "Active Network": "Arbitrum",
    "Wallet Type": "EOA",
    "Trading Mode": "Express",
  });

  source.networkId = SOLANA_NETWORK_ID;
  view.rerender(<Entry />);
  expect(source.booted).toBe(true);
  source.theme = "light";
  view.rerender(<Entry />);
  expect(source.attributes.theme_mode).toBe("light");
  act(() => source.unreadListener?.(3));
  expect(source.unread).toBe(3);

  source.visible = false;
  view.rerender(<Entry />);
  expect(source.booted).toBe(false);
  expect(source.stopClipping).toHaveBeenCalledTimes(1);
  source.visible = true;
  view.rerender(<Entry />);
  expect(source.attributes.Tier).toBeUndefined();
  source.networkId = AVALANCHE;
  view.rerender(<Entry />);
  expect(source.attributes.Tier).toBe("Active");

  // The attributes component survives this shutdown/boot with the same account.
  source.visible = false;
  view.rerender(<Entry />);
  source.visible = true;
  view.rerender(<Entry />);
  expect(source.attributes.Tier).toBe("Active");
  expect(source.updatesBeforeBoot).toBe(0);
  source.openOnBoot = true;
  view.rerender(<Entry />);
  expect(source.attributes.Tier).toBe("Active");
  view.unmount();
  expect(source.booted).toBe(false);
});

it("boots after a full route remount and sends attributes without a connected account", () => {
  source.account = undefined;
  const view = render(<Entry />);
  expect(source.attributes.Tier).toBe("Active");
  view.rerender(<Entry key="new-network-scope" />);
  expect(source.booted).toBe(true);
  expect(source.attributes["Wallet Portfolio USD"]).toBe(100);
  expect(source.attributes["GMX Account Portfolio USD"]).toBe(0);
  expect(source.updatesBeforeBoot).toBe(0);
});
