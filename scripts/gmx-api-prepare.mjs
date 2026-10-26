import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import { readApiTestSource } from "./lib/gmx-api-source.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const exec = promisify(execFile);
const ARTIFACTS = ["routes.ts", "routes-v2.ts", "swagger.json", "swagger-v2.json"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function generationTarget(apiDir) {
  const repository = await readApiTestSource(apiDir, []);
  const output = path.join(apiDir, "src/codegen/tsoa");
  for (const [config, routesFileName, specFileBaseName] of [
    ["tsoa.json", "routes.ts", "swagger"],
    ["tsoa-v2.json", "routes-v2.ts", "swagger-v2"],
  ]) {
    const value = JSON.parse(await readFile(path.join(apiDir, config), "utf8"));
    assert.equal(path.resolve(apiDir, value.routes.routesDir), output, "Unexpected route output directory.");
    assert.equal(path.resolve(apiDir, value.spec.outputDirectory), output, "Unexpected spec output directory.");
    assert.equal(value.routes.routesFileName, routesFileName, "Unexpected route output filename.");
    assert.equal(value.spec.specFileBaseName, specFileBaseName, "Unexpected spec output filename.");
  }
  for (const file of [
    "src",
    "src/codegen",
    "src/codegen/tsoa",
    ...ARTIFACTS.map((file) => `src/codegen/tsoa/${file}`),
  ]) {
    try {
      assert.ok(
        !(await lstat(path.join(apiDir, file))).isSymbolicLink(),
        "Generated output must not traverse symlinks."
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const file of ARTIFACTS)
    await exec("git", ["check-ignore", "--quiet", `src/codegen/tsoa/${file}`], {
      cwd: apiDir,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
  return repository;
}

export async function generationTooling(apiDir) {
  const toolSha256 = {};
  for (const file of ["scripts/gmx-api-prepare.mjs", "scripts/lib/gmx-api-source.mjs"])
    toolSha256[file] = hash(await readFile(path.join(ROOT, file)));
  const apiRequire = createRequire(path.join(apiDir, "package.json"));
  const tsoaFile = apiRequire.resolve("tsoa/package.json");
  const cliRequire = createRequire(tsoaFile);
  const cliFile = cliRequire.resolve("@tsoa/cli/package.json");
  const generatorRequire = createRequire(cliFile);
  const packages = {};
  for (const manifest of [
    tsoaFile,
    cliFile,
    generatorRequire.resolve("@tsoa/runtime/package.json"),
    generatorRequire.resolve("typescript/package.json"),
  ]) {
    const directory = await realpath(path.dirname(manifest));
    const pkg = JSON.parse(await readFile(manifest, "utf8"));
    const files = ["package.json"];
    const scan = async (dir) => {
      for (const entry of await readdir(path.join(directory, dir), { withFileTypes: true })) {
        assert.ok(!entry.isSymbolicLink(), "Generator package symlinks require explicit review.");
        const file = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await scan(file);
        else if (entry.isFile()) files.push(file);
      }
    };
    await scan(pkg.name === "typescript" ? "lib" : "dist");
    const digest = createHash("sha256");
    for (const file of files.sort())
      digest
        .update(file)
        .update("\0")
        .update(hash(await readFile(path.join(directory, file))));
    packages[pkg.name] = { directory, version: pkg.version, sha256: digest.digest("hex"), fileCount: files.length };
  }
  return { node: process.version, executable: process.execPath, toolSha256, packages };
}

async function inputs(apiDir) {
  const files = ["package.json", "yarn.lock", "tsconfig.json", "tsoa.json", "tsoa-v2.json"];
  const scan = async (dir) => {
    for (const entry of await readdir(path.join(apiDir, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (file === "src/codegen/tsoa") continue;
      assert.ok(!entry.isSymbolicLink(), "API source symlinks require explicit review.");
      if (entry.isDirectory()) await scan(file);
      else if (entry.isFile() && /\.(ts|tsx|js|json)$/.test(file)) files.push(file);
    }
  };
  await scan("src");
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    digest
      .update(file)
      .update("\0")
      .update(hash(await readFile(path.join(apiDir, file))));
  }
  return { sha256: digest.digest("hex"), fileCount: files.length };
}

async function artifacts(apiDir) {
  const result = {};
  for (const file of ARTIFACTS) {
    const bytes = await readFile(path.join(apiDir, "src/codegen/tsoa", file));
    if (file.endsWith(".json")) {
      const spec = JSON.parse(bytes);
      assert.ok(spec.openapi.startsWith("3.") && Object.keys(spec.paths).length > 0);
    } else {
      assert.ok(bytes.toString("utf8").includes("export function RegisterRoutes"));
    }
    result[file] = hash(bytes);
  }
  return result;
}

export async function prepareApi(apiPath, verify = false) {
  assert.equal(process.versions.node.split(".")[0], "22");
  const apiDir = await realpath(apiPath);
  const repository = await generationTarget(apiDir);
  const outputRoot = path.join(ROOT, ".local/acceptance/solana-api-local");
  const manifestFile = path.join(outputRoot, `prepared-${hash(apiDir).slice(0, 16)}.json`);
  const source = await inputs(apiDir);
  const tooling = await generationTooling(apiDir);
  if (verify) {
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    assert.equal(manifest.apiDir, apiDir);
    const current = await artifacts(apiDir);
    const matches =
      manifest.schemaVersion === 2 &&
      manifest.source.sha256 === source.sha256 &&
      JSON.stringify(manifest.artifacts) === JSON.stringify(current) &&
      JSON.stringify(manifest.tooling) === JSON.stringify(tooling);
    return {
      schemaVersion: 2,
      status: matches ? "passed" : "blocked",
      mode: "local-generated-routes",
      checkedAt: new Date().toISOString(),
      apiDir,
      source,
      repository,
      generatedRepository: manifest.repository,
      tooling,
      artifacts: current,
      manifestFile,
      code: matches ? "generated-routes-current" : "regeneration-required",
    };
  }
  await mkdir(outputRoot, { recursive: true });
  const runDir = await mkdtemp(path.join(outputRoot, "prepare-"));
  const logFile = path.join(runDir, "tsoa.log");
  const logs = [];
  try {
    for (const config of ["tsoa.json", "tsoa-v2.json"]) {
      try {
        const result = await exec(
          process.execPath,
          [path.join(apiDir, "node_modules/tsoa/dist/cli.js"), "spec-and-routes", "--configuration", config],
          {
            cwd: apiDir,
            env: { PATH: process.env.PATH, TZ: "UTC" },
            timeout: 120000,
            maxBuffer: 4_194_304,
          }
        );
        logs.push(`${config}\n${result.stdout}\n${result.stderr}`);
      } catch (error) {
        logs.push(`${config}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
        throw error;
      }
    }
    assert.deepEqual(await inputs(apiDir), source, "Generation inputs changed.");
    assert.deepEqual(await generationTooling(apiDir), tooling, "Generation tooling changed.");
    await generationTarget(apiDir);
    const generated = await artifacts(apiDir);
    const report = {
      schemaVersion: 2,
      status: "passed",
      mode: "local-generated-routes",
      checkedAt: new Date().toISOString(),
      apiDir,
      source,
      repository,
      tooling,
      artifacts: generated,
      logFile,
      manifestFile,
      runtimeVerification: "not-run",
    };
    await writeFile(manifestFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    await writeFile(path.join(runDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    return report;
  } catch {
    throw Object.assign(new Error("API generation failed."), { logFile });
  } finally {
    await writeFile(logFile, `${logs.join("\n")}\n`, { mode: 0o600 });
  }
}

export async function runCli(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args,
      options: {
        "api-dir": { type: "string", default: path.join(ROOT, "gmx-api") },
        verify: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      process.stdout.write(
        "Usage: yarn gmx-api:prepare [--api-dir PATH] [--verify]\nGenerates the existing v1/v2 TSOA routes and specs. Verify only checks recorded inputs and artifacts. Exit: 0 current, 2 stale, 1 missing/failed. No service or database startup.\n"
      );
      return 0;
    }
    const report = await prepareApi(path.resolve(values["api-dir"]), values.verify);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "passed" ? 0 : 2;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: "api-generation-not-ready", logFile: error?.logFile, message: "Check Node 22, API source, installed TSOA dependencies and generation log. Run gmx-api:prepare after source or artifact changes." })}\n`
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
