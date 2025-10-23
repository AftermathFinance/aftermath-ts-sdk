import { Caller } from "../../general/utils/caller";
import {
	ApiReferralsCreateReferralLinkBody,
	ApiReferralsCreateReferralLinkResponse,
	CallerConfig,
	SuiAddress,
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
	//  Inspections
	// =========================================================================

	public async createReferralLink(
		inputs: ApiReferralsCreateReferralLinkBody
	): Promise<ApiReferralsCreateReferralLinkResponse> {
		return this.fetchApi("create", inputs);
	}
}
