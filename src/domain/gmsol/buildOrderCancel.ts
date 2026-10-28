import type { Callback, CloseOrderArgs, close_orders } from "@gmsol-labs/gmsol-sdk";

import { GMSOL_STORE_ADDRESS, GMSOL_STORE_PROGRAM_ID } from "config/gmsol/program";

import {
  copyOrderCallback,
  copyOrderLookupTables,
  MAX_ORDER_TRANSACTION_BYTES,
  orderAddress,
  serializeUnsignedOrder,
} from "./orderBuilder";

export type OrderCancelInput = {
  network: "solana-mainnet";
  owner: string;
  order: string;
  receiver: string;
  rentReceiver: string;
  recentBlockhash: string;
  lookupTables: ReadonlyMap<string, readonly string[]>;
  callback: Callback | undefined;
  // Confirmed referrer wallet, not a user PDA or an address guessed from the IDL.
  referrerWallet: string | undefined;
  initialCollateralToken: string | undefined;
  finalOutputToken: string | undefined;
  longToken: string | undefined;
  shortToken: string | undefined;
  shouldUnwrapNativeToken: boolean;
};
export type UnsignedOrderCancel = {
  network: "solana-mainnet";
  owner: string;
  order: string;
  receiver: string;
  rentReceiver: string;
  recentBlockhash: string;
  bytes: Uint8Array;
};
type CancelSdk = { close_orders: typeof close_orders };
const optionalAddress = (value: string | undefined) => (value === undefined ? undefined : orderAddress(value));

/** Cancels one explicitly identified order; no account lookup, signing or broadcasting. */
export async function buildOrderCancel(
  input: OrderCancelInput,
  loadSdk: () => Promise<CancelSdk> = () => import("./loadGmsolSdk").then(({ loadGmsolSdk }) => loadGmsolSdk())
): Promise<UnsignedOrderCancel> {
  if (input.network !== "solana-mainnet") throw new Error("Unsupported order network");
  const scope = {
    network: input.network,
    owner: orderAddress(input.owner),
    order: orderAddress(input.order),
    receiver: orderAddress(input.receiver),
    rentReceiver: orderAddress(input.rentReceiver),
    recentBlockhash: orderAddress(input.recentBlockhash),
  };
  if (scope.receiver !== scope.owner || scope.rentReceiver !== scope.owner) {
    throw new Error("Order cancellation receivers must match the owner");
  }
  if (input.referrerWallet === scope.owner) throw new Error("Order owner cannot be the referrer");
  if (typeof input.shouldUnwrapNativeToken !== "boolean") throw new Error("Explicit native unwrap flag is required");
  const args: CloseOrderArgs = {
    recent_blockhash: scope.recentBlockhash,
    payer: scope.owner,
    program: { id: GMSOL_STORE_PROGRAM_ID, store: GMSOL_STORE_ADDRESS },
    transaction_group: {
      luts: copyOrderLookupTables(input.lookupTables),
      max_transaction_size: MAX_ORDER_TRANSACTION_BYTES,
    },
    orders: new Map([
      [
        scope.order,
        {
          owner: scope.owner,
          receiver: scope.receiver,
          rent_receiver: scope.rentReceiver,
          referrer: optionalAddress(input.referrerWallet),
          initial_collateral_token: optionalAddress(input.initialCollateralToken),
          final_output_token: optionalAddress(input.finalOutputToken),
          long_token: optionalAddress(input.longToken),
          short_token: optionalAddress(input.shortToken),
          should_unwrap_native_token: input.shouldUnwrapNativeToken,
          callback: copyOrderCallback(input.callback),
        },
      ],
    ]),
  };
  const sdk = await loadSdk();
  const group = sdk.close_orders(args);
  return { ...scope, bytes: serializeUnsignedOrder(group, scope) };
}
