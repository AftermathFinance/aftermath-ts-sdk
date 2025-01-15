import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import { CallerConfig, SuiAddress, SuiNetwork, Url } from "../../types";

export class ReferralVault extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "referral-vault");
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getReferrer(inputs: {
		referee: SuiAddress;
	}): Promise<SuiAddress | "None"> {
		return this.fetchApi(`${inputs.referee}/referrer`);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.ReferralVault();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
