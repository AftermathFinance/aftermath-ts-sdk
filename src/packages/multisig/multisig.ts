// import { Caller } from "../../general/utils/caller";
// import { SuiNetwork } from "../../types";
// import { AftermathApi } from "../../general/providers";
// import { ApiMultisigUserBody } from "./multisigTypes";

// export class Multisig extends Caller {
// 	// =========================================================================
// 	//  Constructor
// 	// =========================================================================

// 	constructor(
// 		public readonly network?: SuiNetwork,
// 		private readonly Provider?: AftermathApi
// 	) {
// 		super(network, "multisig");
// 	}

// 	// =========================================================================
// 	//  API
// 	// =========================================================================

// 	/**
// 	 * Fetches API for multisig sign for user.
// 	 * @async
// 	 * @param { ApiMultisigUserBody } inputs - An object containing the users public key.
// 	 * @returns {Promise<MultisigBody>} A promise that resolves to object with multisig address and public key.
// 	 */
// 	public async getMultisigForUser(inputs: ApiMultisigUserBody) {
// 		return this.useProvider().fetchMultisigForUser(inputs);
// 	}

// 	// =========================================================================
// 	//  Private Helpers
// 	// =========================================================================

// 	private useProvider = () => {
// 		const provider = this.Provider?.Multisig();
// 		if (!provider) throw new Error("missing AftermathApi Provider");
// 		return provider;
// 	};
// }
