
import { EventsInputs, SuiNetwork, Url, ObjectId, AnyObjectType } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";

import { SuiAddress } from "../../types";
import { ApiDCAsOwnedBody, ApiDcaInitializeOrderBody, DcaOrdersOjbect } from "./dcaTypes";

export class Dca extends Caller {
	
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "dca");
		// this.test();
	}

	private test = async () => {
		const body: ApiDCAsOwnedBody = {
			walletAddress: "0x45c7d4f327ec05e35ced427b44241dd932e7c8532b5d3791fe0e5c7277ce3c4a"
		}
        const dcaOrders = await this.fetchApi<DcaOrdersOjbect, ApiDCAsOwnedBody>("", body);
        console.log({
			dcaOrders: dcaOrders
		});
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

	public async getDcaVaults(inputs: {
        walletAddress: SuiAddress;
    }) {
		return this.useProvider().fetchDcaOrdersObject(inputs)
	}

    public async getCreateDcaVaultTx(
		inputs: ApiDcaInitializeOrderBody
	) {
		console.log("getCreateDcaVaultTx")
		return this.useProvider().fetchBuildCreateOrder(inputs);
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
