import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ diagnostics: void }, { chainId: number; productionPreview: boolean }>({
  // Avalanche projects override this.
  chainId: [42161, { option: true, scope: "worker" }],
  productionPreview: [true, { option: true, scope: "worker" }],
  context: async ({ context, chainId, productionPreview }, use) => {
    await context.addInitScript(
      ({ network, preview }) => {
        if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
        if (!localStorage.getItem("regression-initialized")) {
          if (preview) localStorage.setItem("production-preview", "true");
          else localStorage.removeItem("production-preview");
          localStorage.setItem("SELECTED_NETWORK", String(network));
          localStorage.setItem("SELECTED_SETTLEMENT_CHAIN_ID", String(network));
          localStorage.setItem("LANGUAGE_KEY", "en");
          localStorage.setItem("regression-initialized", "true");
        }
      },
      { network: chainId, preview: productionPreview }
    );
    await use(context);
  },
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      const failedRequests: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => {
        if (failedRequests.length < 100) {
          const url = new URL(request.url());
          failedRequests.push(`${request.method()} ${url.origin}${url.pathname}: ${request.failure()?.errorText}`);
        }
      });
      await use();
      await testInfo.attach("browser-diagnostics", {
        body: JSON.stringify({ errors, failedRequests }, null, 2),
        contentType: "application/json",
      });
      expect(errors, "Unhandled JavaScript errors (25.01)").toEqual([]);
    },
    { auto: true },
  ],
});
