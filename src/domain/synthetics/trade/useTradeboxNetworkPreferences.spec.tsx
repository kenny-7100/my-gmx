import { act, cleanup, render } from "@testing-library/react";
import { createMemoryHistory } from "history";
import { Router } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { ARBITRUM, SOLANA_NETWORK_ID, type NetworkId } from "config/chains";
import { DEFAULT_ACCEPTABLE_PRICE_IMPACT_BUFFER, DEFAULT_SLIPPAGE_AMOUNT } from "config/factors";
import {
  getKeepLeverageKey,
  getLeverageKey,
  getLeverageEnabledKey,
  getSyntheticsTradeOptionsKey,
  getSortedMarketsAddressesKey,
  getExpressOrdersEnabledKey,
  getHasOverriddenDefaultArb30ExecutionFeeBufferBpsKey,
} from "config/localStorage";
import { SettingsContextProvider, useSettings } from "context/SettingsContext/SettingsContextProvider";
import {
  createMockMarketInfo,
  createMockMarketsData,
  SECOND_ETH_MARKET_ADDRESS,
} from "domain/testUtils/mockMarketInfo";
import { ETH_TOKEN, USDC_TOKEN } from "domain/testUtils/mockTokens";
import { useLocalStorageSerializeKeySafe } from "lib/localStorage";
import { DEFAULT_TWAP_NUMBER_OF_PARTS } from "sdk/configs/twap";
import { TradeMode, TradeType } from "sdk/utils/trade/types";

import { useAvailableTokenOptions } from "./useAvailableTokenOptions";
import { usePositionSellerState } from "./usePositionSellerState";
import { StoredTradeOptions, useTradeboxState } from "./useTradeboxState";

