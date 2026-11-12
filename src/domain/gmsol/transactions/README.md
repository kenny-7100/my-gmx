# Solana order transactions

FESOL-56 provides a lazy Solana adapter for shared order-entry and order-editor consumers (FESOL-19). The application and GMX SDK keep their existing USD/token units; `orderInputs.ts` converts them using the FESOL-92 helpers. It does not add another trading page.

## Supported contract

The builder uses `@gmsol-labs/gmsol-sdk@0.9.0-test.2`, with the WASM hash pinned in `config/gmsol/sdk.ts`. The instruction subset in `orderAbi.json` comes from `crates/programs/idls/gmsol_store.json` at protocol tag `v0.9.0`, commit `c6778dc9bf6444f9037c3b0d2dc219c857e1b45d`. Live deployment compatibility still requires simulation and acceptance; a matching package API is not deployment evidence.

Supported actions are direct market/limit increases, market decreases, take-profit/stop-loss decreases, updates and cancellations. Preparation of the wallet user, position and associated token accounts is idempotent. Native SOL payments explicitly wrap only the intended amount into the wallet's WSOL account. Owner, fee payer, receiver and rent receiver must be the connected wallet. Callback orders, swap routes and Token-2022 account setup are rejected until their account ABI is reviewed.

A standalone create has one order. An atomic action starts with one increase and contains at most one TP and one SL for the same position, each no larger than the increase. A WASM transaction group is **not** atomic: the adapter recompiles preparation and orders into one version-0 transaction or fails without sending anything. The packet limit is 1232 bytes; compute units are capped at 1,400,000. Nonatomic preparation/actions execute serially, with at most four transactions total. All transactions share a fresh blockhash and its last valid block height; expiry requires rebuilding and signing again.

The installed high-level create API generates a fresh random 32-byte nonce internally and fixes the keeper fee at 300,000 lamports per order. The validator decodes each nonce and derives the expected order PDA. Explicit caller nonces and configurable execution fees are not supported by this package interface. A limit order's direction-specific unlimited acceptable-price sentinel becomes the ABI's `None`; market orders require a finite bound. Clearing an existing price to unlimited during update is rejected because this ABI cannot express clearing separately from leaving unchanged. Minimum output uses raw token units for increases and application USD for decreases.

## Signature and send boundary

`prepareGmsolOrderTransactions` loads the configured active, frozen LUT accounts and obtains a confirmed blockhash from the GMX-configured RPC. `sendGmsolOrderTransactions` snapshots the plan, rechecks LUT contents, validates every decoded instruction and account, simulates each actual transaction with the wallet's resulting SOL balance, and estimates its network fee before asking the wallet to sign. Only the configured gmsol instruction subset, bounded compute-budget instructions, idempotent ATA creation, exact SOL wrapping transfers and wallet SyncNative are permitted. Unknown instructions, extra accounts and unresolved LUT indices fail closed.

The Privy Solana `useSignTransaction` bridge signs bytes without sending. The sender verifies that the returned message is unchanged and its Ed25519 signature belongs to the owner. The session, block height and freshly fetched `solanaTrading` flag are checked again before every broadcast, including after a slow wallet prompt. GMX RPC performs preflight, send and confirmed-status polling. Confirmation refreshes the shared balances, orders and positions caches, with the confirmation slot supplied to the API. Refresh errors are returned separately from confirmed chain success.

`GmsolTransactionError` retains accepted RPC signatures and a potentially broadcast `pendingSignature`, even when the send request itself times out. Consumers must reconcile those signatures before offering a fresh order retry. A timeout or later transaction failure does not roll back earlier confirmed preparation. The adapter does not automatically resend or rebuild an ambiguous financial action.

## Acceptance and remaining work

`orderTransactions.spec.ts` uses the pinned real WASM, codecs, PDA derivation and Ed25519 signatures. RPC responses are controlled for adversarial preflight/send tests. Those tests do not establish wallet-extension compatibility, live program execution or keeper behavior.

Read-only mainnet diagnostics on 2026-11-13 used the connected Phantom public account and snapshots of the current LUTs, with signature verification disabled and no signing or broadcasting. A BTC/USDC limit increase simulated successfully (807 bytes, estimated network fee 45,000 lamports). Increase plus TP (1044 bytes, 55,000 lamports) and increase plus TP/SL (1221 bytes, 65,000 lamports) also simulated successfully when the decrease acceptable-price bounds were explicitly unlimited. The last simulation slot was 468611155. These diagnostics establish execution of that instruction subset against the live program; they do not satisfy the frozen-LUT production gate or prove keeper execution.

With finite acceptable-price bounds on both decrease orders, the same three-order example required 1255 bytes and was rejected. The builder never removes a user's finite bound to make a transaction fit. LUT provisioning must also cover the intended markets and bounded atomic combinations; freezing the current contents alone does not establish that every supported input fits.

- TODO(FESOL-71): provide frozen configured LUTs or reviewed GMX-owned frozen copies. Both configured tables still had an authority during the 2026-11-13 read-only mainnet check; production preparation correctly rejects them. Do not bypass this check to enable trading.
- TODO(FESOL-56): upgrade and repin the external SDK if explicit nonces or configurable keeper fees are required. Revalidate the instruction/account ABI and runtime deployment after any upgrade.
- TODO(FESOL-56): extend the deterministic validator before enabling callbacks, routed swaps or Token-2022. No generic instruction fallback is permitted.
- TODO(FESOL-56): after live LUT/deployment readiness, verify tiny limit/create/edit/cancel and atomic increase with TP/SL, plus Phantom, Solflare, OKX and TokenPocket signing the actual LUT transaction. Real wallet signatures/transactions and keeper execution remain distinct acceptance items.
- TODO(FESOL-19/FESOL-20): consume the adapter from the shared order UI and reconcile pending/executed order states. Preserve `Order.solana` metadata; handle partial/ambiguous sends and refresh lag without encouraging duplicate submissions.
- TODO(FESOL-112): deploy/verify the unified trade-math and discount contract. Existing API fields or frontend unit tests do not establish that rollout.
