
import { SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { SuiAddress } from "../../types";
import { 
	ApiDCAsOwnedBody, 
	ApiDcaTransactionForCancelOrderBody,  
	DcaOrdersObject, 
	ApiDcaTransactionForCreateOrderBody
} from "./dcaTypes";
import { DcaIndexerOrderCancelRequest, DcaIndexerOrderCancelResponse } from "./api/dcaApiCastingTypes";
import { Transaction } from "@mysten/sui/transactions";

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

	public async getAllDcaOrders(inputs: ApiDCAsOwnedBody) {
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
	 * Fetches backend to stop / delay order execution on BE before executing canceling TX onchain.
	 * @async
	 * @param { ObjectId } inputs - An object containing the DCA object identificator.
	 * @returns {Promise<DcaIndexerOrderCancelResponse>} A promise that resolves to result of delaying
	 */
	public async createOrderExecutionPause(inputs: DcaIndexerOrderCancelRequest) {
		return this.fetchApi<
			DcaIndexerOrderCancelResponse,
			DcaIndexerOrderCancelRequest
		>("pause-order-execution", inputs);
	}

	// =========================================================================
	// Transactions
	// =========================================================================

	/**
	 * Fetches the API transaction for creating DCA order.
	 * @param inputs - The inputs for the transaction.
	 * @returns A promise that resolves with the API transaction.
	 */

    public async getCreateDcaOrderTx(inputs: ApiDcaTransactionForCreateOrderBody): Promise<Transaction> {
		return this.fetchApiTransaction<ApiDcaTransactionForCreateOrderBody>(
			"transactions/create-order",
			inputs
		);
	}

	/**
	 * Fetches the API transaction for canceling DCA order.
	 * @param inputs - The inputs for the transaction.
	 * @returns A promise that resolves with the API transaction.
	 */

	public async getCancelDcaOrderTx(inputs: ApiDcaTransactionForCancelOrderBody) {
		return this.useProvider().fetchBuildCancelOrderTx(inputs);
		// return this.fetchApiTransaction<ApiDcaTransactionForCancelOrderBody>(
		// 	"transactions/cancel-order",
		// 	inputs
		// );
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
