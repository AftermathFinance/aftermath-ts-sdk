import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import { CallerConfig, SuiAddress, SuiNetwork, Url } from "../../types";

/**
 * The `ReferralVault` class provides functionality for querying and managing
 * referral information within the Aftermath protocol. It allows you to look
 * up the referrer for a given address.
 */
export class ReferralVault extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Contains static configuration relevant to the referral system, if any.
	 * Currently empty but can be extended for future needs.
	 */
	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of `ReferralVault` to interact with referral-related
	 * features in the Aftermath protocol.
	 *
	 * @param config - Optional caller configuration, including Sui network and access token.
	 * @param Provider - An optional `AftermathApi` provider instance for referral-specific methods.
	 */
	constructor(
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "referral-vault");
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Retrieves the referrer address for a specified referee (user).
	 *
	 * @param inputs - An object containing the `referee` Sui address.
	 * @returns A promise that resolves to either the referrer's `SuiAddress` or the string `"None"` if no referrer exists.
	 *
	 * @example
	 * ```typescript
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // initialize provider
	 *
	 * const referralVault = afSdk.ReferralVault();
	 *
	 * const referrer = await referralVault.getReferrer({ referee: "0x<user_address>" });
	 * console.log("Referrer address:", referrer);
	 * ```
	 */
	public async getReferrer(inputs: {
		referee: SuiAddress;
	}): Promise<SuiAddress | "None"> {
		return this.fetchApi(`${inputs.referee}/referrer`);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Internal helper to retrieve the configured `ReferralVault` provider from
	 * `AftermathApi`, throwing an error if not defined.
	 */
	private useProvider = () => {
		const provider = this.Provider?.ReferralVault();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
