import type { ParsedUnsignedOrderTransaction } from "./parseUnsignedOrderTransaction";

export function requireOrderValue(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}
export function orderInstructionBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
export const ORDER_COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";

/** Exact action-approved values, without an implicit fee policy or production cap. */
export function validateOrderComputeBudget(
  parsed: ParsedUnsignedOrderTransaction,
  expected: { computeUnitLimit: number; computeUnitPrice: bigint }
) {
  const { computeUnitLimit: limit, computeUnitPrice: price } = expected;
  requireOrderValue(Number.isInteger(limit) && limit > 0 && limit <= 0xffffffff, "Invalid expected compute limit");
  requireOrderValue(typeof price === "bigint" && price >= 0n && price < 1n << 64n, "Invalid expected compute price");
  for (const [index, tag, size, value] of [
    [0, 2, 4, BigInt(limit)],
    [1, 3, 8, price],
  ] as const) {
    const ix = parsed.instructions[index];
    requireOrderValue(ix !== undefined, "Missing compute budget instruction");
    const data = orderInstructionBytes(ix.dataBase64);
    requireOrderValue(
      ix.program.address === ORDER_COMPUTE_BUDGET_PROGRAM &&
        ix.accounts.length === 0 &&
        data.length === size + 1 &&
        data[0] === tag,
      "Unexpected compute budget instruction"
    );
    let actual = 0n;
    for (let i = size; i > 0; i--) actual = (actual << 8n) | BigInt(data[i]);
    requireOrderValue(actual === value, "Unexpected compute budget value");
  }
}
