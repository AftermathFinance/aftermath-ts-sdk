import { SuiAddress, Timestamp } from "../../types.ts";

// =========================================================================
//  Data
// =========================================================================

export interface ReferralsRefereeInfo {
	/**
	 *  The wallet address of the referee
	 */
	walletAddress: SuiAddress;
	/**
	 *  When the referee joined via this ref link
	 */
	joinedAt: Timestamp;
}

// =========================================================================
//  API
// =========================================================================

export interface ApiReferralsGetRefCodeBody {
	/**
	 *  The wallet address to get referral code of
	 */
	walletAddress: SuiAddress;
	/**
	 * The bytes of the message signed by the user's wallet. Required for authentication.
	 */
	bytes: string;
	/**
	 * The signature of the message signed by the user's wallet. Required for authentication.
	 */
	signature: string;
}

export interface ApiReferralsGetRefCodeResponse {
	/**
	 *  The wallet address queried
	 */
	address: SuiAddress;
	/**
	 * The referral code of queried wallet address
	 */
	refCode: string | undefined;
}

export interface ApiReferralsGetLinkedRefCodeBody {
	/**
	 *  The wallet address to get linked referral code of
	 */
	walletAddress: SuiAddress;
	/**
	 * The bytes of the message signed by the user's wallet. Required for authentication.
	 */
	bytes: string;
	/**
	 * The signature of the message signed by the user's wallet. Required for authentication.
	 */
	signature: string;
}

export interface ApiReferralsGetLinkedRefCodeResponse {
	/**
	 *  The wallet address queried
	 */
	address: SuiAddress;
	/**
	 * The referral code linked to the queried wallet address
	 */
	linkedRefCode: string | undefined;
	/**
	 * Timestamp when the referral link was created (None if not linked)
	 */
	linkedAt: Timestamp | undefined;
}

export interface ApiReferralsGetRefereesBody {
	/**
	 * Ref code to get referees for
	 */
	refCode: string;
	limit?: number;
	offset?: number;
}

export interface ApiReferralsGetRefereesResponse {
	/**
	 * The referral code queried
	 */
	refCode: string;
	/**
	 * List of referees
	 */
	referees: ReferralsRefereeInfo[];
	/**
	 * Total number of referees (before pagination)
	 */
	totalCount: number;
}

export interface ApiReferralsIsRefCodeTakenBody {
	/**
	 * The referral code queried if taken
	 */
	refCode: string;
}

export interface ApiReferralsIsRefCodeTakenResponse {
	/**
	 * The referral code that was checked
	 */
	refCode: string;
	/**
	 * Whether this ref code is available for use (true = available, false = taken)
	 */
	isAvailable: boolean;
}

export interface ApiReferralsCreateReferralLinkBody {
	/**
	 * The wallet address of the user creating the ref link. Required for authentication.
	 */
	walletAddress: SuiAddress;
	/**
	 * The bytes of the message signed by the user's wallet. Required for authentication.
	 */
	bytes: string;
	/**
	 * The signature of the message signed by the user's wallet. Required for authentication.
	 */
	signature: string;
}

export interface ApiReferralsCreateReferralLinkResponse {
	/**
	 * The unique referral code/ID
	 */
	refCode: string;
	/**
	 * The wallet address of the referrer
	 */
	walletAddress: SuiAddress;
	/**
	 * Timestamp when the ref link was created
	 */
	createdAt: Timestamp;
	/**
	 * Status of the creation
	 */
	status: string;
}

export interface ApiReferralsSetReferrerBody {
	/**
	 * The wallet address of the referee. Required for authentication.
	 */
	walletAddress: SuiAddress;
	/**
	 * The bytes of the message signed by the referee's wallet. Required for authentication.
	 */
	bytes: string;
	/**
	 * The signature of the message signed by the referee's wallet. Required for authentication.
	 */
	signature: string;
}

export interface ApiReferralsSetReferrerResponse {
	/**
	 * The wallet address of the referee
	 */
	refereeAddress: SuiAddress;
	/**
	 * The referral code used
	 */
	refCode: string;
	/**
	 * Timestamp when the referral relationship was established
	 */
	createdAt: Timestamp;
	/**
	 * Status of the operation
	 */
	status: string;
}
