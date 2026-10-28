import { describe, expect, it } from "vitest";

import type { TradeAction as SubsquidTradeAction } from "codegen/subsquid";
import { mockMarketsInfoData } from "utils/markets/__tests__/mockMarkets";
import { OrderType } from "utils/orders/types";
import type { TokenData, TokensData } from "utils/tokens/types";
import { createRawTradeActionTransformer } from "utils/tradeHistory/utils";

const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

const usdc: TokenData = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  address: USDC_ADDRESS,
  isStable: true,
  prices: { minPrice: 10n ** 24n, maxPrice: 10n ** 24n },
};

const weth: TokenData = {
  name: "Wrapped Ether",
  symbol: "WETH",
  decimals: 18,
  address: WETH_ADDRESS,
  isWrapped: true,
  prices: { minPrice: 2000n * 10n ** 12n, maxPrice: 2000n * 10n ** 12n },
};

const tokensData: TokensData = { [USDC_ADDRESS]: usdc, [WETH_ADDRESS]: weth };

const rawSwapAction = {
  id: "0xdeadbeef:1",
  eventName: "OrderExecuted",
  account: "0x90c5814240Ae5Cf09730536e76C117FA00Eb7d8e",
  orderType: OrderType.MarketSwap,
  orderKey: "0xorderkey",
  swapPath: [],
  initialCollateralTokenAddress: USDC_ADDRESS,
  initialCollateralDeltaAmount: "1000000",
  minOutputAmount: "500000000000000",
  executionAmountOut: "522169429885209",
  shouldUnwrapNativeToken: false,
  timestamp: 1786095479,
  transactionHash: "0xdeadbeef",
} as unknown as SubsquidTradeAction;

const transform = createRawTradeActionTransformer({}, weth, tokensData);
const transformSwap = (overrides: Partial<SubsquidTradeAction>) => transform({ ...rawSwapAction, ...overrides }, 0, []);

describe("createRawTradeActionTransformer", () => {
  it("exposes the settled swap fee and swap price impact of a pure swap", () => {
    const tradeAction = transformSwap({
      swapFeeUsd: "499878460269198975000000000",
      swapImpactUsd: "-933922965518581505565621250",
    });

    expect(tradeAction).toMatchObject({
      type: "swap",
      executionAmountOut: 522169429885209n,
      swapFeeUsd: 499878460269198975000000000n,
      swapImpactUsd: -933922965518581505565621250n,
    });
  });

  it("keeps a genuine zero apart from missing source data", () => {
    expect(transformSwap({ swapFeeUsd: "0", swapImpactUsd: "0" })).toMatchObject({
      swapFeeUsd: 0n,
      swapImpactUsd: 0n,
    });

    const withoutEconomics = transformSwap({ swapFeeUsd: null, swapImpactUsd: null });

    expect(withoutEconomics).toHaveProperty("swapFeeUsd", undefined);
    expect(withoutEconomics).toHaveProperty("swapImpactUsd", undefined);
  });
});

it("resolves position and swap history through exact base58 keys and checksummed EVM keys", () => {
  const mint = "So11111111111111111111111111111111111111112";
  const stableMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  for (const [index, collateral, rawIndex, rawCollateral] of [
    [WETH_ADDRESS, USDC_ADDRESS, WETH_ADDRESS.toLowerCase(), USDC_ADDRESS.toLowerCase()],
    [mint, stableMint, mint, stableMint],
  ]) {
    const indexToken = { ...weth, address: index };
    const collateralToken = { ...usdc, address: collateral };
    const tokenMap = { [index]: indexToken, [collateral]: collateralToken };
    const key = `${index}-${index}-${collateral}`;
    const market = { ...mockMarketsInfoData(tokenMap, [key])[key], marketTokenAddress: index };
    const convert = createRawTradeActionTransformer({ [index]: market }, indexToken, tokenMap);
    for (const orderType of [OrderType.MarketIncrease, OrderType.MarketSwap]) {
      const raw = {
        ...rawSwapAction,
        orderType,
        marketAddress: rawIndex,
        initialCollateralTokenAddress: rawCollateral,
        swapPath: [rawIndex],
        acceptablePrice: "0",
        sizeDeltaUsd: "0",
        isLong: true,
      };
      const action = convert(raw, 0, []);
      expect(action).toMatchObject({
        swapPath: [index],
        initialCollateralToken: collateralToken,
        targetCollateralToken: indexToken,
      });
      if (action?.type === "position") expect(action.marketAddress).toBe(index);
      if (index === mint) {
        expect(
          convert({ ...raw, marketAddress: mint.toLowerCase(), swapPath: [mint.toLowerCase()] }, 0, [])
        ).toBeUndefined();
      }
    }
  }
});
