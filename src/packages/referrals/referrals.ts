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
	ApiReferralsGetLinkedRefCodeBody,
	ApiReferralsGetLinkedRefCodeResponse,
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

	public async getLinkedRefCode(
		inputs: ApiReferralsGetLinkedRefCodeBody
	): Promise<ApiReferralsGetLinkedRefCodeResponse> {
		return this.fetchApi("linked-ref-code", inputs);
	}

	public async getReferees(
		inputs: ApiReferralsGetRefereesBody
	): Promise<ApiReferralsGetRefereesResponse> {
		return this.fetchApi("query", inputs);
	}

	public async isRefCodeTaken(
		inputs: ApiReferralsIsRefCodeTakenBody
	): Promise<ApiReferralsIsRefCodeTakenResponse> {
		return this.fetchApi("availability", inputs);
	}

	// =========================================================================
	//  Actions
	// =========================================================================

	public async createReferralLink(
		inputs: ApiReferralsCreateReferralLinkBody
	): Promise<ApiReferralsCreateReferralLinkResponse> {
		return this.fetchApi("create", inputs);
	}

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

	public createReferralLinkMessageToSign(inputs: { refCode: string }) {
		return {
			action: "CREATE_REFERRAL",
			ref_code: inputs.refCode,
			date: Math.round(Date.now() / 1000),
		};
	}

	public setReferrerMessageToSign(inputs: { refCode: string }) {
		return {
			action: "LINK_REFERRAL",
			ref_code: inputs.refCode,
			date: Math.round(Date.now() / 1000),
		};
	}
}
