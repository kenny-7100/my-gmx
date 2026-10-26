import { afterAll } from "vitest";

import guard from "../gmx-api-offline/network-guard.cjs";

afterAll(guard.installNetworkGuard("sdk"));
