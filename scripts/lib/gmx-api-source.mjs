import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function sourceInputs(apiDir) {
  const files = ["package.json", "yarn.lock", "tsconfig.json"];
  const scan = async (dir) => {
    for (const entry of await readdir(path.join(apiDir, dir), { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "API source symlinks require explicit review.");
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await scan(file);
      else if (/\.(ts|js|json)$/.test(file)) files.push(file);
    }
  };
  await scan("src");
  const digest = createHash("sha256");
  for (const file of files.sort())
    digest
      .update(file)
      .update("\0")
      .update(
        createHash("sha256")
          .update(await readFile(path.join(apiDir, file)))
          .digest()
      );
  return { sha256: digest.digest("hex"), fileCount: files.length };
}
