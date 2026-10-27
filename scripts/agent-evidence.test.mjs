import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, symlink, truncate, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { checkWorksheet } from "./agent-acceptance.mjs";
import { packEvidence, verifyEvidence, runCli } from "./agent-evidence.mjs";

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-evidence-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "input.json");
  await writeFile(
    file,
    JSON.stringify({
      scope: "transaction-receipt",
      status: "passed",
      checkedAt: "2026-10-24T18:03:04.816Z",
      exact: "18446744073709551615",
    })
  );
  return { dir, file, outDir: path.join(dir, "package"), issue: "FESOL-55", reports: [{ name: "receipt", file }] };
}

test("preserves original bytes and every status when copied away from input files", async (t) => {
  const f = await fixture(t);
  const reports = [];
  for (const status of ["passed", "failed", "blocked", "not-run", "partial"]) {
    const file = path.join(f.dir, `${status}.json`);
    await writeFile(
      file,
      ` {"scope":"transaction-receipt","status":"${status}","checkedAt":"2026-10-24T18:03:04.816Z","amount":"18446744073709551615"}\n`
    );
    reports.push({ name: status, file });
  }
  const result = await packEvidence({ ...f, reports });
  assert.equal(result.requirementAcceptance, "not-evaluated");
  for (const input of reports) {
    assert.deepEqual(await readFile(input.file), await readFile(path.join(f.outDir, `${input.name}.json`)));
    assert.equal(result.reports.find((r) => r.name === input.name).status, input.name);
    await unlink(input.file);
  }
  const copy = path.join(f.dir, "copy");
  await cp(f.outDir, copy, { recursive: true });
  assert.deepEqual(await verifyEvidence({ dir: copy }), result);
  await assert.rejects(packEvidence({ ...f, reports: [{ name: "receipt", file: f.file }] }));
});

test("rejects malformed input before creating a package and never logs file contents", async (t) => {
  const f = await fixture(t);
  for (const report of [
    "secret-content",
    "{}",
    '{"scope":"unknown","status":"passed","checkedAt":"2026-10-24T00:00:00Z"}',
    '{"scope":"transaction-receipt","status":"green","checkedAt":"invalid"}',
  ]) {
    await writeFile(f.file, report);
    let output = "";
    assert.equal(
      await runCli({
        args: ["pack", "--issue", f.issue, "--report", `receipt=${f.file}`, "--out", f.outDir],
        stderr: {
          write: (s) => {
            output += s;
          },
        },
      }),
      1
    );
    assert.ok(!output.includes("secret-content"));
    await assert.rejects(readFile(path.join(f.outDir, "manifest.json")));
  }
  for (const changes of [
    { issue: "../escape" },
    { reports: [] },
    { reports: [{ name: "manifest", file: f.file }] },
    { reports: [{ name: "../escape", file: f.file }] },
    { reports: [...f.reports, ...f.reports] },
    { reports: [{ name: "env", file: path.join(f.dir, ".env.local") }] },
  ])
    await assert.rejects(packEvidence({ ...f, ...changes }));
});

test("rejects tampered bytes, conflicting manifests, missing and extra files and symlinks", async (t) => {
  const f = await fixture(t);
  await packEvidence(f);
  const mutations = [
    async (dir) => writeFile(path.join(dir, "receipt.json"), "{}"),
    async (dir) => unlink(path.join(dir, "receipt.json")),
    async (dir) => writeFile(path.join(dir, "extra.json"), "{}"),
    async (dir) => {
      await unlink(path.join(dir, "receipt.json"));
      await symlink(f.file, path.join(dir, "receipt.json"));
    },
  ];
  for (const change of [
    (m) => {
      m.reports[0].status = "failed";
    },
    (m) => {
      m.reports[0].file = "../input.json";
    },
    (m) => {
      m.reports.push(m.reports[0]);
    },
    (m) => {
      m.requirementAcceptance = "passed";
    },
    (m) => {
      m.schemaVersion = 2;
    },
  ])
    mutations.push(async (dir) => {
      const file = path.join(dir, "manifest.json");
      const manifest = JSON.parse(await readFile(file));
      change(manifest);
      await writeFile(file, JSON.stringify(manifest));
    });
  for (let i = 0; i < mutations.length; i++) {
    const dir = path.join(f.dir, `mutated-${i}`);
    await cp(f.outDir, dir, { recursive: true });
    await mutations[i](dir);
    await assert.rejects(verifyEvidence({ dir }));
  }
  const inputLink = path.join(f.dir, "linked-input.json");
  await symlink(f.file, inputLink);
  await assert.rejects(
    packEvidence({ ...f, outDir: path.join(f.dir, "linked-output"), reports: [{ name: "receipt", file: inputLink }] })
  );
  const link = path.join(f.dir, "link");
  await symlink(f.outDir, link);
  await assert.rejects(verifyEvidence({ dir: link }));
});

