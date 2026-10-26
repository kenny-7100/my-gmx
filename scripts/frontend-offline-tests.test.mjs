import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveSuites, runFrontendOffline } from "./frontend-offline-tests.mjs";

test("frontend selection accepts only unique existing tests inside src or landing", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-frontend-selection-"));
  try {
    for (const folder of ["src", "landing", "sdk"]) await mkdir(path.join(dir, folder));
    for (const file of ["src/a.spec.ts", "landing/b.test.jsx", "sdk/c.spec.ts", "outside.spec.ts"])
      await writeFile(path.join(dir, file), "");
    await symlink(path.join(dir, "outside.spec.ts"), path.join(dir, "src/escape.spec.ts"));
    assert.deepEqual(await resolveSuites(dir, ["src/a.spec.ts", "landing/b.test.jsx"]), [
      "src/a.spec.ts",
      "landing/b.test.jsx",
    ]);
    for (const suites of [
      [],
      ["src/missing.spec.ts"],
      ["src/a.spec.ts", "src/a.spec.ts"],
      ["src/escape.spec.ts"],
      ["sdk/c.spec.ts"],
      ["src/../outside.spec.ts"],
      ["src/*.spec.ts"],
      ["/src/a.spec.ts"],
    ])
      await assert.rejects(resolveSuites(dir, suites));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontend debugging rejects invalid ports, multiple suites and occupied ports without taking ownership", async () => {
  const suites = ["src/lib/pwa/appUpdateDecision.spec.ts"];
  for (const inspectPort of [0, -1, 65536, 1.5, NaN])
    await assert.rejects(runFrontendOffline({ suites, inspectPort }), /inspector port/);
  await assert.rejects(runFrontendOffline({ inspectPort: 9240 }), /exactly one frontend suite/);
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(runFrontendOffline({ suites, inspectPort: server.address().port }), { code: "EADDRINUSE" });
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
