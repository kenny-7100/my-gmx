import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import process from "node:process";

// Atomic replacement prevents readers from seeing a partially written task record.
export async function writeRecord(file, record) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

// One repository-wide lock also serializes different tasks that share the personal base.
export async function withWorkflowLock(directory, operation, run) {
  await mkdir(directory, { recursive: true });
  const lock = path.join(directory, "write.lock");
  let handle;
  try {
    handle = await open(lock, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    assert.fail(`Workflow is busy: inspect ${lock}. Never remove an active owner's lock.`);
  }
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, host: hostname(), operation, startedAt: new Date().toISOString() })
    );
    return await run();
  } finally {
    await handle.close();
    await rm(lock);
  }
}
