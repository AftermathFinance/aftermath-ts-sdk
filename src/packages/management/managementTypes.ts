// =========================================================================
//  General
// =========================================================================

import { CoinType } from "../coin/coinTypes";

export interface ManagementWithdrawLpInfo {
	protocol: ManagementProtocolName;
	withdrawCoinTypes: CoinType[];
}

const ManagementProtocolNames = ["Kriya"] as const;

export type ManagementProtocolName = (typeof ManagementProtocolNames)[number];

// =========================================================================
//  API
// =========================================================================
