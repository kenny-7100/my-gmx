import type { Address } from "viem";
import { describe, expect, it } from "vitest";

import { ARBITRUM } from "configs/chains";
import { getAddressKey } from "utils/address";
import { OrderType } from "utils/orders/types";

import { matchByMarket, parseGetOrdersResponse } from "./utils";

const ACCOUNT = "0x1000000000000000000000000000000000000001";
const MARKET = "0x2000000000000000000000000000000000000002";
const TOKEN = "0x3000000000000000000000000000000000000003";
const ORDER_KEY = "0x4000000000000000000000000000000000000000000000000000000000000004";

function makeRawOrder(uiFeeFactor: bigint) {
  return {
    orderKey: ORDER_KEY,
    order: {
      addresses: {
        account: ACCOUNT,
        receiver: ACCOUNT,
        cancellationReceiver: ACCOUNT,
        callbackContract: ACCOUNT,
        uiFeeReceiver: ACCOUNT,
        market: MARKET,
        initialCollateralToken: TOKEN,
        swapPath: [],
      },
      numbers: {
        orderType: 2n,
        decreasePositionSwapType: 0n,
        sizeDeltaUsd: 1000n,
        initialCollateralDeltaAmount: 100n,
        triggerPrice: 0n,
        acceptablePrice: 0n,
        executionFee: 1n,
        callbackGasLimit: 0n,
        minOutputAmount: 0n,
        uiFeeFactor,
        updatedAtTime: 1n,
        validFromTime: 0n,
        srcChainId: 0n,
      },
      flags: { isLong: true, shouldUnwrapNativeToken: false, isFrozen: false, autoCancel: false },
      _dataList: [],
    },
  };
}

function makeResponse(uiFeeFactors: bigint[]) {
  return {
    data: {
      dataStore: {
        count: { returnValues: [BigInt(uiFeeFactors.length)] },
        keys: { returnValues: uiFeeFactors.map(() => ORDER_KEY) },
      },
      reader: {
        orders: { returnValues: uiFeeFactors.map(makeRawOrder) },
      },
    },
  } as any;
}

describe("parseGetOrdersResponse", () => {
  it("extracts the uiFeeFactor snapshot from order numbers", () => {
    const { orders } = parseGetOrdersResponse(makeResponse([5_000_000_000_000_000_000_000_000n]));

    expect(orders[0].uiFeeFactor).toBe(5_000_000_000_000_000_000_000_000n);
  });

  it("keeps a zero snapshot as 0n for pre-upgrade orders", () => {
    const { orders } = parseGetOrdersResponse(makeResponse([0n]));

    expect(orders[0].uiFeeFactor).toBe(0n);
    expect(orders[0].sizeDeltaUsd).toBe(1000n);
  });
});

describe("order filter address identity", () => {
  it("keeps EVM matching and distinguishes base58 case for markets, collateral and swap endpoints", () => {
    const evm = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const mint = "So11111111111111111111111111111111111111112";
    const base = parseGetOrdersResponse(makeResponse([0n])).orders[0];
    for (const [address, filter, expected] of [
      [evm, evm.toLowerCase(), true],
      [mint, mint, true],
      [mint, mint.toLowerCase(), false],
    ] as const) {
      for (const orderType of [OrderType.LimitIncrease, OrderType.StopLossDecrease, OrderType.MarketSwap]) {
        const isSwap = orderType === OrderType.MarketSwap;
        for (const swapPath of [
          [address, MARKET],
          [MARKET, address],
        ]) {
          expect(
            matchByMarket({
              order: { ...base, orderType, marketAddress: address, initialCollateralTokenAddress: address, swapPath },
              nonSwapRelevantDefinedFiltersLowercased: [
                { marketAddress: getAddressKey(filter) as Address, direction: "long" },
              ],
              hasNonSwapRelevantDefinedMarkets: !isSwap,
              swapRelevantDefinedMarketsLowercased: [getAddressKey(filter) as Address],
              hasSwapRelevantDefinedMarkets: isSwap,
              pureDirectionFilters: [],
              hasPureDirectionFilters: false,
              chainId: ARBITRUM,
            })
          ).toBe(expected);
        }
      }
      expect(
        matchByMarket({
          order: { ...base, orderType: OrderType.StopLossDecrease, initialCollateralTokenAddress: address },
          nonSwapRelevantDefinedFiltersLowercased: [
            { marketAddress: MARKET, direction: "long", collateralAddress: filter as Address },
          ],
          hasNonSwapRelevantDefinedMarkets: true,
          swapRelevantDefinedMarketsLowercased: [],
          hasSwapRelevantDefinedMarkets: false,
          pureDirectionFilters: [],
          hasPureDirectionFilters: false,
          chainId: ARBITRUM,
        })
      ).toBe(expected);
    }
  });
});
