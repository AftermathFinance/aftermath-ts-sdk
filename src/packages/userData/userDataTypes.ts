import { SuiAddress } from "../../types";

// =========================================================================
// User Fetch
// =========================================================================

export interface ApiUserDataCreateUserBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

export interface ApiUserDataPublicKeyBody {
	walletAddress: SuiAddress;
}
