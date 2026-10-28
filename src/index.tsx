import { showAppLoadError } from "lib/appStartup";
import { startUiFlagsPrefetch } from "lib/oracleKeeperFetcher/uiFlagsPrefetch";
import { getIsReloadingFromNetwork } from "lib/pwa/recoveryNavigation";
import { registerPreloadErrorRecovery } from "lib/pwa/registerPreloadErrorRecovery";

registerPreloadErrorRecovery();
startUiFlagsPrefetch();

void import("./App/bootstrap")
  .then(({ bootstrap }) => bootstrap())
  .catch((error: unknown) => {
    if (!getIsReloadingFromNetwork()) {
      showAppLoadError(error);
    }
  });
