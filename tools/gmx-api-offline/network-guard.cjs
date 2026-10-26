/* eslint-disable @typescript-eslint/no-require-imports -- Jest loads this setup as CommonJS. */
const dgram = require("node:dgram");
const dns = require("node:dns");
const http = require("node:http");
const http2 = require("node:http2");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");

function installNetworkGuard() {
  let attempts = 0;
  const deny = () => {
    attempts++;
    throw new Error("Network access is forbidden in the gmx-api offline test profile.");
  };
  net.Socket.prototype.connect = deny;
  tls.connect = deny;
  for (const module of [http, https]) {
    module.request = deny;
    module.get = deny;
  }
  http2.connect = deny;
  dgram.createSocket = deny;
  for (const module of [dns, dns.promises]) {
    for (const key of Object.keys(module)) {
      if (key === "lookup" || key === "lookupService" || key.startsWith("resolve") || key === "reverse") {
        module[key] = deny;
      }
    }
  }
  globalThis.fetch = deny;
  return () => {
    if (attempts) throw new Error(`Offline test attempted network access ${attempts} time(s).`);
  };
}

module.exports = { installNetworkGuard };

if (typeof afterAll === "function") {
  afterAll(installNetworkGuard());
}
