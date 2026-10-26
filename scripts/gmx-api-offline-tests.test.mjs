import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("offline guard blocks Node network transports and records swallowed attempts", () => {
  const guard = fileURLToPath(new URL("../tools/gmx-api-offline/network-guard.cjs", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `
      const assert = require('node:assert/strict');
      const verify = require(process.argv[1]).installNetworkGuard();
      const attempts = [
        () => new (require('node:net').Socket)().connect(9, '127.0.0.1'),
        () => require('node:tls').connect(9, '127.0.0.1'),
        () => require('node:http').get('http://127.0.0.1:9'),
        () => require('node:https').request('https://127.0.0.1:9'),
        () => require('node:http2').connect('http://127.0.0.1:9'),
        () => require('node:dgram').createSocket('udp4'),
        () => require('node:dns').lookup('example.invalid'),
        () => require('node:dns').promises.resolve4('example.invalid'),
        () => fetch('http://127.0.0.1:9'),
      ];
      verify();
      for (const attempt of attempts) assert.throws(attempt, /Network access is forbidden/);
      assert.throws(verify, /attempted network access 9 time/);
      `,
      guard,
    ],
    { encoding: "utf8", timeout: 5000 }
  );
  assert.equal(result.status, 0, result.stderr);
});
