import { defineConfig } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import base from "../../playwright-solana-readonly.config";

const root = fileURLToPath(new URL("../../", import.meta.url));
assert.ok(process.env.AGENT_SOLANA_BROWSER_RUN_DIR, "Use yarn solana:browser-check to create a run directory.");
const runDir = path.resolve(process.env.AGENT_SOLANA_BROWSER_RUN_DIR);
assert.equal(path.dirname(runDir), path.join(root, ".local/acceptance/solana-browser"));
assert.ok(path.basename(runDir).startsWith("managed-"));
const origin = new URL(base.use!.baseURL!);
assert.equal(origin.hostname, "127.0.0.1");
assert.ok(origin.port);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export default defineConfig({
  ...base,
  testDir: path.join(root, "autotests/regression/solana-read-only"),
  outputDir: path.join(runDir, "test-results"),
  globalTimeout: 180_000,
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(runDir, "html"), open: "never" }],
    ["json", { outputFile: path.join(runDir, "playwright-results.json") }],
  ],
  webServer: {
    command: [
      process.execPath,
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      origin.port,
      "--strictPort",
    ]
      .map(quote)
      .join(" "),
    cwd: root,
    url: `${origin.origin}/@vite/client`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    stdout: "pipe",
    stderr: "pipe",
  },
});
