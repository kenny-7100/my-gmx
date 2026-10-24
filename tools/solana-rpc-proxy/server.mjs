import { createServer } from "node:http";

import { createProxyHandler } from "./proxy.mjs";

const port = Number(process.env.SOLANA_RPC_PROXY_PORT || 3030);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("SOLANA_RPC_PROXY_PORT must be an integer between 1 and 65535");
}

const server = createServer(createProxyHandler({ key: process.env.SOLANA_RPC_PROXY_KEY }));
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.on("error", (error) => {
  console.error(`Solana RPC proxy failed: ${error.code || "SERVER_ERROR"}`);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Solana RPC proxy listening on http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
