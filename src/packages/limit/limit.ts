import { ObjectId, SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { SuiAddress } from "../../types";
import {
	ApiLimitsOwnedBody,
	ApiLimitTransactionForCreateOrderBody,
	ApiLimitTransactionForCancelOrderBody,
	LimitOrderObject,
	ApiLimitsActiveOrdersOwnedBody,
} from "./limitTypes";
import { Transaction } from "@mysten/sui/transactions";

export class Limit extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		gasAmount: BigInt(50_000_000),
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "limit");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * Fetches the API for dollar cost averaging orders list.
	 * @async
	 * @param { LimitOrderObject } inputs - An object containing the walletAddress.
	 * @returns { Promise<LimitOrderObject> } A promise that resolves to object with array of fetched events for active and past dca's.
	 */

	public async getAllLimitOrders(inputs: ApiLimitsOwnedBody) {
		return this.fetchApi<LimitOrderObject[], ApiLimitsOwnedBody>(
			"orders",
			inputs
		);
	}

	/**
	 * Fetches the API for dollar cost averaging active orders list.
	 * @async
	 * @param { LimitOrderObject } inputs - An object containing the walletAddress.
	 * @returns { Promise<LimitOrderObject[]> } A promise that resolves to object with array of fetched events for active dca's.
	 */

	public async getActiveLimitOrders(inputs: ApiLimitsActiveOrdersOwnedBody) {
		return this.fetchApi<
			LimitOrderObject[],
			ApiLimitsActiveOrdersOwnedBody
		>("orders/active", inputs);
	}

	/**
	 * Fetches the API for limit cost finished orders list.
	 * @async
	 * @param { LimitOrderObject } inputs - An object containing the walletAddress.
	 * @returns { Promise<LimitOrderObject[]> } A promise that resolves to object with array of fetched events for past dca's.
	 */

	public async getExecutedLimitOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<LimitOrderObject[], ApiLimitsOwnedBody>(
			"orders/executed",
			inputs
		);
	}

	// =========================================================================
	// Transactions
	// =========================================================================

	/**
	 * Fetches the API transaction for creating Limit order.
	 * @param { ApiLimitTransactionForCreateOrderBody } inputs - The inputs for the transaction.
	 * @returns { Promise<Transaction> } A promise that resolves with the API transaction.
	 */

	public async getCreateLimitOrderTx(
		inputs: ApiLimitTransactionForCreateOrderBody
	): Promise<Transaction> {
		return this.fetchApiTransaction<ApiLimitTransactionForCreateOrderBody>(
			"transactions/create-order",
			inputs
		);
	}

	/**
	 * Fetches the API for canceling Limit order.
	 * @param inputs - The inputs for the transaction.
	 * @returns { Promise<boolean> } A promise that resolves with transaction execution status.
	 */

	public async cancelLimitOrder(
		inputs: ApiLimitTransactionForCancelOrderBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiLimitTransactionForCancelOrderBody>(
			`interactions/cancel-order`,
			inputs
		);
	}

	// =========================================================================
	// Interactions
	// =========================================================================

	/**
	 * Method for getting the cancellation dca order message to sign.
	 * @param inputs - The inputs for the message.
	 * @returns Message to sign.
	 */

	public cancelLimitOrderMessageToSign(inputs: {
		action: string;
		orderIds: ObjectId[];
	}): {
		action: string;
		order_object_ids: string[];
	} {
		return {
			action: inputs.action,
			order_object_ids: inputs.orderIds,
		};
	}
}
