import { readFile } from "node:fs/promises";

export async function readNetworkAudit(eventsFile, expectedInstallations) {
  const content = await readFile(eventsFile, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const events = content.trim().split("\n").filter(Boolean);
  const installations = events.filter((event) => event === "installed").length;
  const blockedAttempts = events.filter((event) => event === "blocked").length;
  return {
    status:
      installations === expectedInstallations &&
      blockedAttempts === 0 &&
      events.every((event) => event === "installed" || event === "blocked")
        ? "passed"
        : "failed",
    eventsFile,
    installations,
    blockedAttempts,
  };
}
