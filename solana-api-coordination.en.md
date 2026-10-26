Hi Divhead, I'd like to align on the current progress of Solana gmx-api and the timeline for integration testing so we can plan the next frontend tasks.

From what we can see, the service skeleton and stub endpoints in FESOL-62 are complete, and FESOL-63 has [PR #295](https://github.com/gmx-io/gmx-api/pull/295). However, markets, positions, orders, and fee-discount still return sample data on the public main branch. `/v1/pairs` is available on `solana.gmxapi.io`, while the markets endpoint still returns 404. If another branch or deployment already provides real data, could you point us to it?

We'd like to start with one crypto market and a test wallet and walk through the complete flow: **read real market data and wallet state → calculate an order preview → build, simulate, sign, and submit an order → have the keeper execute it → refresh positions and orders → close the position, as well as create, modify, and cancel limit orders.**

For this flow, could you help confirm the following?

1. **Integration environment:** What api-solana URL and deployment version are currently available, and which endpoints return stub data versus real data? Please also share any relevant branches or PRs under development.
2. **API contracts:** When can the contracts and sample responses in [FESOL-61](https://linear.app/gmx-io/issue/FESOL-61) be finalized for frontend integration? This includes amount and price precision, market minimums, liquidation parameters, fee discounts, and the fields needed to modify and cancel orders.
3. **Real data:** When will the real market configuration and values in [FESOL-63](https://linear.app/gmx-io/issue/FESOL-63)/[64](https://linear.app/gmx-io/issue/FESOL-64), and the real positions, orders, and wallet fee-discount data in [FESOL-65](https://linear.app/gmx-io/issue/FESOL-65), be available for integration testing and the necessary numerical comparisons against on-chain data?

Separately, to keep frontend work moving before all backend data is ready, we put together [FESOL-87](https://linear.app/gmx-io/issue/FESOL-87), which currently retains five independent work slices:

- [FESOL-89](https://linear.app/gmx-io/issue/FESOL-89): Read raw native SOL balances and balances of configured token associated token accounts (ATAs) through RPC for an explicitly specified owner.
- [FESOL-90](https://linear.app/gmx-io/issue/FESOL-90): Isolate trading caches and persisted preferences by network to prevent EVM and Solana state from being mixed.
- [FESOL-91](https://linear.app/gmx-io/issue/FESOL-91): Provide network-aware token lookups using existing static configuration, preserving mint address case, decimal precision, and display multipliers correctly.
- [FESOL-92](https://linear.app/gmx-io/issue/FESOL-92): Implement pure unit conversions between application values and gmsol SDK order inputs, with explicit precision, rounding rules, and test vectors.
- [FESOL-96](https://linear.app/gmx-io/issue/FESOL-96): Build a lazily loaded balance hook on top of FESOL-89, handling network and wallet cache isolation, refreshes, and error states.

Our assessment is that the first four do not depend on unfinished backend capabilities, while FESOL-96 depends only on FESOL-89 within this group. We are currently leaning toward starting with FESOL-91. Could you review these against the backend roadmap and confirm **whether they align with the target contracts and whether there is practical value in implementing them now?**
