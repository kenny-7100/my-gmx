const KNOWN_PATHS = new Set([
  "/ping",
  "/v1/markets/config",
  "/v1/markets/values",
  "/v1/positions",
  "/v1/orders",
  "/v1/fee-discount",
]);

export function safeApiPath(value, prefix = "") {
  const pathname = value.split("?")[0];
  const route = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return `${prefix}${KNOWN_PATHS.has(route) ? route : "/<unmatched>"}`;
}
