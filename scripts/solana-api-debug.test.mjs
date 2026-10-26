import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { InspectorClient } from "./lib/agent-inspector.mjs";
import { handlerLine, mapSource } from "./solana-api-debug.mjs";

test("source mapping rejects another checkout, stale contents, missing maps and changed handlers", () => {
  const file = "/checkout/src/solanaApp.ts";
  const source = 'router.get("/positions", (req, res) => {\nrequireSolanaAddress(req.query.address);\n});';
  const script = {
    url: pathToFileURL(file).href,
    sourceMapURL: `data:application/json;base64,${Buffer.from(
      JSON.stringify({
        version: 3,
        sources: [file],
        sourcesContent: [source],
        names: [],
        mappings: "AAAA",
      })
    ).toString("base64")}`,
  };
  assert.equal(mapSource(script, file, source).findEntry(0, 0).originalLine, 0);
  assert.equal(handlerLine(source), 1);
  for (const run of [
    () => mapSource(script, "/another-checkout/src/solanaApp.ts", source),
    () => mapSource(script, file, `${source}\n// changed`),
    () => mapSource({ ...script, sourceMapURL: "" }, file, source),
    () => handlerLine(source.replace("/positions", "/orders")),
    () => handlerLine(source.replace("requireSolanaAddress", "otherValidation")),
  ])
    assert.throws(run);
});

test(
  "real Node inspector handles pause before reply, resume, protocol errors, timeout and disconnect",
  { timeout: 15000 },
  async () => {
    const child = spawn(process.execPath, ["--inspect=127.0.0.1:0", "-e", "setInterval(() => {}, 1000)"], {
      env: { PATH: process.env.PATH },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const exited = once(child, "exit");
    let client;
    try {
      const url = await new Promise((resolve, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error("Fixture inspector startup timed out.")), 3000);
        child.stderr.on("data", (chunk) => {
          output += chunk;
          const match = output.match(/ws:\/\/127\.0\.0\.1:\d+\/[a-z0-9-]+/);
          if (match) {
            clearTimeout(timer);
            resolve(match[0]);
          }
        });
      });
      client = new InspectorClient(url, 1000);
      await client.connect();
      await client.send("Debugger.enable");
      const event = client.waitFor("Debugger.paused");
      const evaluation = client.send("Runtime.evaluate", { expression: "debugger; 42", returnByValue: true });
      assert.ok((await event.promise).callFrames.length > 0);
      assert.equal(client.paused, true);
      await client.send("Debugger.resume");
      assert.equal((await evaluation).result.value, 42);
      await assert.rejects(client.send("Debugger.nonexistentCommand"));
      await assert.rejects(client.waitFor("Debugger.paused").promise, /timed out/);
      assert.equal(client.listenerCount("Debugger.paused"), 0);
      await client.close();
      assert.throws(() => client.send("Runtime.enable"), /not connected/);
    } finally {
      if (client) await client.close();
      child.kill("SIGTERM");
      await exited;
    }
  }
);
