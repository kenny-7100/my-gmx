import { expect, it } from "vitest";

import { decodeFrozenSolanaLookupTable } from "./lookupTables";

it("accepts a frozen active LUT and rejects mutable, deactivated or malformed accounts FESOL-56", () => {
  const bytes = new Uint8Array(88);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 1, true);
  view.setBigUint64(4, (1n << 64n) - 1n, true);
  expect(decodeFrozenSolanaLookupTable(bytes)).toEqual(["11111111111111111111111111111111"]);
  const mutable = bytes.slice();
  mutable[21] = 1;
  expect(() => decodeFrozenSolanaLookupTable(mutable)).toThrow(/frozen/);
  const deactivated = bytes.slice();
  new DataView(deactivated.buffer).setBigUint64(4, 1n, true);
  expect(() => decodeFrozenSolanaLookupTable(deactivated)).toThrow(/deactivated/);
  expect(() => decodeFrozenSolanaLookupTable(bytes.slice(0, 87))).toThrow(/length/);
  expect(() => decodeFrozenSolanaLookupTable(new Uint8Array(56 + 257 * 32))).toThrow();
});
