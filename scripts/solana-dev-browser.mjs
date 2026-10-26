import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { sourceEvidence } from "./frontend-offline-tests.mjs";
import { attachApiDiagnostics } from "./lib/agent-browser-diagnostics.mjs";
import { sourceInputs } from "./lib/gmx-api-source.mjs";
import { readApiSource } from "./solana-api-local.mjs";
import { control } from "./solana-dev.mjs";
import { API_PREFIX } from "../tools/solana-dev/vite.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export async function runCli() {
  let browser;
  let runDir;
  let diagnostics;
  let stage = "arguments";
  try {
    const { values } = parseArgs({
      options: { "web-port": { type: "string", default: "3010" }, "project-dir": { type: "string", default: ROOT } },
    });
    assert.ok(
      /^\d+$/.test(values["web-port"]) && Number(values["web-port"]) > 0 && Number(values["web-port"]) <= 65535
    );
    const origin = `http://127.0.0.1:${values["web-port"]}`;
    stage = "workspace-identity";
    const workspace = await control("status", values["project-dir"]);
    assert.equal(workspace.status, "ready", "The managed workspace must be ready.");
    assert.equal(workspace.webUrl, origin, "Browser origin must match the managed workspace.");
    assert.ok(workspace.services.vite && workspace.services.api, "Select both Vite and API for this probe.");
    const { projectDir } = workspace;
    const apiDir = workspace.services.api.apiDir;
    const frontendSource = await sourceEvidence(projectDir);
    const apiSource = { ...(await readApiSource(apiDir)).evidence, sourceInputs: await sourceInputs(apiDir) };
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
    const sourceFiles = ["src/config/api.ts", "sdk/src/configs/api.ts"];
    const source = {};
    for (const file of sourceFiles)
      source[file] = createHash("sha256")
        .update(await readFile(path.join(projectDir, file)))
        .digest("hex");
    source["gmx-api/src/solanaApp.ts"] = apiSource.sha256["src/solanaApp.ts"];
    const frontendSourceAfter = await sourceEvidence(projectDir);
    const apiSourceAfter = { ...(await readApiSource(apiDir)).evidence, sourceInputs: await sourceInputs(apiDir) };
    assert.deepEqual(frontendSourceAfter, frontendSource, "Frontend source changed during the browser probe.");
    assert.deepEqual(apiSourceAfter, apiSource, "API source changed during the browser probe.");
    const report = await diagnostics.save(path.join(runDir, "requests.json"), {
      probeResult: "passed",
      requestSource: "explicit-tool-probe",
      businessPageAcceptance: "not-run",
      frontendConsumer: "not-evaluated",
      mode: "sample",
      baseUrl: origin,
      projectDir,
      frontendCommit: frontendSource.commit,
      frontendSource,
      frontendSourceAfter,
      apiDir,
      apiCommit: apiSource.commit,
      apiSource,
      apiSourceAfter,
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
          projectDir,
          frontendSource,
          apiDir,
          apiSource,
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
      `${JSON.stringify({ status: "passed", projectDir, frontendSource, apiDir, apiSource, runDir, failureTraceId: failure.traceId, businessPageAcceptance: "not-run" }, null, 2)}\n`
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
