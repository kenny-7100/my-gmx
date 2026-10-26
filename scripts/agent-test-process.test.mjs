import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { closeSync, openSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { promisify } from "node:util";

import { runTestProcess } from "./lib/agent-test-process.mjs";

const exec = promisify(execFile);
const helper = new URL("./lib/agent-test-process.mjs", import.meta.url).href;
const fixture = (file, mode) => `
  const {spawn} = require('node:child_process');
  const {writeFileSync} = require('node:fs');
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio:'ignore'});
  child.unref();
  writeFileSync(${JSON.stringify(file)}, JSON.stringify({parent:process.pid,child:child.pid}));
  ${mode === "wait" ? "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);" : `process.exitCode=${mode};`}
`;
async function assertStopped(pids) {
  const { stdout } = await exec("ps", ["-axo", "pid=,stat="]);
  const live = stdout.split("\n").filter((line) => {
    const [pid, state] = line.trim().split(/\s+/);
    return pids.includes(Number(pid)) && !state?.startsWith("Z");
  });
  assert.deepEqual(live, []);
}

test("owned test groups remove descendants after success, failure and timeout", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-test-process-"));
  const fd = openSync(path.join(dir, "process.log"), "w");
  const sentinel = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const sentinelExited = once(sentinel, "exit");
  try {
    for (const mode of [0, 1, "wait"]) {
      const file = path.join(dir, `${mode}.json`);
      const exit = await runTestProcess({
        args: ["-e", fixture(file, mode)],
        cwd: dir,
        env: { PATH: process.env.PATH },
        logFd: fd,
        timeoutMs: mode === "wait" ? 500 : 5000,
      });
      assert.equal(exit.cleanup, "passed");
      assert.equal(exit.timedOut, mode === "wait");
      assert.equal(exit.interrupted, false);
      if (mode !== "wait") assert.equal(exit.code, mode);
      const { parent, child } = JSON.parse(await readFile(file, "utf8"));
      assert.equal(exit.processGroup, parent);
      await assertStopped([parent, child]);
      assert.equal(sentinel.exitCode, null);
      process.kill(sentinel.pid, 0);
    }
  } finally {
    sentinel.kill("SIGKILL");
    await sentinelExited;
    closeSync(fd);
    await rm(dir, { recursive: true, force: true });
  }
});

test("SIGINT and SIGTERM interrupt only the owned group and force stop an unresponsive leader", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gmx-test-interrupt-"));
  try {
    for (const signal of ["SIGINT", "SIGTERM"]) {
      const file = path.join(dir, `${signal}.json`);
      const driver = `import {runTestProcess} from ${JSON.stringify(helper)};const result=await runTestProcess({args:['-e',${JSON.stringify(fixture(file, "wait"))}],cwd:${JSON.stringify(dir)},env:{PATH:process.env.PATH},logFd:2,timeoutMs:10000});console.log(JSON.stringify(result));`;
      const child = spawn(process.execPath, ["--input-type=module", "-e", driver], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const exited = once(child, "exit");
      let stdout = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
      try {
        let pids;
        for (let attempt = 0; attempt < 100; attempt++) {
          try {
            pids = JSON.parse(await readFile(file, "utf8"));
            break;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        }
        assert.ok(pids);
        child.kill(signal);
        assert.equal((await exited)[0], 0);
        const result = JSON.parse(stdout);
        assert.equal(result.interrupted, true);
        assert.equal(result.timedOut, false);
        assert.equal(result.cleanup, "passed");
        await assertStopped([pids.parent, pids.child]);
      } finally {
        clearTimeout(timeout);
        if (child.exitCode === null) {
          child.kill("SIGKILL");
          await exited;
        }
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
