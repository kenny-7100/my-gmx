/* eslint-disable local-rules/solana-import-boundaries -- Offline schema artifact; never imported by the application. */
import { getProgramDerivedAddress } from "@solana/kit";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { storeIdlEvidence } from "./solana-builder-probe.mjs";
import { GMSOL_STORE_PROGRAM_ID } from "../src/config/gmsol/program.ts";

const hash = (data) => createHash("sha256").update(data).digest("hex");
const names = ["OrderCreated", "OrderUpdated", "OrderRemoved", "TradeEvent"];
const sourcePaths = [
  "programs/store/src/events/mod.rs",
  "programs/store/src/events/order.rs",
  "programs/store/src/events/trade/event.rs",
  "programs/store/src/constants/mod.rs",
  "crates/utils/src/action.rs",
];

export async function eventContract() {
  const { idl, commit, sha256 } = storeIdlEvidence;
  const definitions = new Map(idl.types.map((item) => [item.name, item]));
  const selected = new Map();
  function layout(type) {
    const fixed = { u8: 1, bool: 1, u64: 8, i64: 8, u128: 16, i128: 16, pubkey: 32 }[type];
    if (fixed) return { min: fixed, max: fixed };
    if (type === "string") return { min: 4, max: null };
    if (type.option) {
      const inner = layout(type.option);
      return { min: 1, max: inner.max === null ? null : 1 + inner.max };
    }
    if (type.array) {
      const inner = layout(type.array[0]);
      return { min: inner.min * type.array[1], max: inner.max === null ? null : inner.max * type.array[1] };
    }
    const definition = definitions.get(type.defined?.name);
    assert.ok(definition, "Unsupported event field type");
    selected.set(definition.name, definition);
    if (definition.type.kind === "enum") {
      assert.ok(
        definition.type.variants.every((variant) => !variant.fields),
        "Unsupported enum payload"
      );
      return { min: 1, max: 1 };
    }
    assert.equal(definition.type.kind, "struct");
    return fieldsLayout(definition.type.fields).size;
  }
  function fieldsLayout(fields) {
    let offset = { min: 0, max: 0 };
    const entries = fields.map((field) => {
      const size = layout(field.type);
      const entry = { name: field.name, type: field.type, payloadOffset: { ...offset }, size };
      offset = {
        min: offset.min + size.min,
        max: offset.max === null || size.max === null ? null : offset.max + size.max,
      };
      return entry;
    });
    return { fields: entries, size: offset };
  }
  const events = names.map((name) => {
    const event = idl.events.find((item) => item.name === name);
    assert.ok(event, "Missing pinned event");
    const discriminator = Buffer.from(event.discriminator);
    assert.ok(discriminator.equals(createHash("sha256").update(`event:${name}`).digest().subarray(0, 8)));
    const definition = definitions.get(name);
    selected.set(name, definition);
    const result = fieldsLayout(definition.type.fields);
    return { name, discriminatorHex: discriminator.toString("hex"), ...result };
  });
  const [authority, bump] = await getProgramDerivedAddress({
    programAddress: GMSOL_STORE_PROGRAM_ID,
    seeds: [Buffer.from("__event_authority")],
  });
  return {
    schemaVersion: 1,
    scope: "order-event-layout-contract",
    status: "source-derived-not-live-validated",
    parser: "not-implemented",
    rulesDocument: "docs/solana-order-events.md",
    program: GMSOL_STORE_PROGRAM_ID,
    idlCommit: commit,
    idlSha256: sha256,
    generatorSha256: hash(await readFile(new URL(import.meta.url))),
    anchorVersion: "0.31.1",
    envelope: {
      // Anchor interprets the hash prefix as a u64 constant, then emits it little-endian.
      tagHex: createHash("sha256").update("anchor:event").digest().subarray(0, 8).reverse().toString("hex"),
      eventDiscriminatorOffset: 8,
      payloadOffset: 16,
      accountCount: 1,
      eventAuthority: authority,
      eventAuthorityBump: bump,
      eventAuthoritySeed: "__event_authority",
    },
    sources: sourcePaths.map((path) => ({
      path,
      commit,
      sha256: hash(
        execFileSync("git", [
          "-C",
          fileURLToPath(new URL("../gmx-solana", import.meta.url)),
          "show",
          `${commit}:${path}`,
        ])
      ),
    })),
    lifecycleReference: {
      url: "https://github.com/gmsol-labs/gmx-solana/pull/492",
      head: "15ab63420a531a2921d7e7a95217b55ac5e8d432",
      statusAtReview: "OPEN",
      failedTransactionsCovered: false,
      adoptedScanner: false,
    },
    events,
    types: Array.from(selected.values()),
    pending: [
      "real receipt fixtures",
      "strict TS parser",
      "offline lifecycle reducer",
      "failed metadata and mutation acceptance",
      "live program layout compatibility",
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  eventContract()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack}\n`);
      process.exitCode = 1;
    });
}
