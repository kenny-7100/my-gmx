import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

export default defineConfig(async () => {
  const options = JSON.parse(await readFile(process.env.GMX_SDK_OFFLINE_OPTIONS, "utf8"));
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "test" },
    path.join(options.sdkDir, "vitest.config.ts")
  );
  assert.ok(loaded, "SDK Vitest configuration could not be loaded.");
  const config = mergeConfig(loaded.config, {
    root: options.sdkDir,
    envDir: options.emptyDir,
    cacheDir: path.join(options.emptyDir, "vite-cache"),
    test: {
      include: options.suites ?? loaded.config.test?.include ?? configDefaults.include,
      related: options.related,
      setupFiles: [fileURLToPath(new URL("./setup.mjs", import.meta.url))],
      fileParallelism: false,
      maxWorkers: 1,
      watch: false,
      passWithNoTests: false,
      retry: 0,
      reporters: ["default", "json"],
      outputFile: { json: options.resultsFile },
    },
  });
  // Selection is exact even if the SDK later adds its own include patterns.
  config.test.include = options.suites ?? loaded.config.test?.include ?? configDefaults.include;
  return config;
});
