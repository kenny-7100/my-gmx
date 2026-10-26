import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generationTarget } from "./gmx-api-prepare.mjs";

test("API generation requires its Git root, fixed ignored outputs and no output symlinks", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-route-target-"));
  const git = (...args) => execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" });
  const ignore = path.join(dir, ".gitignore");
  const output = path.join(dir, "src/codegen/tsoa");
  const config = (version) => ({
    routes: { routesDir: "./src/codegen/tsoa", routesFileName: version === 1 ? "routes.ts" : "routes-v2.ts" },
    spec: { outputDirectory: "./src/codegen/tsoa", specFileBaseName: version === 1 ? "swagger" : "swagger-v2" },
  });
  try {
    await mkdir(output, { recursive: true });
    for (const file of ["package.json", "tsconfig.json"]) await writeFile(path.join(dir, file), "{}");
    await writeFile(path.join(dir, "yarn.lock"), "");
    await writeFile(ignore, "src/codegen/tsoa/\n");
    for (const version of [1, 2])
      await writeFile(path.join(dir, version === 1 ? "tsoa.json" : "tsoa-v2.json"), JSON.stringify(config(version)));
    git("init", "--quiet");
    git("add", ".");
    git(
      "-c",
      "user.name=Agent Test",
      "-c",
      "user.email=agent@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "Create fixture"
    );
    await generationTarget(dir);
    await assert.rejects(generationTarget(path.join(dir, "src")), /checkout root/);
    for (const changed of [
      { ...config(1), routes: { ...config(1).routes, routesDir: "src/routes" } },
      { ...config(1), spec: { ...config(1).spec, outputDirectory: "src/routes" } },
      { ...config(1), routes: { ...config(1).routes, routesFileName: "other.ts" } },
      { ...config(1), spec: { ...config(1).spec, specFileBaseName: "other" } },
    ]) {
      await writeFile(path.join(dir, "tsoa.json"), JSON.stringify(changed));
      await assert.rejects(generationTarget(dir), /Unexpected/);
    }
    await writeFile(path.join(dir, "tsoa.json"), JSON.stringify(config(1)));
    await writeFile(ignore, "");
    await assert.rejects(generationTarget(dir));
    await writeFile(ignore, "src/codegen/tsoa/\n");
    const route = path.join(output, "routes.ts");
    await symlink(path.join(dir, "package.json"), route);
    await assert.rejects(generationTarget(dir), /symlinks/);
    await rm(route);
    await writeFile(route, "fixture");
    git("add", "--force", "src/codegen/tsoa/routes.ts");
    await assert.rejects(generationTarget(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
