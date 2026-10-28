# gmsol order unit conversions

These opt-in helpers convert order inputs; they do not choose order policies, build transactions, compute fees or liquidation, or register tokens. Existing EVM helpers and callers are unchanged. No app module imports this entry yet.

## Contract and provenance

The app pins `@gmsol-labs/gmsol-sdk` to `0.9.0-test.2` with WASM SHA-256 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`. Its installed `index.d.ts` defines `CreateOrderParams.size`, `amount`, `min_output`, `trigger_price` and `acceptable_price` as bigint. The corresponding Rust `CreateOrderParams` uses unsigned `u128` fields. This layout was checked in both the [v0.9.0 source](https://github.com/gmsol-labs/gmx-solana/blob/v0.9.0/crates/sdk/src/builders/order/create.rs) and the reference checkout at `f102501f30635062fac156ca05831c0fb63a8590`.

[Decimal](https://github.com/gmsol-labs/gmx-solana/blob/v0.9.0/crates/utils/src/price/decimal.rs) uses `MAX_DECIMALS = 20`; its USDC reference gives unit price `100000000000000` for $1 and 6 mint decimals. The shared app uses whole-token USD30 prices; `utils/tokens` already distinguishes `convertToContractPrice` and `parseContractPrice`.

This is evidence for units and widths, not proof that the fixed WASM matches a deployed program or supports an atomic order group. Those checks belong to T20/FESOL-56.

## Input and output units

Let `d` be the actual mint decimals, `P` the whole-token USD30 price, and `M` a visual multiplier. All monetary arithmetic uses bigint.

| Value                    | App input                                          | gmsol input                                                                | Conversion / rounding                                                                                              |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Order size               | Unsigned USD30                                     | `size` / `size_delta_value`, USD20                                         | `toGmsolUsd`: divide by 10^10, round down                                                                          |
| USD output value         | Unsigned USD30                                     | Decrease `min_output`, USD20                                               | Same conversion; order policy must account for lost precision                                                      |
| Whole-token price        | `P`, USD30 per whole native token                  | `trigger_price` / `acceptable_price`, USD20 per smallest native token unit | `toGmsolPrice`: divide by 10^(10+d), explicitly choose down or up                                                  |
| Contract price           | `P / 10^d`, USD30 per smallest token unit          | Unit price, USD20 per smallest token unit                                  | Divide by 10^10; **do not pass contract price to `toGmsolPrice`**, which would apply mint decimals twice           |
| Native token amount      | Already raw smallest units (`whole amount × 10^d`) | `amount`; increase/swap `min_output`                                       | Unchanged; never divide token amounts by 10^10. Builder validates action-specific bounds and token transfer limits |
| SOL execution fee / rent | Lamports                                           | Lamports                                                                   | Unchanged, not USD20; validate the corresponding unsigned `u64` instruction field in the builder                   |
| Display price            | Price per `M` native tokens                        | Not an ABI unit                                                            | Undo visual scaling before conversion: the shared native whole-token price must not contain `M`                    |
| Returned USD value       | USD20                                              | Shared USD30                                                               | `fromGmsolUsd`: multiply by 10^10, exact                                                                           |
| Returned unit price      | USD20 per smallest token unit                      | Shared whole-token USD30                                                   | `fromGmsolPrice`: multiply by 10^(10+d), exact                                                                     |

For example, kBONK's displayed price represents 1,000 BONK. It does not change the BONK mint decimals or raw token balance. These helpers intentionally take no visual multiplier and cannot infer whether a caller has already undone that scaling.

## Bounds and precision

- App values are unsigned integers in `[0, 2^256−1]`; gmsol USD and unit prices are in `[0, 2^128−1]`. Both input and converted output bounds are checked. An out-of-range value throws `RangeError`; non-bigint values throw `TypeError`. No truncation of high bits, saturation or Number conversion occurs.
- Signed PnL/funding conversion is outside this order-input contract. Negative values are rejected, including values that would otherwise round to zero.
- `tokenDecimals` must be an integer in `[0, 30]`, the shared app precision range. The 24-decimal cases verify integer scaling; they do not admit such a mint into an on-chain oracle that has a narrower decimal/precision limit.
- USD downscaling discards the remainder. Price downscaling requires an explicit `roundUp` boolean; `false` is floor and `true` is ceiling, both for nonnegative values. A builder must choose the direction according to its trigger/acceptable-price policy, rather than always rounding the same way.
- Zero is allowed at this numeric boundary. A positive price smaller than one gmsol tick can round to zero; an order builder must reject unusable prices and zero-size actions where the protocol requires a positive value.
- Upscaling is exact for the represented gmsol value; it cannot recover a remainder previously discarded. `fromGmsolPrice` rejects a result that would exceed the app's uint256 range.

## Reference vectors

`units.spec.ts` defines the same exact $123456.789012345678901234 price using the literal integer `123456789012345678901234000000000000`, without a floating-point intermediate. Moving the decimal point by `10+d` places gives these independently specified floor results:

| Mint decimals | gmsol unit price, rounded down |
| ------------- | ------------------------------ |
| 6             | 12345678901234567890           |
| 8             | 123456789012345678             |
| 9             | 12345678901234567              |
| 18            | 12345678                       |
| 24            | 12                             |

Every row has a nonzero remainder, so its ceiling is one higher. Tests also cover zero, one tick and either adjacent integer, USD rounding, exact maxima, rounding-induced overflow, invalid decimals, negative values and reverse-conversion overflow. The tick identity is `smallest token amount × unit price = USD20 value`; the protocol's $1 USDC vector provides a separate anchor.

Run from the repository root using the existing offline SDK runner:

```sh
yarn sdk:test-offline --suite src/utils/gmsol/units.spec.ts \
  --suite src/utils/__tests__/bigmath.spec.ts \
  --suite src/utils/__tests__/numbers.spec.ts \
  --suite src/utils/__tests__/fees.spec.ts
```

The package adds only the `@gmx-io/sdk/utils/gmsol` subpath. It does not re-export through an EVM entry, alter a shared calculation or add runtime dependencies. Published CJS/ESM/declaration compatibility must be checked after an authorized SDK build; source tests alone do not establish it.
