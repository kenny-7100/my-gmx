import { useCallback, useEffect, useLayoutEffect } from "react";
import { useHistory } from "react-router-dom";
import { cssTransition, ToastContainer } from "react-toastify";
import { zeroHash } from "viem";

import { isSolanaNetwork } from "config/chains";
import { REFERRAL_CODE_KEY } from "config/localStorage";
import { TOAST_AUTO_CLOSE_TIME } from "config/ui";
import { useSettings } from "context/SettingsContext/SettingsContextProvider";
import { useSmartWalletSubaccountWarning } from "context/SubaccountContext/useSmartWalletSubaccountWarning";
import { useTheme } from "context/ThemeContext/ThemeContext";
import { useMultichainFundingToast } from "domain/multichain/useMultichainFundingToast";
import { SupportChatEvmAttributes, useSupportChat } from "domain/supportChat/useSupportChat";
import { useChainId } from "lib/chains";
import { useRealChainIdWarning } from "lib/chains/useRealChainIdWarning";
import { dynamicActivate, locales } from "lib/i18n";
import { REFERRAL_CODE_QUERY_PARAM } from "lib/legacy";
import { useAccountInitedMetric, useOpenAppMetric } from "lib/metrics";
import { useConfigureMetrics } from "lib/metrics/useConfigureMetrics";
import { useFreshnessMetricsControl } from "lib/metrics/useFreshnessMetricsControl";
import { useWalletCapabilitiesMetric } from "lib/metrics/useWalletCapabilitiesMetric";
import { setMulticallEnabled } from "lib/multicall/lifecycle";
import { setEvmOracleEnabled } from "lib/oracleKeeperFetcher/lifecycle";
import { sendEarnPageViewEvent } from "lib/userAnalytics/earnEvents";
import { useConfigureUserAnalyticsProfile } from "lib/userAnalytics/useConfigureUserAnalyticsProfile";
import { useWalletConnectedUserAnalyticsEvent } from "lib/userAnalytics/useWalletConnectedEvent";
import useRouteQuery from "lib/useRouteQuery";
import useSearchParams from "lib/useSearchParams";
import { encodeReferralCode } from "sdk/utils/referrals";

import { CloseToastButton } from "components/CloseToastButton/CloseToastButton";
import { GmxAccountModal } from "components/GmxAccountModal/GmxAccountModal";
import { NotifyModal } from "components/NotifyModal/NotifyModal";
import { SettingsModal } from "components/SettingsModal/SettingsModal";
import { WhatsNewToastContainer } from "components/WhatsNewToast/WhatsNewToastContainer";

import { MainRoutes } from "./MainRoutes";

const Zoom = cssTransition({
  enter: "zoomIn",
  exit: "zoomOut",
  appendPosition: false,
  collapse: true,
  collapseDuration: 200,
});

function EvmGlobalEffects() {
  useWalletCapabilitiesMetric();
  useMultichainFundingToast();
  useSmartWalletSubaccountWarning();

  return <SupportChatEvmAttributes />;
}

export function AppRoutes() {
  const { theme } = useTheme();
  const history = useHistory();
  const { networkId } = useChainId();

  useLayoutEffect(() => {
    setMulticallEnabled(!isSolanaNetwork(networkId));
    setEvmOracleEnabled(!isSolanaNetwork(networkId));
  }, [networkId]);

  useConfigureMetrics();
  useConfigureUserAnalyticsProfile();
  useOpenAppMetric();
  useAccountInitedMetric();
  useSupportChat();

  useWalletConnectedUserAnalyticsEvent();
  useFreshnessMetricsControl();

  const query = useRouteQuery();

  useEffect(() => {
    const referralCode = query.get(REFERRAL_CODE_QUERY_PARAM);

    if (referralCode && referralCode.length <= 20) {
      const encodedReferralCode = encodeReferralCode(referralCode);
      if (encodedReferralCode !== zeroHash) {
        localStorage.setItem(REFERRAL_CODE_KEY, encodedReferralCode);
        const queryParams = new URLSearchParams(history.location.search);
        if (queryParams.has(REFERRAL_CODE_QUERY_PARAM)) {
          queryParams.delete(REFERRAL_CODE_QUERY_PARAM);
          history.replace({
            search: queryParams.toString(),
          });
        }
      }
    }
  }, [query, history]);

  const { isSettingsVisible, setIsSettingsVisible } = useSettings();

  const openSettings = useCallback(() => {
    setIsSettingsVisible(true);
  }, [setIsSettingsVisible]);

  const { lang, openChat } = useSearchParams<{ lang?: string; openChat?: string }>();

  const deleteSearchParam = useCallback(
    (param: string) => {
      const searchParams = new URLSearchParams(history.location.search);
      searchParams.delete(param);
      history.replace({
        pathname: history.location.pathname,
        search: searchParams.toString(),
      });
    },
    [history]
  );

  useEffect(() => {
    if (lang && Object.keys(locales).includes(lang)) {
      dynamicActivate(lang).then(() => {
        deleteSearchParam("lang");
      });
    }
  }, [lang, deleteSearchParam]);

  useEffect(() => {
    if (openChat) {
      deleteSearchParam("openChat");
    }
  }, [openChat, deleteSearchParam]);

  const isEarnPage = history.location.pathname.startsWith("/earn");
  useEffect(() => {
    if (isEarnPage) {
      sendEarnPageViewEvent();
    }
  }, [isEarnPage]);

  useRealChainIdWarning();

  return (
    <>
      <div className="App w-full">
        <MainRoutes openSettings={openSettings} />
      </div>
      <ToastContainer
        limit={1}
        transition={Zoom}
        position="bottom-right"
        autoClose={TOAST_AUTO_CLOSE_TIME}
        hideProgressBar={true}
        newestOnTop={false}
        closeOnClick={false}
        draggable={false}
        pauseOnHover
        theme={theme}
        icon={false}
        closeButton={CloseToastButton}
      />
      <WhatsNewToastContainer />
      {!isSolanaNetwork(networkId) && <EvmGlobalEffects />}
      <GmxAccountModal />
      <SettingsModal isSettingsVisible={isSettingsVisible} setIsSettingsVisible={setIsSettingsVisible} />
      <NotifyModal />
    </>
  );
}
