import { expect, type Request } from "@playwright/test";
import process from "node:process";

import { test } from "../fixtures/browser";

for (const enabled of [false, true]) {
  test(`Solana flag ${enabled ? "on preserves selection and EVM chain identity" : "off keeps the legacy modal without SDK loading"}`, async ({
    page,
  }) => {
    const auditEnabled = enabled && process.env.SOLANA_REQUEST_AUDIT === "1";
    if (auditEnabled) test.setTimeout(150_000);
    let phase = "evm-start";
    const startedAt = Date.now();
    const windows: { phase: string; startMs: number; endMs: number }[] = [];
    const requests: {
      phase: string;
      startMs: number;
      target: string;
      method: string;
      rpcMethods: string[];
      status?: number;
      endMs?: number;
      outcome?: string;
    }[] = [];
    const reportDiagnostics: {
      phase: string;
      status: number;
      itemTypes: string[];
      hasLocalHost: boolean;
      hasDevItems: boolean;
      metricVersionStates: string[];
      networkIds: (number | "other")[];
      responseFormat?: string;
      errorTerms?: string[];
    }[] = [];
    const records = new WeakMap<Request, (typeof requests)[number]>();
    const initiators: { phase: string; startMs: number; priority: string; methods: string[]; stack: string[] }[] = [];
    const flagInitiators: { phase: string; startMs: number; target: string; stack: string[] }[] = [];
    if (auditEnabled) {
      const session = await page.context().newCDPSession(page);
      await session.send("Network.enable");
      session.on("Network.requestWillBeSent", (event) => {
        const flagUrl = new URL(event.request.url);
        if (event.request.method === "GET" && flagUrl.pathname === "/ui-flags/v2") {
          flagInitiators.push({
            phase,
            startMs: Date.now() - startedAt,
            target: `${flagUrl.origin}${flagUrl.pathname}`,
            stack: (event.initiator.stack?.callFrames ?? []).slice(0, 12).map((frame) => frame.functionName),
          });
        }
        if (!event.request.postData) return;
        try {
          const body = JSON.parse(event.request.postData);
          const methods = (Array.isArray(body) ? body : [body])
            .map((item) => item?.method)
            .filter((method): method is string => typeof method === "string" && /^(eth_|net_|web3_)/.test(method));
          if (!methods.length) return;
          initiators.push({
            phase,
            startMs: Date.now() - startedAt,
            priority: event.request.initialPriority,
            methods,
            stack: (event.initiator.stack?.callFrames ?? []).slice(0, 12).map((frame) => {
              const url = new URL(frame.url || "about:blank");
              const source =
                url.origin === new URL(test.info().project.use.baseURL!).origin ? url.pathname : "external";
              return `${frame.functionName} ${source}:${frame.lineNumber + 1}`;
            }),
          });
        } catch {
          // Non-JSON payloads are not retained.
        }
      });
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.origin === new URL(test.info().project.use.baseURL!).origin) return;
        if (!["fetch", "xhr"].includes(request.resourceType())) return;
        let rpcMethods: string[] = [];
        try {
          const body = request.postDataJSON();
          rpcMethods = (Array.isArray(body) ? body : [body])
            .map((item) => item?.method)
            .filter((method): method is string => typeof method === "string" && /^[a-zA-Z_][\w.]*$/.test(method));
        } catch {
          // Non-JSON HTTP bodies are not RPC and are never retained.
        }
        const publicPath =
          /^\/(rpc|ext\/bc\/C\/rpc|prices\/tickers|prices|ui-flags(?:\/v2)?|report\/ui\/batch_report)$/.test(
            url.pathname
          )
            ? url.pathname
            : "/<redacted>";
        const record = {
          phase,
          startMs: Date.now() - startedAt,
          target: `${url.origin}${publicPath}`,
          method: request.method(),
          rpcMethods,
        };
        requests.push(record);
        records.set(request, record);
      });
      page.on("response", (response) => {
        const record = records.get(response.request());
        if (record) record.status = response.status();
        if (!record?.target.endsWith("/report/ui/batch_report")) return;
        try {
          const items = response.request().postDataJSON()?.items;
          if (!Array.isArray(items)) return;
          const diagnostic: (typeof reportDiagnostics)[number] = {
            phase: record.phase,
            status: response.status(),
            itemTypes: [
              ...new Set(
                items.map((item) =>
                  ["event", "counter", "timing", "userAnalyticsEvent", "userAnalyticsProfile"].includes(item?.type)
                    ? item.type
                    : "other"
                )
              ),
            ],
            hasLocalHost: items.some((item) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(item?.payload?.host)),
            hasDevItems: items.some((item) => item?.payload?.isDev === true),
            metricVersionStates: [
              ...new Set(
                items
                  .filter((item) => ["event", "counter", "timing"].includes(item?.type))
                  .map((item) =>
                    typeof item?.payload?.version === "string"
                      ? item.payload.version.length
                        ? "present"
                        : "empty"
                      : item?.payload?.version === undefined
                        ? "missing"
                        : "invalidType"
                  )
              ),
            ],
            networkIds: [
              ...new Set(
                items.map((item) => {
                  const id = item?.payload?.customFields?.networkId;
                  return [42161, 43114, -501].includes(id) ? id : "other";
                })
              ),
            ],
          };
          reportDiagnostics.push(diagnostic);
          void response
            .text()
            .then((body) => {
              diagnostic.responseFormat = /^\s*[{[]/.test(body) ? "json" : /<html/i.test(body) ? "html" : "text";
              // Retain only fixed vocabulary, never server-provided messages or submitted values.
              diagnostic.errorTerms = [
                "invalid",
                "missing",
                "required",
                "unknown",
                "unsupported",
                "not",
                "allowed",
                "development",
                "dev",
                "isDev",
                "host",
                "origin",
                "url",
                "version",
                "chainId",
                "networkId",
                "items",
                "payload",
                "counter",
                "event",
                "timing",
                "customFields",
                "type",
                "field",
                "localhost",
                "validation",
                "error",
              ].filter((term) => new RegExp(`\\b${term}\\b`, "i").test(body));
            })
            .catch(() => {
              diagnostic.responseFormat = "unavailable";
            });
        } catch {
          // Malformed bodies are not retained.
        }
      });
      const finish = (request: Request, outcome: string) => {
        const record = records.get(request);
        if (record) Object.assign(record, { endMs: Date.now() - startedAt, outcome });
      };
      page.on("requestfinished", (request) => finish(request, "requestfinished"));
      page.on("requestfailed", (request) => finish(request, "requestfailed"));
    }
    const observe = async (durationMs: number) => {
      if (!auditEnabled) return;
      const startMs = Date.now() - startedAt;
      await page.waitForTimeout(durationMs);
      windows.push({ phase, startMs, endMs: Date.now() - startedAt });
      await test.info().attach(`request-audit-${phase}`, {
        body: JSON.stringify(
          {
            startedAt: new Date(startedAt).toISOString(),
            windows,
            requests,
            initiators,
            flagInitiators,
            reportDiagnostics,
          },
          null,
          2
        ),
        contentType: "application/json",
      });
    };
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
    await page.goto("/trade", { waitUntil: "domcontentloaded" });
    const network = page.getByTestId("networks-dropdown-handle").first();
    await expect(network.getByAltText("Arbitrum", { exact: true })).toBeVisible();
    expect((await state()).flag).toBe(enabled);
    await observe(10_000);
    phase = "warm-solana";
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
      await observe(65_000);
      phase = "cold-solana";
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(network.getByAltText("Solana", { exact: true })).toBeVisible();
      await observe(15_000);
      const navigation = page.getByRole("navigation");
      await expect(navigation.locator('a[href="/trade"]')).toBeVisible();
      await expect(navigation.locator('a[href="/pools"], a[href="/stats"], a[href="/earn"]')).toHaveCount(0);
      // The local visualizer's stats.html shadows /stats in Vite; use the SPA directory URL.
      for (const path of ["/pools/details", "/stats/", "/actions/v2"]) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "EVM networks only", exact: true })).toBeVisible();
      }
      await page.goto("/solana-unknown-page", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
      await page.goto("/v2?source=network-smoke", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/trade\?source=network-smoke$/);
      await expect(page.getByText("Trading on Solana is coming soon.", { exact: true })).toBeVisible();
      await page.getByTestId("header-settings").first().click();
      const settings = page.getByTestId("settings-modal");
      await expect(settings).toBeVisible();
      await expect(settings.getByText("Trading settings", { exact: true })).toHaveCount(0);
      await settings.getByText("Debug settings", { exact: true }).click();
      await expect(settings.getByText("Show debug values", { exact: true })).toBeVisible();
      await page.getByTestId("header-settings").first().click();
      await expect(settings).toBeHidden();
      phase = "evm-return";
      await network.click();
      await page.getByTestId("networks-dropdown-Arbitrum").click();
      await expect(network.getByAltText("Arbitrum", { exact: true })).toBeVisible();
      await expect(navigation.locator('a[href="/pools"]')).toBeVisible();
      await expect(navigation.locator('a[href="/stats"]')).toBeVisible();
      expect((await state()).solana).not.toBe("true");
      expect(await state()).toMatchObject({ chainId: "42161", settlementChainId: "42161" });
      await page.getByTestId("header-settings").first().click();
      await expect(settings.getByText("Trading settings", { exact: true })).toBeVisible();
      await observe(10_000);
      if (auditEnabled) {
        if (process.env.VITE_APP_VERSION) {
          for (const reportPhase of ["evm-start", "warm-solana", "cold-solana", "evm-return"]) {
            expect(
              reportDiagnostics.some(
                (report) =>
                  report.phase === reportPhase &&
                  report.status === 200 &&
                  report.metricVersionStates.includes("present")
              )
            ).toBe(true);
          }
          expect(reportDiagnostics.filter((report) => report.status >= 400)).toEqual([]);
          expect(
            reportDiagnostics.some((report) => report.phase === "cold-solana" && report.networkIds.includes(-501))
          ).toBe(true);
        }
        const isEvmRpc = (request: (typeof requests)[number]) =>
          request.rpcMethods.some((method) => /^(eth_|net_|web3_)/.test(method));
        expect(requests.filter((request) => request.phase === "cold-solana" && isEvmRpc(request))).toEqual([]);
        const coldFlags = flagInitiators.filter((request) => request.phase === "cold-solana");
        const warmWindow = windows.find((window) => window.phase === "warm-solana")!;
        expect(coldFlags.length).toBeGreaterThan(0);
        for (const request of flagInitiators.filter(
          (request) =>
            request.phase === "cold-solana" ||
            (request.phase === "warm-solana" && request.startMs >= warmWindow.startMs)
        )) {
          expect(request.target).toBe("https://arbitrum-api.gmxinfra.io/ui-flags/v2");
          expect(request.stack).toContain("fetchSolanaUiFlags");
        }
        expect(
          requests.some((request) => request.phase === "evm-start" && request.target.endsWith("/ui-flags/v2"))
        ).toBe(true);
        expect(
          requests.filter(
            (request) =>
              request.phase === "warm-solana" &&
              request.startMs >= warmWindow.startMs &&
              /\/prices\/tickers$/.test(request.target)
          )
        ).toEqual([]);
        const warmRpc = requests.filter(
          (request) => request.phase === "warm-solana" && request.startMs >= warmWindow.startMs && isEvmRpc(request)
        );
        const trackerProbes = initiators.filter(
          (request) =>
            request.phase === "warm-solana" &&
            request.startMs >= warmWindow.startMs &&
            request.priority === "Low" &&
            request.stack.some((frame) => frame.includes("RpcTracker.checkRpc"))
        );
        expect(warmRpc.length, "Every warm Solana RPC must have a tracker initiator").toBe(trackerProbes.length);
        for (const evmPhase of ["evm-start", "evm-return"]) {
          expect(requests.some((request) => request.phase === evmPhase && isEvmRpc(request))).toBe(true);
        }
        expect(
          requests.filter(
            (request) =>
              request.phase === "warm-solana" && request.startMs >= warmWindow.startMs + 60_000 && isEvmRpc(request)
          )
        ).toEqual([]);
      }
    }
    await test.info().attach("solana-network-state", {
      body: JSON.stringify({ enabled, state: await state(), sdkRequests }, null, 2),
      contentType: "application/json",
    });
  });
}
