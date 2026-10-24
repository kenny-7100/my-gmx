import { expect } from "@playwright/test";

import { test } from "../fixtures/browser";

for (const enabled of [false, true]) {
  test(`Solana flag ${enabled ? "on preserves selection and EVM chain identity" : "off keeps the legacy modal without SDK loading"}`, async ({
    page,
  }) => {
    await page.addInitScript((flag) => {
      if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
      if (localStorage.getItem("solana-smoke-initialized")) return;
      localStorage.setItem("ab-flags", JSON.stringify({ solanaNetwork: { enabled: flag } }));
      localStorage.removeItem("SELECTED_SOLANA_NETWORK");
      localStorage.setItem("solana-smoke-initialized", "true");
    }, enabled);
    const sdkRequests: string[] = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (/\/gmsol-sdk\/|\.wasm$/.test(pathname)) sdkRequests.push(pathname);
    });
    const state = () =>
      page.evaluate(() => ({
        solana: localStorage.getItem("SELECTED_SOLANA_NETWORK"),
        chainId: localStorage.getItem("SELECTED_NETWORK"),
        settlementChainId: localStorage.getItem("SELECTED_SETTLEMENT_CHAIN_ID"),
        flag: JSON.parse(localStorage.getItem("ab-flags") || "{}").solanaNetwork?.enabled,
      }));
    await page.goto("/trade");
    const network = page.getByTestId("networks-dropdown-handle").first();
    await expect(network.getByAltText("Arbitrum", { exact: true })).toBeVisible();
    expect((await state()).flag).toBe(enabled);
    await network.click();
    await page.getByTestId("networks-dropdown-solana").click();
    if (!enabled) {
      await expect(page.getByText("GMX on Solana", { exact: true })).toBeVisible();
      await expect(network.getByAltText("Arbitrum", { exact: true })).toBeVisible();
      expect((await state()).solana).not.toBe("true");
      expect(await state()).toMatchObject({ chainId: "42161", settlementChainId: "42161" });
      expect(sdkRequests).toEqual([]);
    } else {
      await expect(network.getByAltText("Solana", { exact: true })).toBeVisible();
      expect(await state()).toMatchObject({ solana: "true", chainId: "42161", settlementChainId: "42161" });
      await page.reload();
      await expect(network.getByAltText("Solana", { exact: true })).toBeVisible();
      await network.click();
      await page.getByTestId("networks-dropdown-Arbitrum").click();
      await expect(network.getByAltText("Arbitrum", { exact: true })).toBeVisible();
      expect((await state()).solana).not.toBe("true");
      expect(await state()).toMatchObject({ chainId: "42161", settlementChainId: "42161" });
    }
    await test.info().attach("solana-network-state", {
      body: JSON.stringify({ enabled, state: await state(), sdkRequests }, null, 2),
      contentType: "application/json",
    });
  });
}
