import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import net from "node:net";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);

test("integration networking allows owned database and servers while rejecting unrelated transports", async () => {
  let unrelatedConnections = 0;
  const database = net.createServer((socket) => socket.end());
  const unrelated = net.createServer((socket) => {
    unrelatedConnections++;
    socket.destroy();
  });
  for (const server of [database, unrelated]) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { stdout } = await exec(
      process.execPath,
      [
        "-e",
        `
        const assert = require('node:assert/strict');
        const net = require('node:net'), http = require('node:http');
        const install = require(process.argv[1]).installNetworkGuard;
        (async () => {
          const verify = install(Number(process.argv[2]));
          await new Promise((resolve, reject) => net.connect(Number(process.argv[2]), 'localhost').on('end', resolve).on('error', reject).resume());
          const server = http.createServer((req, res) => res.end('owned'));
          server.listen(0);
          const url = 'http://127.0.0.1:' + server.address().port;
          const get = () => new Promise((resolve, reject) => http.get(url, response => { let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => resolve(body)); }).on('error', reject));
          assert.equal(await get(), 'owned');
          install(Number(process.argv[2]))();
          assert.equal(await get(), 'owned');
          verify();
          await new Promise(resolve => server.close(resolve));
          const attempts = [
            () => net.connect(Number(process.argv[3]), '127.0.0.1'),
            () => net.connect(80, 'example.invalid'),
            () => net.connect('/tmp/agent-unowned.sock'),
            () => require('node:tls').connect(443, '127.0.0.1'),
            () => require('node:dgram').createSocket('udp4'),
            () => require('node:dns').lookup('example.invalid'),
            () => require('node:dns').promises.resolve4('example.invalid'),
            () => new (require('node:dns').Resolver)().resolve4('example.invalid', () => {}),
            () => new (require('node:dns').promises.Resolver)().resolve4('example.invalid'),
          ];
          for (const attempt of attempts) assert.throws(attempt, /Network access is restricted/);
          await assert.rejects(fetch('http://127.0.0.1:' + process.argv[3]));
          assert.throws(verify, /forbidden network access/);
          console.log('passed');
        })().catch(error => { console.error(error); process.exitCode = 1; });
        `,
        fileURLToPath(new URL("../tools/gmx-api-integration/network-guard.cjs", import.meta.url)),
        String(database.address().port),
        String(unrelated.address().port),
      ],
      { timeout: 10000 }
    );
    assert.equal(stdout.trim(), "passed");
    assert.equal(unrelatedConnections, 0);
  } finally {
    for (const server of [database, unrelated]) await new Promise((resolve) => server.close(resolve));
  }
});
