import { Caller } from "../../general/utils/caller";
import type {
	ApiReferralsCreateReferralLinkBody,
	ApiReferralsCreateReferralLinkResponse,
	ApiReferralsGetLinkedRefCodeBody,
	ApiReferralsGetLinkedRefCodeResponse,
	ApiReferralsGetRefCodeBody,
	ApiReferralsGetRefCodeResponse,
	ApiReferralsGetRefereesBody,
	ApiReferralsGetRefereesResponse,
	ApiReferralsIsRefCodeTakenBody,
	ApiReferralsIsRefCodeTakenResponse,
	ApiReferralsSetReferrerBody,
	ApiReferralsSetReferrerResponse,
	CallerConfig,
	SuiAddress,
	Timestamp,
} from "../../types";

/**
 * Provides HTTP access to Aftermath referral codes and referral relationships.
 *
 * Read and write methods send POST requests to the configured referrals API.
 * Authenticated methods require the wallet address, signed message bytes, and
 * matching signature in their input body.
 */
export class Referrals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/** Reserved referral configuration constants. This object is currently empty. */
	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a referrals HTTP client.
	 *
	 * @param config - Optional network, API host, access token, and API path.
	 */
	constructor(config?: CallerConfig) {
		super(config, "referrals");
	}

	// =========================================================================
	//  Fetching
	// =========================================================================

	/**
	 * Fetches the referral code owned by a wallet.
	 *
	 * The API receives the signed authentication fields in `inputs`. A JSON
	 * `null` referral code is returned to the caller as `undefined`.
	 *
	 * @param inputs - Wallet address and the bytes and signature of the signed
	 * authentication message.
	 * @returns The queried address and its referral code, if one exists.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getRefCode(
		inputs: ApiReferralsGetRefCodeBody
	): Promise<ApiReferralsGetRefCodeResponse> {
		// TODO: handle this better
		const res: {
			address: SuiAddress;
			refCode: string | null;
		} = await this.fetchApi("ref-code", inputs);
		return {
			...res,
			refCode: res.refCode === null ? undefined : res.refCode,
		};
	}

	/**
	 * Fetches the referral code linked to a wallet.
	 *
	 * A JSON `null` linked code or timestamp is returned to the caller as
	 * `undefined`.
	 *
	 * @param inputs - Wallet address and the bytes and signature of the signed
	 * authentication message.
	 * @returns The queried address, linked code, and link timestamp when present.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getLinkedRefCode(
		inputs: ApiReferralsGetLinkedRefCodeBody
	): Promise<ApiReferralsGetLinkedRefCodeResponse> {
		// TODO: handle this better
		const res: {
			address: SuiAddress;
			linkedRefCode: string | null;
			linkedAt: Timestamp | null;
		} = await this.fetchApi("linked-ref-code", inputs);
		return {
			...res,
			linkedRefCode: res.linkedRefCode === null ? undefined : res.linkedRefCode,
			linkedAt: res.linkedAt === null ? undefined : res.linkedAt,
		};
	}

	/**
	 * Fetches the referees linked to a referral code.
	 *
	 * Use `limit` to bound the returned page and `offset` to skip that many
	 * referees. The response's `totalCount` is the count before pagination.
	 *
	 * @param inputs - Referral code and optional page size and offset.
	 * @returns One page of referees and the total count for the code.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getReferees(
		inputs: ApiReferralsGetRefereesBody
	): Promise<ApiReferralsGetRefereesResponse> {
		return this.fetchApi("query", inputs);
	}

	/**
	 * Checks whether a referral code is available for use.
	 *
	 * @param inputs - Referral code to check.
	 * @returns The checked code and `isAvailable`, where `true` means that the
	 * code is available and `false` means that it is already taken.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async isRefCodeTaken(
		inputs: ApiReferralsIsRefCodeTakenBody
	): Promise<ApiReferralsIsRefCodeTakenResponse> {
		return this.fetchApi("availability", inputs);
	}

	// =========================================================================
	//  Actions
	// =========================================================================

	/**
	 * Creates a referral link for the authenticated wallet.
	 *
	 * This method sends the referral code in the request body together with the
	 * signed authentication fields.
	 *
	 * @param inputs - Wallet address, signed authentication data, and new code.
	 * @returns The created code, owner address, creation timestamp in
	 * milliseconds, and backend status.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async createReferralLink(
		inputs: ApiReferralsCreateReferralLinkBody
	): Promise<ApiReferralsCreateReferralLinkResponse> {
		return this.fetchApi("create", inputs);
	}

	/**
	 * Links the authenticated wallet to an existing referral code.
	 *
	 * @param inputs - Wallet address, signed authentication data, and code to link.
	 * @returns The referee address, linked code, creation timestamp in
	 * milliseconds, and backend status.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async setReferrer(
		inputs: ApiReferralsSetReferrerBody
	): Promise<ApiReferralsSetReferrerResponse> {
		return this.fetchApi("link", inputs);
	}

	// =========================================================================
	//  Messages to Sign
	// =========================================================================

	// public getRefCodeMessageToSign() {
	// 	return {
	// 		action: "GET_REF_CODE",
	// 		date: Date.now(),
	// 	};
	// }

	// public getLinkedRefCodeMessageToSign() {
	// 	return {
	// 		action: "GET_LINKED_REF_CODE",
	// 		date: Date.now(),
	// 	};
	// }

	/**
	 * Builds the legacy per-action message for creating a referral link.
	 *
	 * The returned object is local data and does not make a network request. The
	 * current API authenticates with the exact string from
	 * `UserData.createTermsAndConditionsMessage()` and receives `refCode` in the
	 * `createReferralLink` body.
	 *
	 * @param inputs - Referral code to include in the legacy message.
	 * @returns `{ action: "CREATE_REFERRAL", ref_code: inputs.refCode, date }`,
	 * where `date` is the current Unix time in seconds.
	 * @deprecated af-fe no longer accepts this per-action message. Sign
	 * `UserData.createTermsAndConditionsMessage` and pass `refCode` in the
	 * `createReferralLink` body instead.
	 */
	public createReferralLinkMessageToSign(inputs: { refCode: string }) {
		return {
			action: "CREATE_REFERRAL",
			ref_code: inputs.refCode,
			date: Math.round(Date.now() / 1000),
		};
	}

	/**
	 * Builds the legacy per-action message for linking a referral code.
	 *
	 * The returned object is local data and does not make a network request. The
	 * current API authenticates with the exact string from
	 * `UserData.createTermsAndConditionsMessage()` and receives `refCode` in the
	 * `setReferrer` body.
	 *
	 * @param inputs - Referral code to include in the legacy message.
	 * @returns `{ action: "LINK_REFERRAL", ref_code: inputs.refCode, date }`,
	 * where `date` is the current Unix time in seconds.
	 * @deprecated af-fe no longer accepts this per-action message. Sign
	 * `UserData.createTermsAndConditionsMessage` and pass `refCode` in the
	 * `setReferrer` body instead.
	 */
	public setReferrerMessageToSign(inputs: { refCode: string }) {
		return {
			action: "LINK_REFERRAL",
			ref_code: inputs.refCode,
			date: Math.round(Date.now() / 1000),
		};
	}
}
