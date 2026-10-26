import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { typecheckInputs } from "./gmx-api-tscheck.mjs";

test("API typecheck fingerprints include compiler inputs outside src and reject source symlinks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "api-tscheck-"));
  try {
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src/index.ts"), "export {};\n");
    const before = await typecheckInputs(root);
    for (const file of [
      "scripts/check.ts",
      "migrations/001.sql",
      "tsconfig.base.json",
      "knexfile.ts",
      "src/ignored.ts",
    ]) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), "changed\n");
      assert.notDeepEqual(await typecheckInputs(root), before, file);
      await rm(path.join(root, file));
      assert.deepEqual(await typecheckInputs(root), before);
    }
    await symlink(path.join(root, "src/index.ts"), path.join(root, "src/linked.ts"));
    await assert.rejects(typecheckInputs(root), /Unsupported non-file input/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
