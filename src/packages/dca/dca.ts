import { ObjectId, SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { SuiAddress } from "../../types";
import {
	ApiDCAsOwnedBody,
	DcaOrdersObject,
	ApiDcaTransactionForCreateOrderBody,
	ApiDcaTransactionForCloseOrderBody,
	DcaOrderObject,
	ApiDcaCreateUserBody,
	ApiDcaUser,
} from "./dcaTypes";
import { Transaction } from "@mysten/sui/transactions";
import { DcaIndexerUserResponse } from "./api/dcaApiCastingTypes";

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
	 * @returns { Promise<DcaOrderObject[]> } A promise that resolves to object with array of fetched events for active dca's.
	 */

	public async getActiveDcaOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<DcaOrderObject[], ApiDCAsOwnedBody>(
			"owned-active-orders",
			inputs
		);
	}

	/**
	 * Fetches the API for dollar cost averaging past orders list.
	 * @async
	 * @param { ApiDCAsOwnedBody } inputs - An object containing the walletAddress.
	 * @returns { Promise<DcaOrderObject[]> } A promise that resolves to object with array of fetched events for past dca's.
	 */

	public async getPastDcaOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<DcaOrderObject[], ApiDCAsOwnedBody>(
			"owned-past-orders",
			inputs
		);
	}

	// =========================================================================
	// Transactions
	// =========================================================================

	/**
	 * Fetches the API transaction for creating DCA order.
	 * @param { ApiDcaTransactionForCreateOrderBody } inputs - The inputs for the transaction.
	 * @returns { Promise<Transaction> } A promise that resolves with the API transaction.
	 */

	public async getCreateDcaOrderTx(
		inputs: ApiDcaTransactionForCreateOrderBody
	): Promise<Transaction> {
		return this.fetchApiTransaction<ApiDcaTransactionForCreateOrderBody>(
			"transactions/create-order",
			inputs
		);
	}

	/**
	 * Fetches the API for canceling DCA order.
	 * @param inputs - The inputs for the transaction.
	 * @returns { Promise<boolean> } A promise that resolves with transaction execution status.
	 */

	public async getCloseDcaOrder(
		inputs: ApiDcaTransactionForCloseOrderBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiDcaTransactionForCloseOrderBody>(
			`ineractions/close-order`,
			inputs
		);
	}

	// =========================================================================
	// Interactions
	// =========================================================================

	/**
	 * Method for getting the cancelation dca order message to sign.
	 * @param inputs - The inputs for the message.
	 * @returns Message to sign.
	 */

	public closeDcaOrderMessageToSign(inputs: { orderId: ObjectId }): {
		action: string;
		order_object_id: string;
	} {
		return {
			action: "CANCEL_DCA_ORDER",
			order_object_id: inputs.orderId,
		};
	}

	/**
	 * Method for getting the creation user message to sign.
	 * @param inputs - The inputs for the message.
	 * @returns Message to sign.
	 */

	public createUserAccountMessageToSign(): {
		action: string;
	} {
		return {
			action: "CREATE_DCA_ACCOUNT",
		};
	}

	// =========================================================================
	// User Public Key
	// =========================================================================

	/**
	 * Fetches the API for users public key.
	 * @async
	 * @param { ApiDCAsOwnedBody } inputs - An object containing the walletAddress.
	 * @returns { Promise<ApiDcaUser> } A promise that resolves users public key.
	 */

	public async getUserPublicKey(inputs: {
		walletAddress: SuiAddress;
	}): Promise<ApiDcaUser> {
		return this.fetchApi<
			ApiDcaUser,
			{
				walletAddress: SuiAddress;
			}
		>(`get-user-pk`, inputs);
	}

	/**
	 * Fetches the API to create users public key.
	 * @async
	 * @param { ApiDcaCreateUserBody } inputs - The inputs for creating users public key on BE side.
	 * @returns { Promise<boolean> } A promise that resolves to result if user pk has been created.
	 */

	public async getCreateUserPublicKey(
		inputs: ApiDcaCreateUserBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiDcaCreateUserBody>(
			`create-user-pk`,
			inputs
		);
	}
}