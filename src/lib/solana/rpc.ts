import { createSolanaRpc } from "@solana/kit";

import { getSolanaRpcUrl } from "config/rpc";

let rpc: ReturnType<typeof createSolanaRpc> | undefined;

export function getSolanaRpc() {
  if (!rpc) {
    rpc = createSolanaRpc(getSolanaRpcUrl());
  }
  return rpc;
}
