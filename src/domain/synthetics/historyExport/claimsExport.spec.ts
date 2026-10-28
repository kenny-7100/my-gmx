import { describe, expect, it } from "vitest";

import { ClaimType } from "domain/synthetics/claimHistory/types";

import { buildClaimsCsvRows } from "./claimsExport";

describe("buildClaimsCsvRows", () => {
  it("expands every market and token leg deterministically", () => {
    const rows = buildClaimsCsvRows({
      chainId: 42161,
      rawActions: [
        {
          id: "0xhash:4",
          eventName: ClaimType.ClaimFunding,
          account: "0xAccount",
          marketAddresses: ["0xMarketA", "0xMarketB"],
          tokenAddresses: ["0xTokenA", "0xTokenB"],
          amounts: ["12500000", "3250000"],
          tokenPrices: ["1000000000000000000000000", "1000000000000000000000000"],
          isLongOrders: [true, false],
          transactionHash: "0xHash",
          timestamp: 1783425600,
        },
      ],
      marketsInfoData: {
        "0xMarketA": {
          indexToken: { symbol: "ETH" },
          indexTokenAddress: "0xEth",
          isSpotOnly: false,
        },
        "0xMarketB": {
          indexToken: { symbol: "BTC" },
          indexTokenAddress: "0xBtc",
          isSpotOnly: false,
        },
      } as any,
      tokensData: {
        "0xTokenA": { symbol: "USDC", decimals: 6 },
        "0xTokenB": { symbol: "USDC", decimals: 6 },
      } as any,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      amount: "12.5",
      amount_usd: "12.5",
      is_long: true,
      leg_index: 0,
      record_id: "42161:0xhash:4:0",
      log_index: "4",
    });
    expect(rows[1]).toMatchObject({ amount: "3.25", is_long: false, leg_index: 1 });
  });

  it("keeps non-economic and unresolved rows for manual review", () => {
    const [row] = buildClaimsCsvRows({
      chainId: 42161,
      rawActions: [
        {
          id: "request-1",
          eventName: ClaimType.SettleFundingFeeCreated,
          account: "0xAccount",
          marketAddresses: ["0xUnknownMarket"],
          tokenAddresses: [],
          amounts: [],
          tokenPrices: [],
          isLongOrders: [true],
          transactionHash: "0xHash",
          timestamp: 1783425600,
        },
      ],
      marketsInfoData: {},
      tokensData: {},
    });

    expect(row).toMatchObject({
      status: "created",
      amount: "",
      data_completeness: "partial",
      market_address: "0xUnknownMarket",
      claim_action_id: "42161:request-1",
    });
  });
});

it("resolves EVM metadata case-insensitively without merging distinct base58 assets", () => {
  const evm = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  for (const [address, key, matches] of [
    [evm.toLowerCase(), evm, true],
    [mint, mint, true],
    [mint.toLowerCase(), mint, false],
  ] as const) {
    const [row] = buildClaimsCsvRows({
      chainId: 42161,
      rawActions: [
        {
          id: "claim:1",
          eventName: ClaimType.ClaimFunding,
          account: "account",
          marketAddresses: [],
          tokenAddresses: [address],
          amounts: ["1000000"],
          tokenPrices: ["1000000000000000000000000"],
          transactionHash: "tx",
          timestamp: 1783425600,
        },
      ],
      marketsInfoData: {},
      tokensData: {
        [key]: {
          address: key,
          name: "USD Coin",
          symbol: "USDC",
          decimals: 6,
          prices: { minPrice: 10n ** 30n, maxPrice: 10n ** 30n },
        },
      },
    });
    expect(row.token_address).toBe(address);
    expect(row.token_symbol).toBe(matches ? "USDC" : "");
    expect(row.amount).toBe(matches ? "1" : "");
    if (!matches) expect(row.manual_review_reason).toContain("token metadata unavailable");
  }
});
