import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";

import { AddressDropdownWithMultichain } from "./AddressDropdownWithMultichain";

const source = vi.hoisted(() => ({
  networkId: 42161,
  balances: vi.fn(),
  deposit: vi.fn(),
  ens: vi.fn(),
  open: vi.fn(),
}));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId, srcChainId: undefined }) }));
vi.mock("context/GmxAccountContext/hooks", () => ({ useGmxAccountModalOpen: () => [false, source.open] }));
vi.mock("components/GmxAccountModal/hooks", () => ({
  useAvailableToTradeAssetSettlementChain: () => {
    source.balances();
    if (source.networkId === SOLANA_NETWORK_ID) throw new Error("EVM balances mounted on Solana");
    return { totalUsd: 0n, gmxAccountUsd: 0n, isGmxAccountLoading: false };
  },
}));
vi.mock("domain/multichain/useGmxAccountShowDepositButton", () => ({
  useGmxAccountShowDepositButton: () => {
    source.deposit();
    if (source.networkId === SOLANA_NETWORK_ID) throw new Error("EVM deposit mounted on Solana");
    return { shouldShowDepositButton: true };
  },
}));
vi.mock("lib/legacy", () => ({
  useENS: () => {
    source.ens();
    return { ensName: "alice.eth" };
  },
}));
vi.mock("lib/useBreakpoints", () => ({ useBreakpoints: () => ({ isMobile: false, isSmallMobile: false }) }));
vi.mock("components/Avatar/Avatar", () => ({ Avatar: () => null }));
vi.mock("lib/wallets", () => ({ shortenAddressOrEns: (address: string) => address }));

const i18n = setupI18n({ locale: "en", messages: {} });
function Entry({ account }: { account: string }) {
  return (
    <I18nProvider i18n={i18n}>
      <AddressDropdownWithMultichain account={account} />
    </I18nProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("keeps the wallet entry usable without EVM hooks across Solana and EVM switches", () => {
  const account = "So11111111111111111111111111111111111111112";
  source.networkId = SOLANA_NETWORK_ID;
  const view = render(<Entry account={account} />);
  expect(screen.getByText(account)).toBeTruthy();
  expect(screen.queryByText("Deposit")).toBeNull();
  expect(source.balances).not.toHaveBeenCalled();
  expect(source.deposit).not.toHaveBeenCalled();
  expect(source.ens).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  expect(source.open).toHaveBeenCalledWith(true);
  source.networkId = ARBITRUM;
  view.rerender(<Entry account="0x0000000000000000000000000000000000000001" />);
  expect(screen.getByText("alice.eth")).toBeTruthy();
  expect(screen.getByText("Deposit")).toBeTruthy();
  expect(source.balances).toHaveBeenCalled();
  source.networkId = SOLANA_NETWORK_ID;
  view.rerender(<Entry account={account} />);
  expect(screen.getByText(account)).toBeTruthy();
  expect(screen.queryByText("alice.eth")).toBeNull();
  expect(screen.queryByText("Deposit")).toBeNull();
});
