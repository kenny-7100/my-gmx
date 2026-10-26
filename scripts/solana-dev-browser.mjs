import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { attachApiDiagnostics } from "./lib/agent-browser-diagnostics.mjs";
import { API_PREFIX } from "../tools/solana-dev/vite.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export async function runCli() {
  let browser;
  let runDir;
  let diagnostics;
  let stage = "arguments";
  try {
    const { values } = parseArgs({ options: { "web-port": { type: "string", default: "3010" } } });
    assert.ok(
      /^\d+$/.test(values["web-port"]) && Number(values["web-port"]) > 0 && Number(values["web-port"]) <= 65535
    );
    const origin = `http://127.0.0.1:${values["web-port"]}`;
    const output = path.join(ROOT, ".local/acceptance/solana-dev");
    await mkdir(output, { recursive: true });
    runDir = await mkdtemp(path.join(output, "browser-"));
    stage = "chrome-startup";
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    diagnostics = attachApiDiagnostics(page, `${origin}${API_PREFIX}`);
    // Open the actual Vite origin without exercising or replacing a GMX business module.
    stage = "local-origin-navigation";
    await page.goto(`${origin}/__agent/probe`, { waitUntil: "domcontentloaded" });
    stage = "api-requests";
    const result = await page.evaluate(async (prefix) => {
      const markets = await fetch(`${prefix}/v1/markets/config`);
      const positions = await fetch(`${prefix}/v1/positions?address=11111111111111111111111111111111`);
      const invalid = await fetch(`${prefix}/v1/positions?address=invalid-address&probe=redacted-sentinel`);
      return {
        markets: markets.status,
        marketCount: (await markets.json()).length,
        positions: positions.status,
        invalid: invalid.status,
      };
    }, API_PREFIX);
    assert.equal(result.markets, 200);
    assert.ok(result.marketCount > 0);
    assert.equal(result.positions, 200);
    assert.equal(result.invalid, 400);
    const sourceFiles = ["src/config/api.ts", "sdk/src/configs/api.ts", "gmx-api/src/solanaApp.ts"];
    const source = {};
    for (const file of sourceFiles)
      source[file] = createHash("sha256")
        .update(await readFile(path.join(ROOT, file)))
        .digest("hex");
    const report = await diagnostics.save(path.join(runDir, "requests.json"), {
      probeResult: "passed",
      requestSource: "explicit-tool-probe",
      businessPageAcceptance: "not-run",
      frontendConsumer: "not-evaluated",
      mode: "sample",
      baseUrl: origin,
      frontendCommit: execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      apiCommit: execFileSync("git", ["-C", path.join(ROOT, "gmx-api"), "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      source,
    });
    const failure = report.records.find((record) => record.status === 400);
    assert.equal(report.status, "captured");
    assert.ok(failure?.traceId);
    assert.ok(!JSON.stringify(report).includes("redacted-sentinel"));
    await writeFile(
      path.join(runDir, "report.json"),
      JSON.stringify(
        {
          status: "passed",
          ...result,
          requestsFile: path.join(runDir, "requests.json"),
          failureTraceId: failure.traceId,
          scope: "browser probe of development proxy; no frontend business integration",
        },
        null,
        2
      ) + "\n"
    );
    process.stdout.write(
      `${JSON.stringify({ status: "passed", runDir, failureTraceId: failure.traceId, businessPageAcceptance: "not-run" }, null, 2)}\n`
    );
  } catch {
    if (runDir) {
      await diagnostics?.save(path.join(runDir, "requests.json"), { probeResult: "failed", stage });
      await writeFile(path.join(runDir, "report.json"), `${JSON.stringify({ status: "failed", stage })}\n`);
    }
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "browser-probe-failed", stage, runDir, message: "Check Chrome, the running workspace and local proxy. No business-page acceptance is implied." })}\n`
    );
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch(() => {
    process.exitCode = 1;
  });
}
