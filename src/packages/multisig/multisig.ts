import { Caller } from "../../general/utils/caller";
import { CallerConfig, SuiNetwork } from "../../types";
import { AftermathApi } from "../../general/providers";
import { ApiMultisigUserBody } from "./multisigTypes";

/**
 * The `Multisig` class provides methods to interact with multisig-related functionality,
 * such as retrieving a multisig address and associated public key for a user.
 */
export class Multisig extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of `Multisig`.
	 *
	 * @param config - Optional configuration for the `Caller`, including network and access token.
	 * @param Provider - An optional instance of `AftermathApi` to build or fetch multisig data.
	 */
	constructor(
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "multisig");
	}

	// =========================================================================
	//  API
	// =========================================================================

	/**
	 * Retrieves a multisig address and corresponding public key for a user based on their
	 * provided single public key.
	 *
	 * @param inputs - An object implementing `ApiMultisigUserBody`, containing the user's public key as a `Uint8Array`.
	 * @returns A promise that resolves to an object containing both the multisig address and its public key.
	 *
	 * @example
	 * ```typescript
	 *
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // initialize provider
	 *
	 * const multisig = afSdk.Multisig();
	 *
	 * const data = await multisig.getMultisigForUser({
	 *   userPublicKey: myPublicKeyBytes
	 * });
	 * console.log(data.address, data.publicKey);
	 * ```
	 */
	public getMultisigForUser(inputs: ApiMultisigUserBody) {
		return this.useProvider().getMultisigForUser(inputs);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Internal helper to get the configured `Multisig` provider from `AftermathApi`.
	 * Throws an error if the provider is not available.
	 */
	private useProvider = () => {
		const provider = this.Provider?.Multisig();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
