
import { EventsInputs, SuiNetwork, Url, ObjectId, AnyObjectType } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";

import { SuiAddress } from "../../types";
import { ApiDCAsOwnedBody, ApiDcaCancelOrderBody, ApiDcaInitializeOrderBody, DcaOrdersOjbect } from "./dcaTypes";

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
	//  Class Objects
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

	public async getDcaOrdersObject(inputs: ApiDCAsOwnedBody) {
		return this.fetchApi<DcaOrdersOjbect, ApiDCAsOwnedBody>("", inputs);
	}

	// =========================================================================
	// Transactions
	// =========================================================================

    public async getCreateDcaOrderTx(
		inputs: ApiDcaInitializeOrderBody
	) {
		return this.useProvider().fetchBuildCreateOrderTx(inputs);
	}

	public async getCancelDcaOrderTx(
		inputs: ApiDcaCancelOrderBody
	) {
		return this.useProvider().fetchBuildCancelOrderTx(inputs);
	}

    // =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Dca();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
