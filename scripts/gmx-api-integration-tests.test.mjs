import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveSuites, runIntegrationTests } from "./gmx-api-integration-tests.mjs";

test("test selection preserves exact files and rejects invalid, duplicate or escaping paths", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "gmx-api-suite-selection-"));
  const api = path.join(temp, "api");
  try {
    await mkdir(path.join(api, "src"), { recursive: true });
    await writeFile(path.join(api, "src/one.test.ts"), "");
    await writeFile(path.join(api, "src/two.test.ts"), "");
    await writeFile(path.join(temp, "outside.test.ts"), "");
    await symlink(path.join(temp, "outside.test.ts"), path.join(api, "src/escape.test.ts"));
    await mkdir(path.join(api, "src/folder.test.ts"));
    assert.deepEqual(await resolveSuites(api, ["src/two.test.ts", "./src/one.test.ts"]), [
      "src/two.test.ts",
      "src/one.test.ts",
    ]);
    for (const selection of [
      [],
      [path.join(api, "src/one.test.ts")],
      ["../outside.test.ts"],
      ["src/escape.test.ts"],
      ["src/missing.test.ts"],
      ["src/folder.test.ts"],
      ["src/*.test.ts"],
      ["src/one.test.ts", "./src/one.test.ts"],
    ]) {
      await assert.rejects(resolveSuites(api, selection));
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("integration debugging rejects invalid selections and occupied ports before database preparation", async () => {
  const api = await mkdtemp(path.join(tmpdir(), "gmx-api-integration-debug-"));
  const server = net.createServer();
  const suites = ["src/one.test.ts", "src/two.test.ts"];
  try {
    await mkdir(path.join(api, "src"));
    for (const file of suites) await writeFile(path.join(api, file), "");
    for (const inspectPort of [0, -1, 65536, 1.5, NaN])
      await assert.rejects(runIntegrationTests(api, [suites[0]], { inspectPort }), /inspector port/);
    await assert.rejects(runIntegrationTests(api, suites, { inspectPort: 9241 }), /exactly one API integration suite/);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    await assert.rejects(runIntegrationTests(api, [suites[0]], { inspectPort: server.address().port }), {
      code: "EADDRINUSE",
    });
    assert.equal(server.listening, true);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await rm(api, { recursive: true, force: true });
  }
});