async function worksheetFixture(t) {
  const f = await fixture(t);
  const bytes = await readFile(new URL("../docs/acceptance/FESOL-55.md", import.meta.url));
  const worksheet = path.join(f.dir, "acceptance.md");
  await writeFile(worksheet, bytes);
  const report = {
    ...checkWorksheet(bytes.toString("utf8")),
    checkedAt: "2026-10-24T22:08:04.000Z",
    worksheetSha256: createHash("sha256").update(bytes).digest("hex"),
    checkerSha256: createHash("sha256")
      .update(await readFile(new URL("./agent-acceptance.mjs", import.meta.url)))
      .digest("hex"),
  };
  await writeFile(f.file, JSON.stringify(report));
  return { ...f, worksheet, report, bytes };
}

test("transfers the exact worksheet and bound report without upgrading partial acceptance", async (t) => {
  const f = await worksheetFixture(t);
  const result = await packEvidence(f);
  assert.equal(result.worksheet.requirementAcceptance, "partial");
  assert.equal(result.requirementAcceptance, "not-evaluated");
  assert.deepEqual(await readFile(path.join(f.outDir, "worksheet.md")), f.bytes);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.outDir, "receipt.json"))), f.report);
  const copy = path.join(f.dir, "transferred");
  await cp(f.outDir, copy, { recursive: true });
  await unlink(f.worksheet);
  await unlink(f.file);
  assert.deepEqual(await verifyEvidence({ dir: copy }), result);
});

test("rejects missing or mismatched worksheet bindings before creating output", async (t) => {
  const f = await worksheetFixture(t);
  await assert.rejects(packEvidence({ ...f, worksheet: undefined }));
  await assert.rejects(packEvidence({ ...f, reports: [...f.reports, { name: "duplicate", file: f.file }] }));
  for (const changes of [
    { worksheetSha256: "0".repeat(64) },
    { requirementAcceptance: "passed" },
    { counts: { passed: 8 } },
    { evidenceSufficiency: "passed" },
    { checkerSha256: "unknown" },
    { scope: "transaction-receipt" },
  ]) {
    await writeFile(f.file, JSON.stringify({ ...f.report, ...changes }));
    await assert.rejects(packEvidence(f));
  }
  await assert.rejects(readFile(path.join(f.outDir, "manifest.json")));
  await writeFile(f.file, JSON.stringify(f.report));
  await packEvidence(f);
  await writeFile(path.join(f.outDir, "worksheet.md"), `${f.bytes.toString("utf8")}Extra text`);
  await assert.rejects(verifyEvidence({ dir: f.outDir }));
});

test("pins both package formats and rejects internally valid replacements", async (t) => {
  for (const makeFixture of [fixture, worksheetFixture]) {
    const f = await makeFixture(t);
    const packed = await packEvidence(f);
    const expectedManifestSha256 = packed.manifestSha256;
    assert.equal(packed.manifestIdentity, "not-checked");
    const matched = await verifyEvidence({ dir: f.outDir, expectedManifestSha256 });
    assert.deepEqual(matched, { ...packed, manifestIdentity: "matched" });
    const file = path.join(f.outDir, "manifest.json");
    const manifest = JSON.parse(await readFile(file));
    manifest.issue = "FESOL-71";
    await writeFile(file, JSON.stringify(manifest));
    assert.equal((await verifyEvidence({ dir: f.outDir })).manifestIdentity, "not-checked");
    await assert.rejects(verifyEvidence({ dir: f.outDir, expectedManifestSha256 }));
  }
});

