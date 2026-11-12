import { execFileSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

// This is a fast-path gate, not a substitute for reviewing content or running relevant tool tests.
export function infrastructureOnly(cwd = process.cwd()) {
  const files = execFileSync("git", ["diff", "--cached", "--name-only", "--no-renames", "-z"], { cwd })
    .toString()
    .split("\0")
    .filter(Boolean);
  const raw = execFileSync("git", ["diff", "--cached", "--raw", "--no-renames"], { cwd }).toString();
  return (
    files.length > 0 &&
    !raw.includes("160000") &&
    files.every(
      (file) => file === "AGENTS.md" || file === ".husky/pre-commit" || /^(docs|\.agents|scripts|tools)\//.test(file)
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = infrastructureOnly() ? 0 : 1;
  } catch {
    process.exitCode = 2;
  }
}
