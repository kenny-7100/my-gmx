"""Generate exact apply_factor reference values without importing the SDK."""
import json

UNIT = 10 ** 20
MAX_U128 = 2 ** 128 - 1
CASES = [
    ("zero-value", 0, UNIT),
    ("zero-factor", MAX_U128, 0),
    ("one-percent", 100 * UNIT, UNIT // 100),
    ("identity", 1234567890123456789012345, UNIT),
    ("one-hundred-ten-percent", 100 * UNIT, UNIT + UNIT // 10),
    ("floor-to-zero", 1, UNIT - 1),
    ("floor-remainder", 101, UNIT // 3),
    ("above-js-safe-integer", 2 ** 64 + 1, UNIT // 2),
    ("max-identity", MAX_U128, UNIT),
    ("max-factor", 1, MAX_U128),
    ("max-product", MAX_U128, MAX_U128),
    ("overflow-by-one", 2 ** 127, 2 * UNIT),
]

vectors = []
for name, value, factor in CASES:
    result = value * factor // UNIT
    vectors.append({
        "name": name, "value": str(value), "factor": str(factor),
        "expected": str(result) if result <= MAX_U128 else None,
    })

print(json.dumps({
    "schemaVersion": 1,
    "operation": "apply_factor",
    "factorDecimals": 20,
    "rounding": "floor",
    "overflow": "undefined-above-u128",
    "oracle": "Python unbounded integer multiplication and floor division; no SDK import",
    "referenceCommit": "f102501f30635062fac156ca05831c0fb63a8590",
    "referenceFiles": [
        "crates/sdk/src/js/utils.rs", "crates/programs/src/constants/mod.rs",
        "crates/model/src/utils.rs", "crates/model/src/num.rs",
    ],
    "vectors": vectors,
}, indent=2))