test("transfers opaque artifacts with or without a worksheet and rejects damaged copies", async (t) => {
  for (const makeFixture of [fixture, worksheetFixture]) {
    const f = await makeFixture(t);
    const artifacts = [];
    for (const extension of ["json", "log", "txt", "png", "zip"]) {
      const file = path.join(f.dir, `source.${extension}`);
      await writeFile(file, Buffer.from([0, 10, 255, 42]));
      artifacts.push({ name: extension, file });
    }
    const result = await packEvidence({ ...f, artifacts });
    const manifest = JSON.parse(await readFile(path.join(f.outDir, "manifest.json")));
    assert.equal(manifest.schemaVersion, 3);
    assert.equal(result.artifactSemantics, "not-evaluated");
    assert.equal(result.requirementAcceptance, "not-evaluated");
    if (f.worksheet) assert.equal(result.worksheet.requirementAcceptance, "partial");
    const copy = path.join(f.dir, "received");
    await cp(f.outDir, copy, { recursive: true });
    for (const artifact of artifacts) {
      assert.deepEqual(
        await readFile(artifact.file),
        await readFile(path.join(copy, `artifact-${artifact.name}.${artifact.name}`))
      );
      await unlink(artifact.file);
    }
    await unlink(f.file);
    if (f.worksheet) await unlink(f.worksheet);
    const verify = () => verifyEvidence({ dir: copy, expectedManifestSha256: result.manifestSha256 });
    assert.deepEqual(await verify(), { ...result, manifestIdentity: "matched" });
    const file = path.join(copy, "artifact-log.log");
    const bytes = await readFile(file);
    await writeFile(file, "changed");
    await assert.rejects(verify);
    await unlink(file);
    await assert.rejects(verify);
    await symlink(path.join(copy, "artifact-txt.txt"), file);
    await assert.rejects(verify);
    await unlink(file);
    await writeFile(file, bytes);
    for (const mutate of [
      (m) => {
        m.artifacts[0].file = "../source.json";
      },
      (m) => {
        m.artifacts.push(m.artifacts[0]);
      },
      (m) => {
        m.artifacts[0].sha256 = "0".repeat(64);
      },
      (m) => {
        m.artifacts[0].bytes++;
      },
      (m) => {
        m.schemaVersion = 2;
      },
    ]) {
      const changed = structuredClone(manifest);
      mutate(changed);
      await writeFile(path.join(copy, "manifest.json"), JSON.stringify(changed));
      await assert.rejects(verifyEvidence({ dir: copy }));
    }
  }
});

test("rejects invalid artifact selection and limits before creating output", async (t) => {
  const f = await fixture(t);
  const file = path.join(f.dir, "test.log");
  await writeFile(file, "private-test-output");
  const link = path.join(f.dir, "linked.log");
  await symlink(file, link);
  for (const artifacts of [
    [{ name: "../escape", file }],
    [{ name: "receipt", file }],
    [
      { name: "same", file },
      { name: "same", file },
    ],
    [{ name: "log", file: link }],
    [{ name: "log", file: f.dir }],
    [{ name: "log", file: path.join(f.dir, "missing.log") }],
    [{ name: "env", file: path.join(f.dir, ".env") }],
    Array.from({ length: 21 }, (_, i) => ({ name: `log-${i}`, file })),
  ])
    await assert.rejects(packEvidence({ ...f, artifacts }));
  await writeFile(file, "");
  await assert.rejects(packEvidence({ ...f, artifacts: [{ name: "log", file }] }));
  await truncate(file, 16 * 1024 * 1024 + 1);
  await assert.rejects(packEvidence({ ...f, artifacts: [{ name: "log", file }] }));
  await truncate(file, 16 * 1024 * 1024);
  await assert.rejects(
    packEvidence({ ...f, artifacts: Array.from({ length: 5 }, (_, i) => ({ name: `log-${i}`, file })) })
  );
  await assert.rejects(readFile(path.join(f.outDir, "manifest.json")));
});
