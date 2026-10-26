import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export function shape(value) {
  if (Array.isArray(value)) {
    const variants = [
      ...new Map(
        value.map((item) => {
          const itemShape = shape(item);
          return [JSON.stringify(itemShape), itemShape];
        })
      ).values(),
    ];
    return { type: "array", variants };
  }
  if (value === null) return { type: "null" };
  if (typeof value === "object")
    return {
      type: "object",
      fields: Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, shape(value[key])])
      ),
    };
  return { type: typeof value === "string" && /^-?\d+$/.test(value) ? "integer-string" : typeof value };
}

export function differences(expected, value, at = "$", errors = []) {
  if (errors.length >= 50) return errors;
  const actual = shape(value);
  if (expected.type !== actual.type)
    errors.push({ path: at, code: "type-changed", expected: expected.type, actual: actual.type });
  else if (expected.type === "object") {
    const keys = Object.keys(value);
    for (const [key, field] of Object.entries(expected.fields)) {
      if (!Object.prototype.hasOwnProperty.call(value, key))
        errors.push({ path: `${at}.${key}`, code: "field-missing" });
      else differences(field, value[key], `${at}.${key}`, errors);
    }
    for (const key of keys)
      if (!Object.prototype.hasOwnProperty.call(expected.fields, key))
        errors.push({ path: `${at}.${key}`, code: "field-added" });
  } else if (expected.type === "array") {
    for (const [index, item] of value.entries()) {
      const candidates = expected.variants.map((variant) => differences(variant, item, `${at}[${index}]`, []));
      if (candidates.length === 0) errors.push({ path: `${at}[${index}]`, code: "unrecorded-array-element" });
      else if (!candidates.some((candidate) => candidate.length === 0))
        errors.push(...candidates.sort((a, b) => a.length - b.length)[0]);
      if (errors.length >= 50) break;
    }
  }
  return errors.slice(0, 50);
}

export async function checkContracts({ apiDir = path.join(ROOT, "gmx-api"), baseUrl } = {}) {
  const baseline = JSON.parse(await readFile(path.join(ROOT, "tools/solana-dev/sample-shapes.json"), "utf8"));
  const checks = [];
  for (const route of baseline.routes) {
    const bytes = await readFile(path.join(apiDir, route.file));
    const sourceMatches = createHash("sha256").update(bytes).digest("hex") === route.sha256;
    let errors = differences(route.shape, JSON.parse(bytes));
    if (baseUrl) {
      const response = await fetch(`${baseUrl}${route.path}`, { redirect: "error", signal: AbortSignal.timeout(5000) });
      if (response.status !== 200) errors.push({ path: "$", code: "unexpected-http-status", actual: response.status });
      else errors.push(...differences(route.shape, await response.json()));
    }
    checks.push({
      route: route.path.split("?")[0],
      sourceMatches,
      status: sourceMatches && errors.length === 0 ? "passed" : "failed",
      errors,
    });
  }
  const failed = checks.some((check) => check.status === "failed");
  return {
    status: failed ? "failed" : "partial",
    structuralCheck: failed ? "failed" : "passed",
    mode: baseUrl ? "local-http-sample-baseline" : "offline-sample-baseline",
    checkedAt: new Date().toISOString(),
    baselineCommit: baseline.apiCommit,
    baselineReview: "unreviewed-source-samples",
    checks,
    gaps: [
      "No consumer contract check configured; the infrastructure baseline has no Solana frontend API parser.",
      "Field semantics, units, empty-state behavior and reviewed contract remain unconfirmed.",
    ],
  };
}
