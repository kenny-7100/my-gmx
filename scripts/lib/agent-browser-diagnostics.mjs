import { writeFile } from "node:fs/promises";

import { safeApiPath } from "./agent-request-path.mjs";

// Capture only the explicit local API namespace. Never record bodies, queries or headers.
export function attachApiDiagnostics(page, baseUrl) {
  const target = new URL(baseUrl);
  const records = [];
  const pending = new Set();
  const captureErrors = [];
  const starts = new WeakMap();
  const selected = (request) => {
    const url = new URL(request.url());
    return (
      url.origin === target.origin &&
      (url.pathname === target.pathname || url.pathname.startsWith(`${target.pathname}/`))
    );
  };
  const request = (req) => {
    if (selected(req)) starts.set(req, performance.now());
  };
  const response = (res) => {
    const req = res.request();
    if (!selected(req)) return;
    const task = (async () => {
      const headers = await res.allHeaders();
      records.push({
        method: req.method(),
        path: safeApiPath(new URL(req.url()).pathname, target.pathname),
        status: res.status(),
        durationMs: Math.round(performance.now() - (starts.get(req) ?? performance.now())),
        durationBasis: "response-headers",
        traceId: headers["x-trace-id"],
        outcome: res.status() >= 400 ? "http-error" : "response",
      });
    })();
    pending.add(task);
    task
      .catch(() => {
        captureErrors.push("response-capture-failed");
      })
      .finally(() => pending.delete(task));
  };
  const failed = (req) => {
    if (selected(req))
      records.push({
        method: req.method(),
        path: safeApiPath(new URL(req.url()).pathname, target.pathname),
        durationMs: Math.round(performance.now() - (starts.get(req) ?? performance.now())),
        outcome: "transport-error",
      });
  };
  page.on("request", request);
  page.on("response", response);
  page.on("requestfailed", failed);
  return {
    records,
    async save(file, metadata = {}) {
      await Promise.allSettled([...pending]);
      const report = {
        ...metadata,
        schemaVersion: 1,
        status: captureErrors.length ? "failed" : "captured",
        checkedAt: new Date().toISOString(),
        scope: "explicit-local-api-requests",
        captureErrors,
        records,
      };
      await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
      return report;
    },
    detach() {
      page.off("request", request);
      page.off("response", response);
      page.off("requestfailed", failed);
    },
  };
}
