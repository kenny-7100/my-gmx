/* eslint-disable @typescript-eslint/no-require-imports -- Jest loads this setup as CommonJS. */
/* global module */
const assert = require("node:assert/strict");
const dgram = require("node:dgram");
const dns = require("node:dns");
const { appendFileSync } = require("node:fs");
const { syncBuiltinESMExports } = require("node:module");
const net = require("node:net");
const process = require("node:process");
const tls = require("node:tls");

const STATE = Symbol.for("gmx.agent.integrationNetworkGuard");
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);

function installNetworkGuard(databasePort) {
  assert.ok(
    Number.isInteger(databasePort) && databasePort > 0 && databasePort <= 65535,
    "Invalid owned database port."
  );
  let state = net[STATE];
  const eventsFile = process.env.GMX_AGENT_NETWORK_EVENTS_FILE;
  const record = (event) => {
    if (eventsFile) appendFileSync(eventsFile, `${event}\n`);
  };
  record("installed");
  if (state) {
    assert.equal(state.databasePort, databasePort, "Integration database port changed between suites.");
  } else {
    state = { databasePort, attempts: 0, servers: new Set() };
    net[STATE] = state;
    const deny = () => {
      state.attempts++;
      record("blocked");
      throw new Error("Network access is restricted to the owned database and in-process servers.");
    };
    const listen = net.Server.prototype.listen;
    net.Server.prototype.listen = function (...args) {
      state.servers.add(this);
      this.once("close", () => state.servers.delete(this));
      return listen.apply(this, args);
    };
    const connect = net.Socket.prototype.connect;
    net.Socket.prototype.connect = function (...args) {
      const first = Array.isArray(args[0]) ? args[0][0] : args[0];
      const options =
        typeof first === "object" && first !== null
          ? first
          : { port: first, host: typeof args[1] === "string" ? args[1] : "localhost" };
      const port = Number(options.port);
      if (options.path || !LOOPBACK.has(options.host ?? "localhost") || !Number.isInteger(port)) return deny();
      const ownedServer = [...state.servers].some((server) => server.listening && server.address()?.port === port);
      if (port !== state.databasePort && !ownedServer) return deny();
      return connect.apply(this, args);
    };
    for (const module of [dns, dns.promises]) {
      const lookup = module.lookup;
      module.lookup = function (hostname, ...args) {
        if (!LOOPBACK.has(hostname)) return deny();
        return lookup.call(this, hostname, ...args);
      };
      for (const key of Object.keys(module)) {
        if (key === "lookupService" || key.startsWith("resolve") || key === "reverse") module[key] = deny;
      }
      for (const key of Object.getOwnPropertyNames(module.Resolver.prototype)) {
        if (key.startsWith("resolve") || key === "reverse") module.Resolver.prototype[key] = deny;
      }
    }
    dgram.createSocket = deny;
    tls.connect = deny;
    syncBuiltinESMExports();
  }
  const baseline = state.attempts;
  return () => {
    const attempts = state.attempts - baseline;
    if (attempts) throw new Error(`Integration test attempted forbidden network access ${attempts} time(s).`);
  };
}

module.exports = { installNetworkGuard };

if (typeof afterAll === "function") {
  afterAll(installNetworkGuard(Number(process.env.GMX_AGENT_TEST_DATABASE_PORT)));
}
