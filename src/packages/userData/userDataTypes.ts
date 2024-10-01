// =========================================================================
// API
// =========================================================================

import { SuiAddress } from "../../types";

// =========================================================================
// User Fetch
// =========================================================================

export type UserDataKeyType = "dca" | "limit";

export interface ApiUserDataCreateUserBody {
	key: UserDataKeyType;
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

export interface ApiUserDataOwnedBody {
	key: UserDataKeyType;
	walletAddress: SuiAddress;
}
