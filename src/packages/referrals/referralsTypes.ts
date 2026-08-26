import type { SuiAddress, Timestamp } from "../../types";

// =========================================================================
//  Data
// =========================================================================

/** A wallet that joined through a referral code. */
export interface ReferralsRefereeInfo {
	/**
	 * The wallet address of the referred user.
	 */
	walletAddress: SuiAddress;
	/**
	 * Unix timestamp, in milliseconds, when the user joined through the code.
	 */
	joinedAt: Timestamp;
}

// =========================================================================
//  API
// =========================================================================

/** Request body for fetching a wallet's referral code. */
export interface ApiReferralsGetRefCodeBody {
	/**
	 * The wallet address whose referral code to fetch.
	 */
	walletAddress: SuiAddress;
	/**
	 * Serialized bytes of the message signed by the wallet for authentication.
	 */
	bytes: string;
	/**
	 * Signature corresponding to `bytes`.
	 */
	signature: string;
}

/** Response containing a wallet's referral code, when one exists. */
export interface ApiReferralsGetRefCodeResponse {
	/**
	 * The wallet address queried.
	 */
	address: SuiAddress;
	/**
	 * The wallet's referral code, or `undefined` when no code is linked.
	 */
	refCode: string | undefined;
}

/** Request body for fetching the referral code linked to a wallet. */
export interface ApiReferralsGetLinkedRefCodeBody {
	/**
	 * The wallet address whose linked referral code to fetch.
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

/** Response containing the referral code linked to a wallet, when one exists. */
export interface ApiReferralsGetLinkedRefCodeResponse {
	/**
	 *  The wallet address queried
	 */
	address: SuiAddress;
	/**
	 * The referral code linked to the queried wallet address, or `undefined`.
	 */
	linkedRefCode: string | undefined;
	/**
	 * Unix timestamp, in milliseconds, when the link was created, or `undefined`
	 * when no code is linked.
	 */
	linkedAt: Timestamp | undefined;
}

/** Request body for one page of referees for a referral code. */
export interface ApiReferralsGetRefereesBody {
	/**
	 * Referral code whose referees to fetch.
	 */
	refCode: string;
	/** Maximum number of referees to return in this page. */
	limit?: number;
	/** Number of referees to skip before this page. */
	offset?: number;
}

/** Response containing one page of referees and the unpaginated total count. */
export interface ApiReferralsGetRefereesResponse {
	/**
	 * The referral code queried.
	 */
	refCode: string;
	/**
	 * Referees returned for the requested page.
	 */
	referees: ReferralsRefereeInfo[];
	/**
	 * Total number of referees for the code before applying `limit` and `offset`.
	 */
	totalCount: number;
}

/** Request body for checking referral-code availability. */
export interface ApiReferralsIsRefCodeTakenBody {
	/**
	 * Referral code to check.
	 */
	refCode: string;
}

/** Response containing a referral-code availability result. */
export interface ApiReferralsIsRefCodeTakenResponse {
	/**
	 * Referral code that was checked.
	 */
	refCode: string;
	/**
	 * `true` when the code is available for use, or `false` when it is taken.
	 */
	isAvailable: boolean;
}

/** Request body for creating a referral link for a wallet. */
export interface ApiReferralsCreateReferralLinkBody {
	/**
	 * Wallet address of the user creating the link.
	 */
	walletAddress: SuiAddress;
	/**
	 * Serialized bytes of the message signed by the wallet for authentication.
	 */
	bytes: string;
	/**
	 * Signature corresponding to `bytes`.
	 */
	signature: string;
	/**
	 * Referral code to create. The current signed terms message does not carry
	 * this code, so the code travels in the body.
	 */
	refCode: string;
}

/** Response returned after creating a referral link. */
export interface ApiReferralsCreateReferralLinkResponse {
	/**
	 * The created referral code.
	 */
	refCode: string;
	/**
	 * Wallet address of the referrer.
	 */
	walletAddress: SuiAddress;
	/**
	 * Unix timestamp, in milliseconds, when the link was created.
	 */
	createdAt: Timestamp;
	/**
	 * Backend status for the creation result.
	 */
	status: string;
}

/** Request body for linking a wallet to an existing referral code. */
export interface ApiReferralsSetReferrerBody {
	/**
	 * Wallet address of the user being linked.
	 */
	walletAddress: SuiAddress;
	/**
	 * Serialized bytes of the message signed by the wallet for authentication.
	 */
	bytes: string;
	/**
	 * Signature corresponding to `bytes`.
	 */
	signature: string;
	/**
	 * Referral code to link. The current signed terms message does not carry the
	 * code, so the code travels in the body.
	 */
	refCode: string;
}

/** Response returned after linking a wallet to a referral code. */
export interface ApiReferralsSetReferrerResponse {
	/**
	 * Wallet address of the referred user.
	 */
	refereeAddress: SuiAddress;
	/**
	 * Referral code used for the link.
	 */
	refCode: string;
	/**
	 * Unix timestamp, in milliseconds, when the relationship was established.
	 */
	createdAt: Timestamp;
	/**
	 * Backend status for the link result.
	 */
	status: string;
}
