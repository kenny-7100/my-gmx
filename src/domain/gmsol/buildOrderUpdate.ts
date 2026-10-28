import type { Callback, UpdateOrderArgs, UpdateOrderParams, update_orders } from "@gmsol-labs/gmsol-sdk";

import { GMSOL_STORE_ADDRESS, GMSOL_STORE_PROGRAM_ID } from "config/gmsol/program";
import { toGmsolUsd } from "sdk/utils/gmsol/units";

import {
  copyOrderCallback,
  copyOrderLookupTables,
  MAX_ORDER_TRANSACTION_BYTES,
  orderAddress,
  serializeUnsignedOrder,
} from "./orderBuilder";

export type OrderUpdateInput = {
  network: "solana-mainnet";
  owner: string;
  order: string;
  market: string;
  kind: "LimitIncrease" | "LimitDecrease" | "StopLossDecrease";
  recentBlockhash: string;
  lookupTables: ReadonlyMap<string, readonly string[]>;
  callback: Callback | undefined;
  changes: {
    sizeDeltaUsd?: bigint;
    // Shared contract prices: USD30 per smallest native token unit, without display scaling.
    acceptablePrice?: bigint;
    triggerPrice?: bigint;
    // Increase: raw token amount; decrease: USD30 output value.
    minOutput?: bigint;
    validFromTs?: number;
  };
};
export type UnsignedOrderUpdate = {
  network: "solana-mainnet";
  owner: string;
  order: string;
  recentBlockhash: string;
  market: string;
  kind: OrderUpdateInput["kind"];
  bytes: Uint8Array;
};
type UpdateSdk = { update_orders: typeof update_orders };
const U128_MAX = (1n << 128n) - 1n;

function unsigned(value: bigint): bigint {
  if (typeof value !== "bigint" || value < 0n || value > U128_MAX) throw new Error("Invalid unsigned order value");
  return value;
}
function usd20(value: bigint): bigint {
  const converted = toGmsolUsd(value);
  if (value > 0n && converted === 0n) throw new Error("Order value is below gmsol precision");
  return converted;
}

/** Builds one unsigned update; no wallet, RPC, state, signing or submission is performed. */
export async function buildOrderUpdate(
  input: OrderUpdateInput,
  loadSdk: () => Promise<UpdateSdk> = () => import("./loadGmsolSdk").then(({ loadGmsolSdk }) => loadGmsolSdk())
): Promise<UnsignedOrderUpdate> {
  if (input.network !== "solana-mainnet") throw new Error("Unsupported order network");
  if (!["LimitIncrease", "LimitDecrease", "StopLossDecrease"].includes(input.kind)) {
    throw new Error("Unsupported update order kind");
  }
  const scope = {
    network: input.network,
    owner: orderAddress(input.owner),
    order: orderAddress(input.order),
    market: orderAddress(input.market),
    kind: input.kind,
    recentBlockhash: orderAddress(input.recentBlockhash),
  };
  const luts = copyOrderLookupTables(input.lookupTables);
  const params: UpdateOrderParams = {};
  const changes = input.changes;
  if (changes.sizeDeltaUsd !== undefined) params.size_delta_value = usd20(changes.sizeDeltaUsd);
  if (changes.acceptablePrice !== undefined) params.acceptable_price = usd20(changes.acceptablePrice);
  if (changes.triggerPrice !== undefined) params.trigger_price = usd20(changes.triggerPrice);
  if (changes.minOutput !== undefined) {
    params.min_output = input.kind === "LimitIncrease" ? unsigned(changes.minOutput) : usd20(changes.minOutput);
  }
  if (changes.validFromTs !== undefined) {
    if (!Number.isSafeInteger(changes.validFromTs)) throw new Error("Invalid order timestamp");
    params.valid_from_ts = changes.validFromTs;
  }
  if (Object.keys(params).length === 0) throw new Error("Order update has no changes");
  const callback = copyOrderCallback(input.callback);
  // Snapshot all caller-owned data before loading WASM; late results retain their original scope.
  const args: UpdateOrderArgs = {
    recent_blockhash: scope.recentBlockhash,
    payer: scope.owner,
    program: { id: GMSOL_STORE_PROGRAM_ID, store: GMSOL_STORE_ADDRESS },
    orders: new Map([[scope.order, { params, hint: { market_token: scope.market, callback } }]]),
    transaction_group: { luts, max_transaction_size: MAX_ORDER_TRANSACTION_BYTES },
  };
  const sdk = await loadSdk();
  const group = sdk.update_orders(args);
  return { ...scope, bytes: serializeUnsignedOrder(group, scope) };
}
