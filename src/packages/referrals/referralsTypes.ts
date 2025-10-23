import { SuiAddress, Timestamp } from "../../types";

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
	walletAddress: string;
	/**
	 * Timestamp when the ref link was created
	 */
	createdAt: Timestamp;
	/**
	 * Status of the creation
	 */
	status: string;
}
