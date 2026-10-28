import { address, getBase64Encoder } from "@solana/kit";
import { AccountState, findAssociatedTokenPda, getTokenDecoder } from "@solana-program/token-2022";

import { SOLANA_TOKEN_2022_PROGRAM_ID, SOLANA_TOKEN_PROGRAM_ID } from "config/gmsol/program";
import { GMSOL_NATIVE_TOKEN, GMSOL_TOKENS } from "config/gmsol/tokens";

import { getSolanaRpc } from "./rpc";

export type SolanaBalances = Record<string, bigint>;
type BalanceToken = { address: string; tokenProgram: string };
type BalanceRpc = Pick<ReturnType<typeof getSolanaRpc>, "getMultipleAccounts">;

const MAX_ACCOUNTS_PER_REQUEST = 100;
const TOKEN_ACCOUNT_BASE_SIZE = 165;
const MAX_LAMPORTS = (1n << 64n) - 1n;
const balanceTokens = GMSOL_TOKENS.filter((token) => !token.isSynthetic);
const tokenDecoder = getTokenDecoder();

/** Reads configured ATAs only. Raw balances do not guarantee spendability. */
export async function fetchSolanaBalances(
  owner: string,
  { rpc = getSolanaRpc(), tokens = balanceTokens }: { rpc?: BalanceRpc; tokens?: readonly BalanceToken[] } = {}
): Promise<SolanaBalances> {
  const ownerAddress = address(owner);
  const seen = new Set<string>();
  const tokenAccounts = await Promise.all(
    tokens.map(async (token) => {
      const mint = address(token.address);
      if (seen.has(mint)) {
        throw new Error(`Duplicate Solana balance mint: ${mint}`);
      }
      seen.add(mint);
      if (token.tokenProgram !== SOLANA_TOKEN_PROGRAM_ID && token.tokenProgram !== SOLANA_TOKEN_2022_PROGRAM_ID) {
        throw new Error(`Unsupported Solana token program: ${token.tokenProgram}`);
      }
      const [ata] = await findAssociatedTokenPda({
        owner: ownerAddress,
        mint,
        tokenProgram: address(token.tokenProgram),
      });
      return { ...token, ata };
    })
  );
  const accounts = [ownerAddress, ...tokenAccounts.map((token) => token.ata)];
  const balances: SolanaBalances = {};

  for (let offset = 0; offset < accounts.length; offset += MAX_ACCOUNTS_PER_REQUEST) {
    const batch = accounts.slice(offset, offset + MAX_ACCOUNTS_PER_REQUEST);
    const { value } = await rpc.getMultipleAccounts(batch, { encoding: "base64", commitment: "confirmed" }).send();
    if (value.length !== batch.length) {
      throw new Error("Incomplete Solana balance response");
    }
    for (let index = 0; index < value.length; index++) {
      const account = value[index];
      const accountIndex = offset + index;
      if (accountIndex === 0) {
        const lamports = account === null ? 0n : account?.lamports;
        if (typeof lamports !== "bigint" || lamports < 0n || lamports > MAX_LAMPORTS) {
          throw new Error("Invalid Solana lamport balance");
        }
        balances[GMSOL_NATIVE_TOKEN.address] = lamports;
        continue;
      }

      const token = tokenAccounts[accountIndex - 1];
      if (account === null) {
        balances[token.address] = 0n;
        continue;
      }
      if (account.executable || account.owner !== token.tokenProgram || account.data[1] !== "base64") {
        throw new Error(`Invalid Solana token account: ${token.ata}`);
      }
      const data = getBase64Encoder().encode(account.data[0]);
      if (
        data.length < TOKEN_ACCOUNT_BASE_SIZE ||
        (token.tokenProgram === SOLANA_TOKEN_PROGRAM_ID && data.length !== TOKEN_ACCOUNT_BASE_SIZE)
      ) {
        throw new Error(`Invalid Solana token account size: ${token.ata}`);
      }
      const decoded = tokenDecoder.decode(data);
      if (
        decoded.mint !== token.address ||
        decoded.owner !== ownerAddress ||
        (decoded.state !== AccountState.Initialized && decoded.state !== AccountState.Frozen)
      ) {
        throw new Error(`Solana token account identity or state mismatch: ${token.ata}`);
      }
      balances[token.address] = decoded.amount;
    }
  }
  return balances;
}
