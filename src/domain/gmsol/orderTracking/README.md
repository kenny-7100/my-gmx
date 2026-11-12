# Solana order outcome evidence

The decoder accepts the Anchor CPI event envelope and IDL at
`c6778dc9bf6444f9037c3b0d2dc219c857e1b45d` (the v0.9.0 ABI used by the
pinned transaction builder). The envelope, discriminator and Borsh layouts are
stored in `orderEventLayout.json`. Unknown/truncated events and failed
transaction metadata cannot supply successful execution evidence.

`getCreatedOrderActions` binds creation receipts to order addresses obtained
from the validated transaction, then takes the action id and context from the
matching `OrderUpdated(is_create)` event. A confirmed signature alone does not
identify a filled order. A receipt indexing delay must not turn a successful
send into a failed send.

`readOrderLifecycle` reads the history of this specific order through the
configured GMX RPC, stopping at its creation signature. It never enumerates a
wallet's orders. The read is bounded to 500 signatures and a 20-second deadline;
missing history or receipts remain unresolved. Same-slot observations require
transaction ordering from the block's signature list. `watchOrderLifecycle`
retries unresolved observations for up to five minutes and supports cancellation.
The notification consumer supports one primary market order per submission,
with optional attached triggers; it does not infer a whole batch's outcome from
one completed member. Limit/trigger creation does not wait for execution.

A matching trade may precede account closure. Conversely, account closure or a
`Completed` removal without the position trade is insufficient proof of a fill.
Cancellation states and reasons are independent from submission confirmation.
The lifecycle semantics follow protocol PR
https://github.com/gmsol-labs/gmx-solana/pull/492; unlike that Rust reader's
original scope, this decoder explicitly excludes failed transactions.

The committed fixtures preserve historical finalized mainnet receipts captured
on 2026-10-27 and their source/IDL hashes. Their metadata records that historical
binary-to-source identity is unproven and business acceptance was not evaluated.
They exercise the supported decoder contract, not current deployment acceptance.
Synthetic test mutations are state-machine edge cases, not additional observed
mainnet transactions. Verify deployment compatibility and live order/toast
behavior before release; offline tests do not authorize signing or broadcasting.
