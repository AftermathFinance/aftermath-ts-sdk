import { SuiAddress, Timestamp } from "../../types";

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
}

export interface ApiReferralsGetRefCodeResponse {
	/**
	 * The referral code of queried wallet address
	 */
	refCode: string;
}

export interface ApiReferralsGetRefereesBody {
	/**
	 * Ref code to get referees for
	 */
	refCode: string;
}

export interface ApiReferralsGetRefereesResponse {
	/**
	 * The referral code queried
	 */
	refCode: string;
	/**
	 * The referrer's wallet address
	 */
	referrerAddress: SuiAddress;
	/**
	 * List of referees
	 */
	referees: ReferralsRefereeInfo[];
}

export interface ApiReferralsIsRefCodeTakenBody {
	/**
	 * The referral code queried if taken
	 */
	refCode: string;
}

export interface ApiReferralsIsRefCodeTakenResponse {
	/**
	 * True if the ref code is already claimed by a user
	 */
	isTaken: boolean;
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
	/**
	 * Optional custom ref code (if not provided, will be auto-generated)
	 */
	refCode: string | undefined;
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
	/**
	 * Ref code for referral to link
	 */
	refCode: string;
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
