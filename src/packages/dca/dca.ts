
import { ObjectId, SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { SuiAddress } from "../../types";
import { 
	ApiDCAsOwnedBody, 
	DcaOrdersObject, 
	ApiDcaTransactionForCreateOrderBody,
	ApiDcaTransactionForCloseOrderBody
} from "./dcaTypes";
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
	 * Fetches the API for canceling DCA order.
	 * @param inputs - The inputs for the transaction.
	 * @returns A promise that resolves with transaction execution status.
	 */

	public async closeDcaOrder(
		inputs: ApiDcaTransactionForCloseOrderBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiDcaTransactionForCloseOrderBody>(
			`ineractions/close-order`,
			inputs
		);
	}

	/**
	 * Method for getting the message to sign.
	 * @param inputs - The inputs for the transaction.
	 * @returns A promise that resolves with transaction execution status.
	 */

	public closeDcaOrderMessageToSign(inputs: {
		orderId: ObjectId;
		walletAddress: SuiAddress;
	}): {
		order_object_id: string;
		wallet_address: SuiAddress;
	} {
		return {
			order_object_id: inputs.orderId,
			wallet_address: inputs.walletAddress,
		};
	}
}
