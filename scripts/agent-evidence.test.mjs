import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

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
