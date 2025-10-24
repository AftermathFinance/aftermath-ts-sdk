import { Caller } from "../../general/utils/caller";
import {
	ApiReferralsCreateReferralLinkBody,
	ApiReferralsCreateReferralLinkResponse,
	ApiReferralsGetRefereesBody,
	ApiReferralsGetRefereesResponse,
	ApiReferralsGetRefCodeBody,
	ApiReferralsGetRefCodeResponse,
	ApiReferralsSetReferrerBody,
	ApiReferralsSetReferrerResponse,
	CallerConfig,
	ApiReferralsIsRefCodeTakenBody,
	ApiReferralsIsRefCodeTakenResponse,
} from "../../types";

export class Referrals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config?: CallerConfig) {
		super(config, "referrals");
	}

	// =========================================================================
	//  Fetching
	// =========================================================================

	public async getRefCode(
		inputs: ApiReferralsGetRefCodeBody
	): Promise<ApiReferralsGetRefCodeResponse> {
		return this.fetchApi("ref-code", inputs);
	}

	public async getReferees(
		inputs: ApiReferralsGetRefereesBody
	): Promise<ApiReferralsGetRefereesResponse> {
		return this.fetchApi("referees", inputs);
	}

	public async isRefCodeTaken(
		inputs: ApiReferralsIsRefCodeTakenBody
	): Promise<ApiReferralsIsRefCodeTakenResponse> {
		return this.fetchApi("is-ref-code-taken", inputs);
	}

	// =========================================================================
	//  Actions
	// =========================================================================

	public async createReferralLink(
		inputs: ApiReferralsCreateReferralLinkBody
	): Promise<ApiReferralsCreateReferralLinkResponse> {
		return this.fetchApi("create-referral-link", inputs);
	}

	public async setReferrer(
		inputs: ApiReferralsSetReferrerBody
	): Promise<ApiReferralsSetReferrerResponse> {
		return this.fetchApi("set-referrer", inputs);
	}

	// =========================================================================
	//  Messages to Sign
	// =========================================================================

	public createReferralLinkMessageToSign() {
		return {
			action: "CREATE_REFERRAL_LINK",
		};
	}

	public setReferrerMessageToSign() {
		return {
			action: "SET_REFERRER",
		};
	}
}
