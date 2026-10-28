import { describe, expect, it } from "vitest";

import { ARBITRUM, AVALANCHE, SOLANA_NETWORK_ID } from "config/chains";
import { getTokenBySymbol, NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";
import { TradeMode, TradeType } from "sdk/utils/trade/types";

import { getAvailableTradeModes } from "../availableTradeModes";

describe("getAvailableTradeModes", () => {
  it("keeps EVM mode groups and wrap pairs while restricting the selected Solana network", () => {
    for (const chainId of [ARBITRUM, AVALANCHE]) {
      for (const tradeType of [TradeType.Long, TradeType.Short, TradeType.Swap]) {
        const request = { chainId, tradeType, fromTokenAddress: undefined, toTokenAddress: undefined };
        expect(getAvailableTradeModes({ ...request, networkId: chainId })).toEqual(
          tradeType === TradeType.Swap
            ? [TradeMode.Market, TradeMode.Limit, TradeMode.Twap]
            : [TradeMode.Market, TradeMode.Limit, [TradeMode.StopMarket, TradeMode.Twap]]
        );
        expect(getAvailableTradeModes({ ...request, networkId: SOLANA_NETWORK_ID })).toEqual(
          tradeType === TradeType.Swap ? [] : [TradeMode.Market, TradeMode.Limit]
        );
      }
      const wrapped = getTokenBySymbol(chainId, chainId === ARBITRUM ? "WETH" : "WAVAX").address;
      for (const [fromTokenAddress, toTokenAddress] of [
        [NATIVE_TOKEN_ADDRESS, wrapped],
        [wrapped, NATIVE_TOKEN_ADDRESS],
      ]) {
        expect(
          getAvailableTradeModes({
            chainId,
            networkId: chainId,
            tradeType: TradeType.Swap,
            fromTokenAddress,
            toTokenAddress,
          })
        ).toEqual([TradeMode.Market]);
      }
    }
  });
});
