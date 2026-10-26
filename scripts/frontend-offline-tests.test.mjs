import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveSuites } from "./frontend-offline-tests.mjs";

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
