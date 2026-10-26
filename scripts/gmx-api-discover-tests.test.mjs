import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveApiRelated } from "./gmx-api-discover-tests.mjs";

test("API related selection rejects ambiguous paths and symlink traversal", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-related-paths-"));
  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src/module.ts"), "export {};\n");
    await writeFile(path.join(dir, "outside.ts"), "export {};\n");
    await symlink(path.join(dir, "outside.ts"), path.join(dir, "src/external.ts"));
    await symlink(path.join(dir, "src/module.ts"), path.join(dir, "src/internal.ts"));
    const selected = ["src/module.ts"];
    assert.deepEqual(await resolveApiRelated(dir, selected), selected);
    for (const files of [
      undefined,
      [],
      ["src/module.ts", "src/module.ts"],
      ["src/missing.ts"],
      ["src/../outside.ts"],
      [path.join(dir, "src/module.ts")],
      ["src/*.ts"],
      ["src//module.ts"],
      ["src/external.ts"],
      ["src/internal.ts"],
    ])
      await assert.rejects(resolveApiRelated(dir, files));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
