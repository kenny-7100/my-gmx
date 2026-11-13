# GMX-built gmsol WASM SDK

The app installs this directory through `file:vendor/gmsol-sdk`. The upstream
package name is retained for the existing type imports and Solana import-boundary
checks. The JavaScript bindings, declarations and WASM are built from source;
they are not copied from the published npm tarball.

Version `0.11.0-beta.1` matches `gmx-solana-interface` stable commit
[`27a26122`](https://github.com/gmsol-labs/gmx-solana-interface/blob/27a2612228a2f8cba0a0c9d450eff7b696898fbb/app/package.json#L54).
The npm release's `gitHead` identifies upstream source
[`7fe40082`](https://github.com/gmsol-labs/gmx-solana/commit/7fe4008292ffc09061f3a733ad9b5cd2e6235fa8).
The source revision, Cargo.lock checksum, tool versions and artifact SHA-256
checksums are recorded in `build.json`.

## Rebuild and verify

Install Rust 1.90.0 with the `wasm32-unknown-unknown` target and wasm-pack 0.15.1:

```sh
rustup toolchain install 1.90.0 --profile minimal --target wasm32-unknown-unknown
cargo +1.90.0 install wasm-pack --version 0.15.1 --locked
node scripts/build-gmsol-sdk.mjs
```

Run from the frontend repository root. The script fetches the pinned source into
a temporary directory, checks the source and Cargo.lock, builds the SDK with
`--release --target bundler --out-name index --scope gmsol-labs --no-opt -- --locked --features js`,
then compares all eight generated/distributed files with the committed bytes and
checksums. Upstream Rust release LTO remains enabled; `--no-opt` skips wasm-pack's
separately downloaded wasm-opt pass. wasm-bindgen 0.2.100 is fixed by Cargo.lock.
The script copies the upstream LICENSE and corrects its relative package path.
No protocol source changes are applied.

An existing clean checkout at the pinned revision can be reused:

```sh
node scripts/build-gmsol-sdk.mjs --source-dir /path/to/pinned/gmx-solana
```

The `Build gmsol WASM SDK` workflow runs the rebuild and comparison in GMX CI,
then builds the app's independent SDK artifact and retains both as CI artifacts.
Normal app builds only need the committed files and Node/Yarn; they do not need
Rust or network access to the upstream protocol repository.

## Deliberate upgrades

Update the source/version/toolchain inputs in `build.json`, then run the build
script with `--write` to regenerate the files and checksums. Review the generated
diff and upstream changes, update `GMSOL_SDK_WASM_SHA256` and increment
`GMSOL_SDK_ASSET_PATH` in `src/config/gmsol/sdk.ts`, and run `yarn install` to
refresh the file dependency checksum. Never format generated bindings.

`yarn build:gmsol-sdk` checks every installed file against `build.json` before
bundling the lazy SDK entry. The configured WASM hash must also match the manifest.
The app keeps its existing Solana flag gate and loads this artifact lazily.

Initial GMX WASM SHA-256:
`5dc8c8fe9d7172ed8987d6af94609e6c819fb27d82d6e5fc842279d9e58db396`.

Rebuilding and checking hashes establishes artifact provenance and integrity. It
does not establish mainnet program compatibility or replace FESOL-56's required
wallet signing, transaction landing and execution checks on this build.
