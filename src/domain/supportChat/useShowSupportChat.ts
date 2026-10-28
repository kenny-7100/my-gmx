import { useEffect, useRef } from "react";
import { useSessionStorage } from "react-use";
import { useAccount } from "wagmi";

import { isSolanaNetwork } from "config/chains";
import { SUPPORT_CHAT_LAST_CONNECTED_STATE_KEY } from "config/localStorage";
import { useChainId } from "lib/chains";
import { useLocalStorageSerializeKeySafe } from "lib/localStorage";
import useSearchParams from "lib/useSearchParams";
import { useSolanaWalletSession } from "lib/wallets/solanaWalletSession";
import { useIsWalletInitializing } from "lib/wallets/useIsWalletInitializing";

import { SUPPORT_CHAT_OPENED_WITHOUT_WALLET_SESSION_KEY } from "./constants";

export function useShowSupportChat() {
  const { networkId } = useChainId();
  const isSolana = isSolanaNetwork(networkId);
  const { isConnected: isEvmConnected } = useAccount();
  const isEvmInitializing = useIsWalletInitializing();
  const solanaWallet = useSolanaWalletSession();
  const isConnected = isSolana ? Boolean(solanaWallet.address) : isEvmConnected;
  const isWalletInitializing = isSolana ? solanaWallet.isRestoring : isEvmInitializing;
  const [lastConnectedState, setLastConnectedState] = useLocalStorageSerializeKeySafe<boolean>(
    isSolana ? undefined : SUPPORT_CHAT_LAST_CONNECTED_STATE_KEY,
    false,
    { readFromStorage: true }
  );

  const { openChat } = useSearchParams<{ openChat?: string }>();
  const shouldOpenChatOnBoot = useRef(Boolean(openChat)).current;
  const [wasOpenedWithoutWallet, setWasOpenedWithoutWallet] = useSessionStorage<boolean>(
    SUPPORT_CHAT_OPENED_WITHOUT_WALLET_SESSION_KEY,
    shouldOpenChatOnBoot
  );

  const showWhileConnecting = isWalletInitializing && (isSolana || lastConnectedState);

  const shouldShowSupportChat = isConnected || showWhileConnecting || wasOpenedWithoutWallet;

  useEffect(() => {
    if (shouldOpenChatOnBoot) {
      setWasOpenedWithoutWallet(true);
    }
  }, [shouldOpenChatOnBoot, setWasOpenedWithoutWallet]);

  useEffect(() => {
    if (isConnected) {
      setWasOpenedWithoutWallet(false);
    }
  }, [isConnected, setWasOpenedWithoutWallet]);

  useEffect(() => {
    if (!isSolana && !isWalletInitializing) {
      setLastConnectedState(isConnected);
    }
  }, [isSolana, isWalletInitializing, isConnected, setLastConnectedState]);

  return {
    shouldShowSupportChat,
    shouldOpenChatOnBoot,
  };
}
