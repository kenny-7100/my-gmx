/* eslint-disable local-rules/solana-import-boundaries -- Offline fixture inventory; never imported by the application. */
import { getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { decodeOrderData, storeIdlEvidence } from "./solana-builder-probe.mjs";
import { GMSOL_STORE_ADDRESS, GMSOL_STORE_PROGRAM_ID } from "../src/config/gmsol/program.ts";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixtureNames = ["unsigned", "parameter", "capability", "native"];

export async function inventory() {
  const sources = [];
  const variants = new Map();
  let transactionCount = 0;
  for (const name of fixtureNames) {
    const path = `tools/solana-builder-probe/${name}-fixtures.json`;
    const input = await readFile(new URL(`../${path}`, import.meta.url));
    const fixture = JSON.parse(input);
    assert.equal(fixture.idlCommit, storeIdlEvidence.commit);
    assert.equal(fixture.idlSha256, storeIdlEvidence.sha256);
    const tables = new Map(fixture.input.luts);
    sources.push({ path, sha256: hash(input), probeSha256: fixture.probeSha256, checkedAt: fixture.checkedAt });
    for (const sample of fixture.cases)
      for (const batch of sample.transactions)
        for (const captured of batch) {
          const bytes = Buffer.from(captured.bytesBase64, "base64");
          assert.equal(hash(bytes), captured.sha256);
          assert.equal(bytes.length, captured.size);
          const tx = getTransactionDecoder().decode(bytes);
          assert.ok(Object.values(tx.signatures).every((signature) => signature === null));
          const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
          assert.equal(message.staticAccounts[0], fixture.input.payer);
          assert.equal(message.lifetimeToken, fixture.input.blockhash);
          const header = message.header;
          assert.equal(header.numSignerAccounts, 1);
          assert.equal(header.numReadonlySignerAccounts, 0);
          assert.ok(header.numReadonlyNonSignerAccounts <= message.staticAccounts.length - 1);
          const accounts = message.staticAccounts.map((address, index) => ({
            address,
            signer: index < header.numSignerAccounts,
            writable:
              index < header.numSignerAccounts
                ? index < header.numSignerAccounts - header.numReadonlySignerAccounts
                : index < message.staticAccounts.length - header.numReadonlyNonSignerAccounts,
          }));
          const writable = [],
            readonly = [];
          for (const lookup of message.addressTableLookups ?? []) {
            const table = tables.get(lookup.lookupTableAddress);
            assert.ok(table, "Unresolved LUT");
            for (const [indexes, target, isWritable] of [
              [lookup.writableIndexes, writable, true],
              [lookup.readonlyIndexes, readonly, false],
            ]) {
              for (const index of indexes) {
                assert.ok(table[index], "Unresolved LUT index");
                target.push({ address: table[index], signer: false, writable: isWritable });
              }
            }
          }
          accounts.push(...writable, ...readonly);
          assert.equal(message.instructions.length, captured.instructions.length);
          for (const [index, ix] of message.instructions.entries()) {
            const program = accounts[ix.programAddressIndex];
            assert.ok(program);
            const data = Buffer.from(ix.data ?? []);
            const resolved = Array.from(ix.accountIndices ?? [], (accountIndex) => {
              assert.ok(accounts[accountIndex], "Unresolved instruction account");
              return accounts[accountIndex];
            });
            const saved = captured.instructions[index];
            assert.equal(program.address, saved.program);
            assert.equal(data.toString("base64"), saved.dataBase64);
            assert.deepEqual(
              resolved.map((item) => item.address),
              saved.accounts
            );
            const definition =
              program.address === GMSOL_STORE_PROGRAM_ID
                ? storeIdlEvidence.idl.instructions.find((item) =>
                    Buffer.from(item.discriminator).equals(data.subarray(0, 8))
                  )
                : undefined;
            if (program.address === GMSOL_STORE_PROGRAM_ID) assert.ok(definition, "Unknown gmsol discriminator");
            const tag = definition
              ? data.subarray(0, 8).toString("hex")
              : program.address === "11111111111111111111111111111111"
                ? data.subarray(0, 4).toString("hex")
                : data.subarray(0, 1).toString("hex");
            const key = `${program.address}:${tag}`;
            if (!variants.has(key))
              variants.set(key, {
                program: program.address,
                name: definition?.name ?? null,
                discriminatorHex: tag,
                idlAccounts: definition?.accounts ?? null,
                observations: [],
              });
            if (saved.decodedArgs)
              assert.deepEqual(
                JSON.parse(
                  JSON.stringify(decodeOrderData(definition.name, data), (_, item) =>
                    typeof item === "bigint" ? item.toString() : item
                  )
                ),
                saved.decodedArgs
              );
            variants.get(key).observations.push({
              source: path,
              case: sample.name,
              transactionSha256: captured.sha256,
              instructionIndex: index,
              dataHex: data.toString("hex"),
              accounts: resolved,
            });
          }
          transactionCount++;
        }
  }
  return {
    scope: "unsigned-instruction-inventory",
    status: "observed",
    validator: "not-implemented",
    idlCommit: storeIdlEvidence.commit,
    idlSha256: storeIdlEvidence.sha256,
    transactionCount,
    sources,
    variants: Array.from(variants.values()),
  };
}

// A reproducible review artifact, not an executable signing policy.
export async function instructionContract(report) {
  const types = new Map();
  function collect(value) {
    if (!value || typeof value !== "object") return;
    if (value.defined) {
      const name = value.defined.name;
      if (!types.has(name)) {
        const definition = storeIdlEvidence.idl.types.find((item) => item.name === name);
        assert.ok(definition, "Missing IDL type");
        types.set(name, definition);
        collect(definition.type);
      }
    }
    for (const item of Object.values(value)) collect(item);
  }
  const instructions = report.variants.map((variant) => {
    const definition = storeIdlEvidence.idl.instructions.find((item) => item.name === variant.name);
    const externalAccounts = {
      "02": [],
      "03": [],
      "01": [
        ["payer", true, true],
        ["ata", false, true],
        ["owner", false, false],
        ["mint", false, false],
        ["system_program", false, false],
        ["token_program", false, false],
      ],
      "02000000": [
        ["source", true, true],
        ["destination", false, true],
      ],
      11: [["native_token_account", false, true]],
    }[variant.discriminatorHex];
    assert.ok(definition || externalAccounts, "Unknown external instruction layout");
    collect(definition?.args);
    return {
      program: variant.program,
      name:
        variant.name ??
        {
          "02": "SetComputeUnitLimit",
          "03": "SetComputeUnitPrice",
          "01": "CreateIdempotent",
          "02000000": "Transfer",
          11: "SyncNative",
        }[variant.discriminatorHex],
      discriminatorHex: variant.discriminatorHex,
      args: definition?.args ?? null,
      accounts:
        definition?.accounts.map((item) => ({
          name: item.name,
          signer: item.signer === true,
          writable: item.writable === true,
          optional: item.optional === true,
        })) ?? externalAccounts.map(([name, signer, writable]) => ({ name, signer, writable, optional: false })),
      accountCount: definition
        ? definition.name === "create_order_v2"
          ? "25 + params.swap_path_length"
          : definition.accounts.length
        : variant.observations[0].accounts.length,
      observedCount: variant.observations.length,
      observedDataLengths: [...new Set(variant.observations.map((item) => item.dataHex.length / 2))].sort(
        (a, b) => a - b
      ),
      observedAccountCounts: [...new Set(variant.observations.map((item) => item.accounts.length))].sort(
        (a, b) => a - b
      ),
      example: {
        source: variant.observations[0].source,
        case: variant.observations[0].case,
        transactionSha256: variant.observations[0].transactionSha256,
        instructionIndex: variant.observations[0].instructionIndex,
      },
    };
  });
  const fixture = JSON.parse(
    await readFile(new URL("../tools/solana-builder-probe/unsigned-fixtures.json", import.meta.url))
  );
  return {
    schemaVersion: 1,
    scope: "contract-for-offline-validator",
    status: "reviewable-supported-subset",
    validator: "not-implemented",
    rulesDocument: "docs/solana-instruction-contract.md",
    program: GMSOL_STORE_PROGRAM_ID,
    store: GMSOL_STORE_ADDRESS,
    idlCommit: report.idlCommit,
    idlSha256: report.idlSha256,
    sdk: fixture.sdk,
    wrapperSha256: fixture.wrapperSha256,
    inventorySha256: hash(await readFile(new URL(import.meta.url))),
    sources: report.sources,
    transactionCount: report.transactionCount,
    instructions,
    types: Array.from(types.values()),
    pending: [
      "production validator",
      "adversarial mutation fixtures",
      "prepare_position strict decoder",
      "CPI event contract",
      "live program and account compatibility",
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  inventory()
    .then((report) => (process.argv.includes("--contract") ? instructionContract(report) : report))
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack}\n`);
      process.exitCode = 1;
    });
}
