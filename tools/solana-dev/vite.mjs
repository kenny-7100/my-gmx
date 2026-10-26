import { randomUUID } from "node:crypto";
import { createServer } from "vite";

import { safeApiPath } from "../../scripts/lib/agent-request-path.mjs";

export const API_PREFIX = "/__agent/solana-api";

// This config is loaded only by the personal development workspace, never by builds.
export async function startVite({ root, webPort, apiPort, rpcPort, record }) {
  const server = await createServer({
    root,
    configFile: `${root}/vite.config.ts`,
    define: rpcPort ? { "import.meta.env.VITE_APP_SOLANA_RPC_URL": JSON.stringify(`http://127.0.0.1:${rpcPort}`) } : {},
    server: {
      host: "127.0.0.1",
      port: webPort,
      strictPort: true,
      open: false,
      proxy: {
        [`^${API_PREFIX}(?:/|$)`]: {
          target: `http://127.0.0.1:${apiPort}`,
          rewrite: (url) => url.slice(API_PREFIX.length) || "/",
          configure(proxy) {
            proxy.on("proxyReq", (outgoing, req) => {
              const provided = req.headers["x-trace-id"];
              const traceId =
                typeof provided === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(provided) ? provided : randomUUID();
              req.agentTrace = { traceId, started: performance.now() };
              outgoing.setHeader("X-Trace-Id", traceId);
            });
            const finish = (req, status, responseTraceId, transportError = false) => {
              const trace = req.agentTrace ?? { traceId: randomUUID(), started: performance.now() };
              record({
                checkedAt: new Date().toISOString(),
                traceId: trace.traceId,
                responseTraceId,
                method: req.method,
                path: safeApiPath(req.url ?? "/"),
                status,
                durationMs: Math.round(performance.now() - trace.started),
                durationBasis: transportError ? "transport-failure" : "response-headers",
                transportError,
              });
            };
            proxy.on("proxyRes", (res, req) => finish(req, res.statusCode, res.headers["x-trace-id"]));
            proxy.on("error", (_error, req, res) => {
              finish(req, 502, undefined, true);
              if (res && !res.headersSent && typeof res.writeHead === "function") {
                res.writeHead(502, {
                  "Content-Type": "application/json",
                  "X-Trace-Id": req.agentTrace?.traceId ?? "unavailable",
                });
                res.end(JSON.stringify({ error: "Local Solana API is unavailable." }));
              }
            });
          },
        },
      },
    },
    plugins: [
      {
        name: "agent-local-read-only-proxy",
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            const path = (req.url ?? "").split("?")[0];
            if (path === "/__agent/probe" && req.method === "GET") {
              res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
              res.end("<!doctype html><title>Agent local API probe</title>");
              return;
            }
            if (
              (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) &&
              !["GET", "OPTIONS"].includes(req.method)
            ) {
              res.writeHead(405, { Allow: "GET, OPTIONS", "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "The local API development proxy permits only reads." }));
            } else next();
          });
        },
      },
    ],
  });
  try {
    await server.listen();
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
}
