import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../../src/config/solanaRpc.json", import.meta.url), "utf8"));
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_BATCH_SIZE = 100;
const TIMEOUT_MS = 20_000;
const METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlock",
  "getBlockHeight",
  "getBlockTime",
  "getEpochInfo",
  "getFeeForMessage",
  "getGenesisHash",
  "getHealth",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getRecentPrioritizationFees",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTokenSupply",
  "getTransaction",
  "getVersion",
  "isBlockhashValid",
  "simulateTransaction",
]);

function isLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.origin === origin
    );
  } catch {
    return false;
  }
}

export function createProxyHandler({ fetchImpl = fetch, key = config.fallbackKey } = {}) {
  if (!key) throw new Error("A Solana RPC key is required");

  return async (req, res) => {
    const respond = (status, message) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    };
    const origin = req.headers.origin;
    if (origin && !isLocalOrigin(origin)) return respond(403, "Only loopback browser origins are allowed");
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", upstream: "unchecked" }));
    }
    if (req.url !== "/") return respond(404, "Route not found");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }
    if (req.method !== "POST") return respond(405, "Use POST for JSON-RPC requests");

    let body;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) return respond(413, "Request body exceeds 1 MiB");
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString("utf8");
      const payload = JSON.parse(body);
      const batch = Array.isArray(payload) ? payload : [payload];
      if (!batch.length || batch.length > MAX_BATCH_SIZE) return respond(400, "Invalid batch size");
      for (const item of batch) {
        if (!item || item.jsonrpc !== "2.0" || typeof item.method !== "string") {
          return respond(400, "Invalid JSON-RPC request");
        }
        if (!METHODS.has(item.method)) return respond(403, "RPC method is not allowed");
      }
    } catch {
      return respond(400, "Unable to read a valid JSON-RPC body");
    }

    try {
      const upstream = await fetchImpl(`${config.upstreamHost}/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: config.upstreamOrigin },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "error",
      });
      // Keep the body as text so large integer values and JSON-RPC errors stay unchanged.
      const responseBody = await upstream.text();
      res.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      });
      res.end(responseBody.replaceAll(key, "[REDACTED]"));
    } catch (error) {
      const timedOut = error?.name === "TimeoutError";
      respond(timedOut ? 504 : 502, timedOut ? "Solana RPC upstream timed out" : "Solana RPC upstream request failed");
    }
  };
}
