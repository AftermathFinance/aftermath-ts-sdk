
import { ApiIndexerUserEventsBody, ObjectId, SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { SuiAddress } from "../../types";
import { 
	ApiDCAsOwnedBody, 
	ApiDcaCancelOrderBody, 
	ApiDcaInitializeOrderBody, 
	DcaOrdersObject, 
	DcaOrderObject, 
	DcaCreatedOrderEvent 
} from "./dcaTypes";

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

	/**
	 * Fetches the API for dollar cost averaging orders list.
	 * @async
	 * @param { ApiDCAsOwnedBody } inputs - An object containing the walletAddress.
	 * @returns { Promise<DcaOrdersObject> } A promise that resolves to object with array of fetched events for active and past dca's.
	 */

	public async getAllDcaOrdersObject(inputs: ApiDCAsOwnedBody) {
		return this.fetchApi<DcaOrdersObject, ApiDCAsOwnedBody>("", inputs);
	}

	/**
	 * Fetches the API for dollar cost averaging active orders list.
	 * @async
	 * @param { ApiDCAsOwnedBody } inputs - An object containing the walletAddress.
	 * @returns {Promise<DcaOrdersObject>} A promise that resolves to object with array of fetched events for active dca's.
	 */

    public async getActiveDcaOrders(inputs: { walletAddress: SuiAddress; }) {
        return this.fetchApi<DcaOrdersObject, ApiDCAsOwnedBody>("owned-active-orders", inputs);
    }

	/**
	 * Fetches the API for dollar cost averaging past orders list.
	 * @async
	 * @param { ApiDCAsOwnedBody } inputs - An object containing the walletAddress.
	 * @returns {Promise<DcaOrdersObject>} A promise that resolves to object with array of fetched events for past dca's.
	 */

    public async getPastDcaOrders(inputs: { walletAddress: SuiAddress; }) {
        return this.fetchApi<DcaOrdersObject, ApiDCAsOwnedBody>("owned-past-orders", inputs);
    }

	/**
	 * Fetches the API for dollar cost averaging orders by id.
	 * @async
	 * @param { ObjectId } inputs - An object containing the DCA object identificator.
	 * @returns {Promise<DcaOrderObject>} A promise that resolves to concrete dca order object.
	 */

	public async getDcaOrderObject(inputs: { objectId: ObjectId }) {
		return await this.fetchApi<DcaOrderObject>(inputs.objectId);
	}

	// =========================================================================
	// Transactions
	// =========================================================================

	/**
	 * Fetches the API transaction for creating DCA order.
	 * @param inputs - The inputs for the transaction.
	 * @returns A promise that resolves with the API transaction.
	 */

    public async getCreateDcaOrderTx(inputs: ApiDcaInitializeOrderBody) {
		return this.useProvider().fetchBuildCreateOrderTx(inputs);
	}

	/**
	 * Fetches the API transaction for canceling DCA order.
	 * @param inputs - The inputs for the transaction.
	 * @returns A promise that resolves with the API transaction.
	 */

	public async getCancelDcaOrderTx(inputs: ApiDcaCancelOrderBody) {
		return this.useProvider().fetchBuildCancelOrderTx(inputs);
	}

	// =========================================================================
	// Events
	// =========================================================================

	public async getOrdersEvents(inputs: ApiIndexerUserEventsBody) {
		return this.fetchApiEvents<
			DcaCreatedOrderEvent,
			ApiIndexerUserEventsBody
		>("events", inputs);
	}

	// =========================================================================
	// Helpers
	// =========================================================================

	/**
	 * Fetches address by SuiNS domain
	 * @async
	 * @param string domainName - An object containing the walletAddress.
	 * @returns {Promise<string | undefined | null>} A promise that resolves to a 
	 * string object with wallet address if it exist
	 */

	public async getNameServiceAddress(domainName: string): Promise<string | undefined | null> {
		return this.Provider?.provider.resolveNameServiceAddress({
			name: domainName
		});
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
