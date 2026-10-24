import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import process from "node:process";

const baseURL = process.env.REGRESSION_BASE_URL || "http://127.0.0.1:3010";
const target = new URL(baseURL);
if (
  target.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
  target.pathname !== "/" ||
  target.search ||
  target.hash ||
  target.username ||
  target.password
) {
  throw new Error(
    "Solana read-only smoke tests require a local development server URL without credentials or query parameters."
  );
}

export default defineConfig<object, { chainId: number; productionPreview: boolean }>({
  testDir: "./autotests/regression/solana-read-only",
  testMatch: "*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: "test-results/solana-read-only",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/solana-read-only", open: "never" }],
    ["json", { outputFile: "test-results/solana-read-only-results.json" }],
  ],
  metadata: {
    scope: "solana-local-read-only-network-smoke",
    checkoutCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    checkoutDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
    target: baseURL,
    data: "Local development flags; no injected wallet, signing, broadcast or business data assertions.",
  },
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    chainId: 42161,
    productionPreview: false,
    baseURL,
    testIdAttribute: "data-qa",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
