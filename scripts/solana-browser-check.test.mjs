import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";

import { passedBrowserResults, portAvailable } from "./solana-browser-check.mjs";

test("browser acceptance requires real passing executions, exact scope and no skipped or retried tests", () => {
  const origin = "http://127.0.0.1:3015";
  const entry = { expectedStatus: "passed", status: "expected", results: [{ status: "passed", retry: 0, errors: [] }] };
  const good = {
    config: { metadata: { scope: "solana-local-read-only-network-smoke", target: origin } },
    errors: [],
    stats: { expected: 2, unexpected: 0, skipped: 0, flaky: 0 },
    suites: [{ suites: [{ specs: [{ file: "network.spec.ts", ok: true, tests: [entry, structuredClone(entry)] }] }] }],
  };
  assert.equal(passedBrowserResults(good, origin, { code: 0 }), true);
  const cases = [
    (r) => {
      r.errors.push({ message: "Runner failed" });
    },
    (r) => {
      r.config.metadata.target = "http://127.0.0.1:3010";
    },
    (r) => {
      r.config.metadata.scope = "discovery-only";
    },
    (r) => {
      r.stats.skipped = 1;
    },
    (r) => {
      r.stats.flaky = 1;
    },
    (r) => {
      r.stats.unexpected = 1;
    },
    (r) => {
      r.suites[0].suites[0].specs[0].tests.pop();
    },
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].results = [];
    },
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].results[0].retry = 1;
    },
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].results[0].status = "failed";
    },
    (r) => {
      r.suites[0].suites[0].specs[0].file = "unrelated.spec.ts";
    },
  ];
  for (const mutate of cases) {
    const value = structuredClone(good);
    mutate(value);
    assert.equal(passedBrowserResults(value, origin, { code: 0 }), false);
  }
  assert.equal(passedBrowserResults(good, origin, { code: 1 }), false);
  assert.equal(passedBrowserResults(good, origin, { code: 0, signal: "SIGTERM" }), false);
});

test("occupied ports are rejected without stopping their listener", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await assert.rejects(portAvailable(port));
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await portAvailable(port);
});
