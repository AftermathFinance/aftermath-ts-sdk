import { SuiAddress, Timestamp } from "../../types";

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  General
// =========================================================================

export interface RateLimit {
	p: string;
	m:
		| { GET: { l: number } }
		| { POST: { l: number } }
		| { GET: { l: number }; POST: { l: number } };
}

// =========================================================================
//  Bodies
// =========================================================================

export interface ApiCreateAuthAccountBody {
	walletAddress: SuiAddress;
	signature: string;
	serializedJson: string;
}

export interface ApiGetAccessTokenBody {
	walletAddress: SuiAddress;
	signature: string;
	serializedJson: string;
}

// =========================================================================
//  Responses
// =========================================================================

export interface ApiGetAccessTokenResponse {
	accessToken: string;
	header: string;
	expirationTimestamp: Timestamp;
}
