import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const exec = promisify(execFile);
const RECEIPT = ".agent-build.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function inventory(dir, exclude = []) {
  const files = {};
  const scan = async (relative) => {
    for (const entry of (await readdir(path.join(dir, relative), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, "en")
    )) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (exclude.includes(file)) continue;
      if (entry.isDirectory()) await scan(file);
      else {
        assert.ok(entry.isFile(), `Unsupported non-file input: ${file}`);
        files[file] = hash(await readFile(path.join(dir, file)));
      }
    }
  };
  await scan("");
  return files;
}

async function inputs() {
  const files = {};
  for (const dir of [
    "sdk/src",
    "sdk/scripts",
    "sdk/node_modules/typescript/lib",
    "sdk/node_modules/typescript-transform-paths/dist",
  ]) {
    for (const [file, digest] of Object.entries(await inventory(path.join(ROOT, dir))))
      files[`${dir}/${file}`] = digest;
  }
  for (const file of [
    "sdk/package.json",
    "sdk/tsconfig.json",
    "sdk/tsconfig.cjs.json",
    "sdk/tsconfig.esm.json",
    "sdk/yarn.lock",
    "yarn.lock",
    "viem-override.d.ts",
    "scripts/sdk-artifacts.mjs",
    "sdk/node_modules/typescript/package.json",
    "sdk/node_modules/typescript-transform-paths/package.json",
    "sdk/node_modules/tsx/package.json",
    ".yarnrc.yml",
    "sdk/.yarnrc.yml",
  ])
    files[file] = hash(await readFile(path.join(ROOT, file)));
  return {
    node: process.version,
    sha256: hash(JSON.stringify(Object.entries(files).sort())),
    fileCount: Object.keys(files).length,
  };
}

function requiredFiles(files) {
  for (const version of ["v1", "v2"]) {
    for (const file of [
      `types/src/clients/${version}/index.d.ts`,
      `cjs/src/clients/${version}/index.js`,
      `esm/src/clients/${version}/index.js`,
    ])
      assert.ok(files[file], `Missing SDK entry point: ${file}`);
  }
  for (const format of ["cjs", "esm"])
    assert.ok(files[`${format}/src/package.json`], `Missing ${format} package marker`);
}

export async function verifyArtifacts(buildDir, source) {
  const receipt = JSON.parse(await readFile(path.join(buildDir, RECEIPT), "utf8"));
  assert.equal(receipt.schemaVersion, 1, "Unknown SDK build receipt schema");
  assert.deepEqual(receipt.source, source, "SDK source, configuration or toolchain changed; rebuild required");
  const files = await inventory(buildDir, [RECEIPT]);
  requiredFiles(files);
  assert.deepEqual(files, receipt.artifacts, "SDK build artifacts changed or are incomplete; rebuild required");
  return {
    status: "passed",
    source,
    artifactCount: Object.keys(files).length,
    builtAt: receipt.builtAt,
    runDir: receipt.runDir,
  };
}

export async function promote(staged, target, backup) {
  let moved = false;
  try {
    await rename(target, backup);
    moved = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(staged, target);
  } catch (error) {
    if (moved) await rename(backup, target);
    throw error;
  }
}

async function build() {
  const output = path.join(ROOT, ".local/acceptance/sdk-artifacts");
  await mkdir(output, { recursive: true });
  const lockFile = path.join(output, "build.lock");
  const lock = await open(lockFile, "wx");
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  let runDir;
  try {
    await lock.writeFile(json({ pid: process.pid, startedAt: new Date().toISOString() }));
    runDir = await mkdtemp(path.join(output, "build-"));
    const source = await inputs();
    const staged = path.join(runDir, "build");
    const target = path.join(ROOT, "sdk/build");
    await exec("git", ["check-ignore", "--quiet", "sdk/build/agent-probe"], { cwd: ROOT });
    const run = async (name, args, cwd) => {
      process.stderr.write(`SDK ${name}: ${runDir}/${name}.log\n`);
      try {
        const result = await exec(process.execPath, args, {
          cwd,
          signal: controller.signal,
          timeout: 180000,
          maxBuffer: 16_777_216,
        });
        await writeFile(path.join(runDir, `${name}.log`), `${result.stdout}\n${result.stderr}`);
      } catch (error) {
        await writeFile(
          path.join(runDir, `${name}.log`),
          `${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message}`
        );
        throw error;
      }
    };
    await run(
      "prebuild",
      [
        path.join(ROOT, "sdk/node_modules/tsx/dist/cli.mjs"),
        "--tsconfig",
        path.join(ROOT, "sdk/tsconfig.json"),
        path.join(ROOT, "sdk/scripts/prebuild/index.ts"),
      ],
      runDir
    );
    for (const file of [
      "hashedMarketValuesKeys.json",
      "hashedMarketConfigKeys.json",
      "hashedKinkModelMarketRatesKeys.json",
    ]) {
      assert.deepEqual(
        await readFile(path.join(runDir, "src/codegen/prebuilt", file)),
        await readFile(path.join(ROOT, "sdk/src/codegen/prebuilt", file)),
        `Generated SDK source differs: ${file}; reconcile explicitly before building`
      );
    }
    for (const mode of ["types", "cjs", "esm"]) {
      await run(
        mode,
        [
          path.join(ROOT, "sdk/node_modules/typescript/bin/tsc"),
          "-p",
          mode === "types" ? "tsconfig.json" : `tsconfig.${mode}.json`,
          ...(mode === "types" ? ["--emitDeclarationOnly"] : []),
          "--outDir",
          mode === "types" ? staged : path.join(staged, mode),
          "--declarationDir",
          path.join(staged, "types"),
          "--tsBuildInfoFile",
          path.join(runDir, `${mode}.tsbuildinfo`),
        ],
        path.join(ROOT, "sdk")
      );
    }
    for (const [mode, type] of [
      ["cjs", "commonjs"],
      ["esm", "module"],
    ])
      await writeFile(path.join(staged, mode, "src/package.json"), json({ type }));
    const artifacts = await inventory(staged);
    requiredFiles(artifacts);
    assert.deepEqual(await inputs(), source, "SDK inputs changed during compilation; previous artifacts preserved");
    controller.signal.throwIfAborted();
    const receipt = { schemaVersion: 1, source, artifacts, builtAt: new Date().toISOString(), runDir };
    await writeFile(path.join(staged, RECEIPT), json(receipt));
    await verifyArtifacts(staged, source);
    await promote(staged, target, path.join(runDir, "previous-build"));
    const result = await verifyArtifacts(target, source);
    await writeFile(path.join(runDir, "result.json"), json(result));
    return result;
  } catch (error) {
    if (runDir)
      await writeFile(path.join(runDir, "result.json"), json({ status: "failed", error: error.message, runDir }));
    throw error;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    await lock.close();
    await rm(lockFile);
  }
}

async function runCli() {
  try {
    assert.ok(
      process.argv.length === 3 && ["verify", "build"].includes(process.argv[2]),
      "Usage: yarn sdk:artifacts <verify|build>"
    );
    const result =
      process.argv[2] === "build" ? await build() : await verifyArtifacts(path.join(ROOT, "sdk/build"), await inputs());
    process.stdout.write(json(result));
  } catch (error) {
    process.stdout.write(json({ status: "blocked", error: error.message }));
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