const selected = vi.hoisted(() => ({ networkId: 42161 as NetworkId, canSignTypedData: false }));
vi.mock("lib/chains", () => ({
  useChainId: () => ({ chainId: 42161, networkId: selected.networkId, srcChainId: undefined }),
}));
vi.mock("lib/wallets/useWallet", () => ({ default: () => ({ account: undefined }) }));
vi.mock("lib/wallets/useWalletSessionChains", () => ({
  useWalletCanSignTypedData: () => ({ canSignTypedData: selected.canSignTypedData }),
}));
vi.mock("domain/multichain/useEmptyGmxAccounts", () => ({ useEmptyGmxAccounts: () => ({}) }));
vi.mock("domain/synthetics/tokens", async (original) => ({
  ...(await original<typeof import("domain/synthetics/tokens")>()),
  useTokensAllowanceData: () => ({}),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  selected.networkId = ARBITRUM;
  selected.canSignTypedData = false;
});

it("restricts restored trade modes on Solana without changing either network's stored preferences", () => {
  const history = createMemoryHistory();
  let trade!: ReturnType<typeof useTradeboxState>;
  function Probe() {
    trade = useTradeboxState(ARBITRUM, false, { networkId: selected.networkId, srcChainId: undefined });
    return null;
  }
  const entry = () => (
    <Router history={history}>
      <SettingsContextProvider>
        <Probe />
      </SettingsContextProvider>
    </Router>
  );
  for (const tradeMode of [TradeMode.Twap, TradeMode.StopMarket]) {
    const options: StoredTradeOptions = {
      tradeType: TradeType.Swap,
      tradeMode,
      tokens: {},
      markets: {},
      collaterals: {},
      isFromTokenGmxAccount: false,
    };
    const saved = JSON.stringify(options);
    for (const networkId of [ARBITRUM, SOLANA_NETWORK_ID]) {
      localStorage.setItem(JSON.stringify(getSyntheticsTradeOptionsKey(networkId)), saved);
    }
    selected.networkId = ARBITRUM;
    const view = render(entry());
    expect([trade.tradeType, trade.tradeMode]).toEqual([TradeType.Swap, tradeMode]);
    selected.networkId = SOLANA_NETWORK_ID;
    view.rerender(entry());
    expect([trade.tradeType, trade.tradeMode]).toEqual([TradeType.Long, TradeMode.Market]);
    selected.networkId = ARBITRUM;
    view.rerender(entry());
    expect([trade.tradeType, trade.tradeMode]).toEqual([TradeType.Swap, tradeMode]);
    for (const networkId of [ARBITRUM, SOLANA_NETWORK_ID]) {
      expect(localStorage.getItem(JSON.stringify(getSyntheticsTradeOptionsKey(networkId)))).toBe(saved);
    }
    selected.networkId = SOLANA_NETWORK_ID;
    view.rerender(entry());
    act(() => trade.setTradeMode(TradeMode.Limit));
    const updated = JSON.parse(localStorage.getItem(JSON.stringify(getSyntheticsTradeOptionsKey(SOLANA_NETWORK_ID)))!);
    expect([updated.tradeType, updated.tradeMode]).toEqual([TradeType.Long, TradeMode.Limit]);
    expect(localStorage.getItem(JSON.stringify(getSyntheticsTradeOptionsKey(ARBITRUM)))).toBe(saved);
    view.unmount();
  }
});

it("disables Express on Solana without migrating EVM execution settings or losing the saved mode", () => {
  selected.networkId = SOLANA_NETWORK_ID;
  selected.canSignTypedData = true;
  const expressKey = JSON.stringify(getExpressOrdersEnabledKey(ARBITRUM, undefined));
  const migrationKey = JSON.stringify(getHasOverriddenDefaultArb30ExecutionFeeBufferBpsKey(ARBITRUM));
  localStorage.setItem(expressKey, "true");
  localStorage.setItem(migrationKey, "false");
  let settings!: ReturnType<typeof useSettings>;
  function Probe() {
    settings = useSettings();
    return null;
  }
  const entry = () => (
    <SettingsContextProvider>
      <Probe />
    </SettingsContextProvider>
  );
  const view = render(entry());
  expect(settings.expressOrdersEnabled).toBe(false);
  expect(localStorage.getItem(expressKey)).toBe("true");
  expect(localStorage.getItem(migrationKey)).toBe("false");
  selected.networkId = ARBITRUM;
  view.rerender(entry());
  expect(settings.expressOrdersEnabled).toBe(true);
  expect(localStorage.getItem(migrationKey)).toBe("true");
  selected.networkId = SOLANA_NETWORK_ID;
  view.rerender(entry());
  expect(settings.expressOrdersEnabled).toBe(false);
  expect(localStorage.getItem(expressKey)).toBe("true");
});

it("isolates actual tradebox/seller preferences with the same EVM chainId on every render and late write", () => {
  localStorage.setItem('[42161,"leverage-option"]', "7");
  localStorage.setItem('[42161,"Exchange-keep-leverage"]', "false");
  const history = createMemoryHistory();
  const seen: (number | undefined)[] = [];
  let trade!: ReturnType<typeof useTradeboxState>;
  let settings!: ReturnType<typeof useSettings>;
  let seller!: ReturnType<typeof usePositionSellerState>;
  function Probe({ networkId }: { networkId: NetworkId }) {
    settings = useSettings();
    trade = useTradeboxState(ARBITRUM, false, { networkId, srcChainId: undefined });
    seller = usePositionSellerState(networkId, undefined, undefined);
    seen.push(trade.leverageOption);
    return null;
  }
  function App({ networkId }: { networkId: NetworkId }) {
    selected.networkId = networkId;
    return (
      <Router history={history}>
        <SettingsContextProvider>
          <Probe networkId={networkId} />
        </SettingsContextProvider>
      </Router>
    );
  }
  const view = render(<App networkId={ARBITRUM} />);
  expect([trade.leverageOption, trade.keepLeverage, seller.keepLeverage]).toEqual([7, false, false]);
  expect(settings.isLeverageSliderEnabled).toBe(true);
  act(() => seller.setKeepLeverage(true));
  expect(trade.keepLeverage).toBe(true);
  const lateEvmWrite = trade.setLeverageOption;
  seen.length = 0;
  view.rerender(<App networkId={SOLANA_NETWORK_ID} />);
  expect(seen.every((value) => value === 2)).toBe(true);
  expect([trade.keepLeverage, seller.keepLeverage]).toEqual([true, true]);
  act(() => {
    trade.setLeverageOption(3);
    seller.setKeepLeverage(false);
    settings.setIsLeverageSliderEnabled(false);
  });
  expect(localStorage.getItem(JSON.stringify(getKeepLeverageKey(SOLANA_NETWORK_ID)))).toBe("false");
  act(() => lateEvmWrite((value) => (value ?? 0) + 1));
  expect(trade.leverageOption).toBe(3);
  expect(localStorage.getItem('[42161,"leverage-option"]')).toBe("8");
  view.rerender(<App networkId={ARBITRUM} />);
  expect([trade.leverageOption, trade.keepLeverage, seller.keepLeverage, settings.isLeverageSliderEnabled]).toEqual([
    8,
    true,
    true,
    true,
  ]);
  view.rerender(<App networkId={SOLANA_NETWORK_ID} />);
  expect(trade.leverageOption).toBe(3);
  expect(settings.isLeverageSliderEnabled).toBe(false);
  expect(localStorage.getItem(JSON.stringify(getLeverageKey(SOLANA_NETWORK_ID)))).toBe("3");
});

it("restores false and zero preferences synchronously, defaults functional writes and preserves legacy opt-out", () => {
  localStorage.setItem(JSON.stringify(getLeverageEnabledKey(SOLANA_NETWORK_ID)), "false");
  let value!: ReturnType<typeof useLocalStorageSerializeKeySafe<number | boolean | null>>;
  function Probe({ networkId, initialize }: { networkId: number; initialize: boolean }) {
    value = useLocalStorageSerializeKeySafe<number | boolean | null>(getLeverageEnabledKey(networkId), 2, {
      readFromStorage: initialize,
    });
    return null;
  }
  const view = render(<Probe networkId={ARBITRUM} initialize />);
  act(() => value[1](0));
  view.rerender(<Probe networkId={SOLANA_NETWORK_ID} initialize />);
  expect(value[0]).toBe(false);
  view.rerender(<Probe networkId={ARBITRUM} initialize />);
  expect(value[0]).toBe(0);
  view.rerender(<Probe networkId={43114} initialize />);
  act(() => value[1]((previous) => Number(previous) + 1));
  expect(value[0]).toBe(3);
  view.rerender(<Probe networkId={43113} initialize={false} />);
  expect(value[0]).toBeUndefined();
  act(() => value[1](null));
  expect(value[0]).toBeNull();
  expect(localStorage.getItem('[42161,"leverage-enabled"]')).toBe("0");
});

it("restores selections and advanced options before effects and confines late updates and URL changes to their network", () => {
  const market = createMockMarketInfo();
  const marketsInfoData = { [market.marketTokenAddress]: market };
  const tokensData = { [ETH_TOKEN.address]: ETH_TOKEN, [USDC_TOKEN.address]: USDC_TOKEN };
  const options: StoredTradeOptions = {
    tradeType: TradeType.Short,
    tradeMode: TradeMode.Limit,
    tokens: { indexTokenAddress: ETH_TOKEN.address, fromTokenAddress: USDC_TOKEN.address },
    markets: { [ETH_TOKEN.address]: { long: market.marketTokenAddress, short: market.marketTokenAddress } },
    collaterals: { [market.marketTokenAddress]: { short: USDC_TOKEN.address } },
    advanced: { advancedDisplay: true, limitOrTPSL: true },
    isFromTokenGmxAccount: false,
  };
  localStorage.setItem('[42161,"synthetics-trade-options"]', JSON.stringify(options));
  const solanaOptions = {
    ...options,
    tradeType: TradeType.Long,
    advanced: { advancedDisplay: false, limitOrTPSL: false },
  };
  localStorage.setItem(JSON.stringify(getSyntheticsTradeOptionsKey(SOLANA_NETWORK_ID)), JSON.stringify(solanaOptions));
  const history = createMemoryHistory({ initialEntries: ["/trade/short?to=ETH&keep=1"] });
  let trade!: ReturnType<typeof useTradeboxState>;
  const seen: TradeType[] = [];
  function Probe({ networkId }: { networkId?: NetworkId }) {
    trade = useTradeboxState(ARBITRUM, true, { networkId, srcChainId: undefined, marketsInfoData, tokensData });
    seen.push(trade.tradeType);
    return null;
  }
  const app = (networkId?: NetworkId) => (
    <Router history={history}>
      <SettingsContextProvider>
        <Probe networkId={networkId} />
      </SettingsContextProvider>
    </Router>
  );
  const view = render(app());
  expect([
    trade.tradeType,
    trade.tradeMode,
    trade.marketAddress,
    trade.collateralAddress,
    trade.advancedOptions,
  ]).toEqual([TradeType.Short, TradeMode.Limit, market.marketTokenAddress, USDC_TOKEN.address, options.advanced]);
  const lateConfig = trade.setTradeConfig;
  const lateAdvanced = trade.setAdvancedOptions;
  seen.length = 0;
  view.rerender(app(SOLANA_NETWORK_ID));
  expect(seen.every((type) => type === TradeType.Long)).toBe(true);
  expect(trade.advancedOptions).toEqual(solanaOptions.advanced);
  act(() => {
    trade.setFromTokenAddress(ETH_TOKEN.address);
    trade.setTradeMode(TradeMode.Market);
    trade.setAdvancedOptions((old) => ({ ...old, limitOrTPSL: true }));
  });
  act(() => {
    lateConfig({ tradeType: TradeType.Swap, fromTokenAddress: USDC_TOKEN.address, toTokenAddress: ETH_TOKEN.address });
    lateAdvanced((old) => ({ ...old, advancedDisplay: false }));
  });
  expect([trade.tradeType, trade.fromTokenAddress, trade.tradeMode]).toEqual([
    TradeType.Long,
    ETH_TOKEN.address,
    TradeMode.Market,
  ]);
  expect(history.location.pathname).toBe("/trade/short");
  expect(trade.advancedOptions).toEqual({ advancedDisplay: false, limitOrTPSL: true });
  view.rerender(app());
  expect([trade.tradeType, trade.fromTokenAddress, trade.toTokenAddress]).toEqual([
    TradeType.Swap,
    USDC_TOKEN.address,
    ETH_TOKEN.address,
  ]);
  expect(trade.advancedOptions).toEqual({ advancedDisplay: false, limitOrTPSL: true });
  act(() =>
    trade.setTradeConfig({
      tradeType: TradeType.Short,
      toTokenAddress: ETH_TOKEN.address,
      marketAddress: market.marketTokenAddress,
    })
  );
  expect(history.location.pathname).toBe("/trade/short");
  expect(history.location.search).toBe("?to=ETH&keep=1");
  view.rerender(app(SOLANA_NETWORK_ID));
  expect([trade.tradeType, trade.fromTokenAddress, trade.tradeMode]).toEqual([
    TradeType.Long,
    ETH_TOKEN.address,
    TradeMode.Market,
  ]);
});

it("initializes delayed market defaults per network, preserves deep-link direction and isolates sorting on the first render", () => {
  const market = createMockMarketInfo();
  const second = createMockMarketInfo(ETH_TOKEN, { marketTokenAddress: SECOND_ETH_MARKET_ADDRESS });
  const marketsData = createMockMarketsData([market, second]);
  const marketsInfoData = { [market.marketTokenAddress]: market, [second.marketTokenAddress]: second };
  const tokensData = { [ETH_TOKEN.address]: ETH_TOKEN, [USDC_TOKEN.address]: USDC_TOKEN };
  localStorage.setItem(
    "sorted-markets-key:42161",
    JSON.stringify([second.marketTokenAddress, market.marketTokenAddress])
  );
  localStorage.setItem(
    getSortedMarketsAddressesKey(SOLANA_NETWORK_ID),
    JSON.stringify([second.marketTokenAddress, market.marketTokenAddress])
  );
  let trade!: ReturnType<typeof useTradeboxState>;
  let sorted!: string[];
  const seenSorting: string[][] = [];
  function Probe({ networkId, loaded }: { networkId: NetworkId; loaded: boolean }) {
    const data = loaded ? marketsInfoData : undefined;
    trade = useTradeboxState(ARBITRUM, true, {
      networkId,
      srcChainId: undefined,
      marketsData,
      marketsInfoData: data,
      tokensData,
    });
    sorted = useAvailableTokenOptions(ARBITRUM, {
      networkId,
      marketsData,
      marketsInfoData: data,
      srcChainId: undefined,
    }).sortedMarketConfigs.map((m) => m.marketTokenAddress);
    seenSorting.push(sorted);
    return null;
  }
  const history = createMemoryHistory({ initialEntries: ["/trade/short?to=ETH"] });
  const app = (networkId: NetworkId, loaded: boolean) => (
    <Router history={history}>
      <SettingsContextProvider>
        <Probe networkId={networkId} loaded={loaded} />
      </SettingsContextProvider>
    </Router>
  );
  const view = render(app(ARBITRUM, false));
  expect(sorted).toEqual([second.marketTokenAddress, market.marketTokenAddress]);
  act(() => {
    trade.setTradeConfig({ tradeType: TradeType.Short });
    trade.setAdvancedOptions({ advancedDisplay: true, limitOrTPSL: false });
  });
  view.rerender(app(ARBITRUM, true));
  expect([trade.tradeType, trade.marketAddress]).toEqual([TradeType.Short, market.marketTokenAddress]);
  expect(trade.advancedOptions.advancedDisplay).toBe(true);
  expect(history.location.search).toBe("?to=ETH");
  seenSorting.length = 0;
  view.rerender(app(SOLANA_NETWORK_ID, false));
  expect(trade.marketAddress).toBeUndefined();
  expect(trade.advancedOptions.advancedDisplay).toBe(false);
  expect(seenSorting.length).toBeGreaterThan(0);
  expect(
    seenSorting.every((addresses) => addresses.join() === [second.marketTokenAddress, market.marketTokenAddress].join())
  ).toBe(true);
  view.rerender(app(SOLANA_NETWORK_ID, true));
  expect([trade.tradeType, trade.marketAddress]).toEqual([TradeType.Long, market.marketTokenAddress]);
  act(() => trade.setUserSelectedMarketAddress(second.marketTokenAddress));
  expect(trade.marketAddress).toBe(second.marketTokenAddress);
  view.rerender(app(ARBITRUM, true));
  expect([trade.tradeType, trade.marketAddress, trade.advancedOptions.advancedDisplay]).toEqual([
    TradeType.Short,
    market.marketTokenAddress,
    true,
  ]);
  view.rerender(app(SOLANA_NETWORK_ID, true));
  expect(trade.marketAddress).toBe(second.marketTokenAddress);
  expect(trade.userSelectedMarkets?.[ETH_TOKEN.address]?.long).toBe(second.marketTokenAddress);
});

it("isolates shared Settings reads, writes and tradebox defaults across networks while retaining EVM values and legacy icon modes", () => {
  const saved = [33, 55, true, true, false, true, true, false, true, 9];
  const keys = [
    "Exchange-swap-slippage-basis-points-v4",
    "synthetics-acceptable-price-impact-buffer",
    "Exchange-swap-show-pnl-after-fees",
    "Exchange-swap-is-pnl-in-leverage",
    "is-auto-cancel-tpsl",
    "breakdown-net-price-impact-enabled",
    "set-acceptable-price-impact-enabled",
    "Exchange-swap-should-show-position-lines-key",
    "Exchange-swap-should-show-buy-sell-icons-key",
    "twap-number-of-parts",
  ];
  keys.forEach((key, i) => localStorage.setItem(JSON.stringify([ARBITRUM, key]), JSON.stringify(saved[i])));
  let settings!: ReturnType<typeof useSettings>;
  let trade!: ReturnType<typeof useTradeboxState>;
  const snapshot = () => [
    settings.savedAllowedSlippage,
    settings.savedAcceptablePriceImpactBuffer,
    settings.showPnlAfterFees,
    settings.isPnlInLeverage,
    settings.isAutoCancelTPSL,
    settings.breakdownNetPriceImpactEnabled,
    settings.isSetAcceptablePriceImpactEnabled,
    settings.shouldShowPositionLines,
    settings.buySellIconsMode,
    settings.savedTwapNumberOfParts,
  ];
  const seen: unknown[][] = [];
  function Probe({ networkId }: { networkId: NetworkId }) {
    settings = useSettings();
    trade = useTradeboxState(ARBITRUM, false, { networkId, srcChainId: undefined });
    seen.push([...snapshot(), trade.allowedSlippage, trade.numberOfParts]);
    return null;
  }
  const history = createMemoryHistory();
  function App({ networkId }: { networkId: NetworkId }) {
    selected.networkId = networkId;
    return (
      <Router history={history}>
        <SettingsContextProvider>
          <Probe networkId={networkId} />
        </SettingsContextProvider>
      </Router>
    );
  }
  const view = render(<App networkId={ARBITRUM} />);
  expect(snapshot()).toEqual([...saved.slice(0, 8), "all", 9]);
  const lateSettings = settings;
  const lateSlippage = trade.setAllowedSlippage;
  const lateParts = trade.setNumberOfParts;
  act(() => {
    trade.setAllowedSlippage(77);
    trade.setNumberOfParts(12);
  });
  seen.length = 0;
  view.rerender(<App networkId={SOLANA_NETWORK_ID} />);
  const defaults = [
    DEFAULT_SLIPPAGE_AMOUNT,
    DEFAULT_ACCEPTABLE_PRICE_IMPACT_BUFFER,
    false,
    false,
    true,
    false,
    false,
    true,
    "current",
    DEFAULT_TWAP_NUMBER_OF_PARTS,
  ];
  expect(seen.length).toBeGreaterThan(0);
  seen.forEach((values) =>
    expect(values).toEqual([...defaults, DEFAULT_SLIPPAGE_AMOUNT, DEFAULT_TWAP_NUMBER_OF_PARTS])
  );
  act(() => {
    settings.setSavedAllowedSlippage(0);
    settings.setSavedAcceptablePriceImpactBuffer(0);
    settings.setShowPnlAfterFees(false);
    settings.setIsPnlInLeverage(false);
    settings.setIsAutoCancelTPSL(false);
    settings.setBreakdownNetPriceImpactEnabled(false);
    settings.setIsSetAcceptablePriceImpactEnabled(false);
    settings.setShouldShowPositionLines(false);
    settings.setBuySellIconsMode("off");
    settings.setSavedTWAPNumberOfParts(3);
    trade.setAllowedSlippage((value) => value + 1);
    trade.setNumberOfParts((value) => value + 1);
  });
  const updated = [0, 0, false, false, false, false, false, false, "off", 3];
  expect(snapshot()).toEqual(updated);
  act(() => {
    lateSettings.setSavedAllowedSlippage(44);
    lateSettings.setSavedTWAPNumberOfParts(8);
    lateSettings.setBuySellIconsMode("current");
    lateSlippage(999);
    lateParts(999);
  });
  expect(snapshot()).toEqual(updated);
  expect([trade.allowedSlippage, trade.numberOfParts]).toEqual([
    DEFAULT_SLIPPAGE_AMOUNT + 1,
    DEFAULT_TWAP_NUMBER_OF_PARTS + 1,
  ]);
  keys.forEach((key, i) =>
    expect(JSON.parse(localStorage.getItem(JSON.stringify([SOLANA_NETWORK_ID, key]))!)).toEqual(updated[i])
  );
  view.rerender(<App networkId={ARBITRUM} />);
  expect(snapshot()).toEqual([44, 55, true, true, false, true, true, false, "current", 8]);
  expect([trade.allowedSlippage, trade.numberOfParts]).toEqual([44, 8]);
  view.rerender(<App networkId={SOLANA_NETWORK_ID} />);
  expect(snapshot()).toEqual(updated);
  expect([trade.allowedSlippage, trade.numberOfParts]).toEqual([0, 3]);
});
