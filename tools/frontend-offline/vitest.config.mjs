import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";
import { defineConfig, mergeConfig } from "vitest/config";

export default defineConfig(async () => {
  const options = JSON.parse(await readFile(process.env.GMX_FRONTEND_OFFLINE_OPTIONS, "utf8"));
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "test" },
    path.join(options.projectDir, "vite.config.ts")
  );
  assert.ok(loaded, "Frontend Vitest configuration could not be loaded.");
  const require = createRequire(path.join(options.projectDir, "package.json"));
  loaded.config.test.setupFiles = loaded.config.test.setupFiles.map((file) =>
    file.startsWith(".") ? path.resolve(options.projectDir, file) : require.resolve(file)
  );
  loaded.config.test.globalSetup = path.resolve(options.projectDir, loaded.config.test.globalSetup);
  const config = mergeConfig(loaded.config, {
    root: options.projectDir,
    envDir: options.emptyDir,
    cacheDir: path.join(options.emptyDir, "vite-cache"),
    server: {
      fs: {
        allow: [
          options.projectDir,
          await realpath(path.join(options.projectDir, "node_modules")),
          fileURLToPath(new URL("../", import.meta.url)),
        ],
      },
    },
    test: {
      include: options.suites,
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
  // Selection is exact even if the Frontend later adds its own include patterns.
  config.test.include = options.suites;

  return config;
});
