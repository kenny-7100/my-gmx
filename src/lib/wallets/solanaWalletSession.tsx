import { Suspense, createContext, lazy, useContext, useState, type ReactNode } from "react";

export type SolanaConnectedWallet = {
  address: string;
  walletId: string;
  disconnect: () => Promise<void>;
};

export type SolanaWalletList = {
  ready: boolean;
  wallets: SolanaConnectedWallet[];
};

export type SolanaWalletSession = {
  address: string | undefined;
  disconnect: (() => Promise<void>) | undefined;
  isRestoring: boolean;
};

export type SolanaWalletSessionContextValue = SolanaWalletSession & {
  rememberConnectedWallet: (walletId: string | undefined) => void;
};

const defaultSession: SolanaWalletSessionContextValue = {
  address: undefined,
  disconnect: undefined,
  isRestoring: false,
  rememberConnectedWallet: () => undefined,
};

// The connection entry must wait until the lazy session has read the persisted selection.
const restoringSession: SolanaWalletSessionContextValue = {
  ...defaultSession,
  isRestoring: true,
};

export const SolanaWalletSessionContext = createContext<SolanaWalletSessionContextValue>(defaultSession);

const SolanaWalletSessionState = lazy(() => import("lib/solana/SolanaWalletSessionState"));

export function SolanaWalletSessionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? (
    <EnabledSolanaWalletSessionProvider>{children}</EnabledSolanaWalletSessionProvider>
  ) : (
    <SolanaWalletSessionContext.Provider value={defaultSession}>{children}</SolanaWalletSessionContext.Provider>
  );
}

function EnabledSolanaWalletSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(restoringSession);

  return (
    <SolanaWalletSessionContext.Provider value={session}>
      <Suspense fallback={null}>
        <SolanaWalletSessionState onChange={setSession} />
      </Suspense>
      {children}
    </SolanaWalletSessionContext.Provider>
  );
}

export function useSolanaWalletSession() {
  return useContext(SolanaWalletSessionContext);
}
