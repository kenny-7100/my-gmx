import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveSuites } from "./gmx-api-integration-tests.mjs";

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
