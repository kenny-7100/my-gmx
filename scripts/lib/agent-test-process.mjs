import { execFile, spawn } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function remainingGroup(pid) {
  const { stdout } = await exec("ps", ["-axo", "pgid=,pid=,stat="], { timeout: 5000 });
  return stdout.split("\n").filter((line) => {
    const [group, , state] = line.trim().split(/\s+/);
    return Number(group) === pid && !state?.startsWith("Z");
  });
}

export async function runTestProcess({ args, cwd, env, logFd, timeoutMs = 120000 }) {
  let child;
  let timer;
  let stopTimer;
  let interrupted = false;
  let timedOut = false;
  let signalError;
  const signalGroup = (signal) => {
    if (!child?.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") signalError = error.code;
    }
  };
  const stop = () => {
    interrupted = true;
    signalGroup("SIGTERM");
    if (!stopTimer) stopTimer = setTimeout(() => signalGroup("SIGKILL"), 1000);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  let exit;
  try {
    child = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", logFd, logFd], detached: true });
    timer = setTimeout(() => {
      timedOut = true;
      signalGroup("SIGKILL");
    }, timeoutMs);
    exit = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
  } finally {
    clearTimeout(timer);
    clearTimeout(stopTimer);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    if (child?.pid && (await remainingGroup(child.pid)).length) signalGroup("SIGKILL");
  }
  let cleanup = "passed";
  if (child?.pid) {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (!(await remainingGroup(child.pid)).length) break;
      if (attempt === 49) cleanup = "failed";
      else await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  return { ...exit, interrupted, timedOut, processGroup: child.pid, cleanup, ...(signalError ? { signalError } : {}) };
}
