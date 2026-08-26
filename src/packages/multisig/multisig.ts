import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig } from "../../types";
import type { ApiMultisigUserBody } from "./multisigTypes";

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
	 * @param api - An optional instance of `AftermathApi` to build or fetch multisig data.
	 */
	constructor(
		config?: CallerConfig,
		/** Optional low-level provider used to derive multisig data. */
		public readonly api?: AftermathApi
	) {
		super(config, "multisig");
	}

	// =========================================================================
	//  API
	// =========================================================================

	/**
	 * Derives a multisig address and public key for a user from the configured
	 * shared-custody key and the user's Ed25519 public key.
	 *
	 * The operation is local after the `AftermathApi` provider is configured. It
	 * does not make a network request or sign a transaction.
	 *
	 * @param inputs - An object implementing `ApiMultisigUserBody`, containing the user's public key as a `Uint8Array`.
	 * @returns An object containing the derived multisig address and public key.
	 * @throws `Error` when no `AftermathApi` provider was supplied or the public
	 * key is malformed.
	 *
	 * @example
	 * ```typescript
	 *
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
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
		return this.multisigApi().getMultisigForUser(inputs);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Internal helper to get the configured `Multisig` provider from `AftermathApi`.
	 * Throws an error if the provider is not available.
	 */
	private readonly multisigApi = () => {
		const multisig = this.api?.Multisig();
		if (!multisig) {
			throw new Error("missing AftermathApi instance");
		}
		return multisig;
	};
}
