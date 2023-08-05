// =========================================================================
//  General
// =========================================================================

import { SuiAddress } from "@mysten/sui.js";
import { Pool } from "..";
import { CoinType } from "../coin/coinTypes";
import { Slippage } from "../../types";

export interface ManagementLpInfo {
	protocol: ManagementProtocolName;
	withdrawCoinTypes: CoinType[];
}

const ManagementProtocolNames = ["Kriya"] as const;

export type ManagementProtocolName = (typeof ManagementProtocolNames)[number];

// =========================================================================
//  API
// =========================================================================

export interface ApiManagementTransferLpsBody {
	lpInfos: ManagementLpInfo[];
	pools: Pool[];
	walletAddress: SuiAddress;
	slippage: Slippage;
	referrer?: SuiAddress;
}

export interface ApiManagementOwnedLpsBody {
	walletAddress: SuiAddress;
}
