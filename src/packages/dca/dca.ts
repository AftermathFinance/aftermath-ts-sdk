
import { EventsInputs, SuiNetwork, Url, ObjectId } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";

import { SuiAddress } from "../../types";
import { ApiDcaInitializeVaultBody } from "./dcaTypes";

export class Dca extends Caller {
	
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "dca");
	}

	// =========================================================================
	//  Public
	// =========================================================================

    public async getActiveDcaOrders(inputs: {
        walletAddress: SuiAddress;
    }) {
        return inputs;
    }

    public async getPastDcaOrders(inputs: {
        walletAddress: SuiAddress;
    }) {
        return inputs;
    }

    public async getCreateDcaVaultTx(
		inputs: ApiDcaInitializeVaultBody
	) {
		return this.useProvider().fetchBuildCreateVault(inputs);
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

    // =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Dca();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
