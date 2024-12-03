import { ObjectId, SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { SuiAddress } from "../../types";
import {
	ApiLimitOrdersOwnedBody,
	ApiLimitOrdersTransactionForCreateOrderBody,
	ApiLimitOrdersTransactionForCancelOrderBody,
	LimitOrderObject,
	ApiLimitOrdersActiveOrdersOwnedBody,
} from "./limitOrdersTypes";
import { Transaction } from "@mysten/sui/transactions";

export class LimitOrders extends Caller {
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
		super(network, "limit-orders");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * Fetches the API for dollar cost averaging active orders list.
	 * @async
	 * @param { LimitOrderObject } inputs - An object containing the walletAddress.
	 * @returns { Promise<LimitOrderObject[]> } A promise that resolves to object with array of fetched events for active limit orders
	 */

	public async getActiveLimitOrders(
		inputs: ApiLimitOrdersActiveOrdersOwnedBody
	) {
		return this.fetchApi<
			LimitOrderObject[],
			ApiLimitOrdersActiveOrdersOwnedBody
		>("orders/active", inputs);
	}

	/**
	 * Fetches the API for limit cost finished orders list.
	 * @async
	 * @param { LimitOrderObject } inputs - An object containing the walletAddress.
	 * @returns { Promise<LimitOrderObject[]> } A promise that resolves to object with array of fetched events for past limit orders
	 */

	public async getPastLimitOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<LimitOrderObject[], ApiLimitOrdersOwnedBody>(
			"orders/past",
			inputs
		);
	}

	// =========================================================================
	// Transactions
	// =========================================================================

	/**
	 * Fetches the API transaction for creating Limit order.
	 * @param { ApiLimitOrdersTransactionForCreateOrderBody } inputs - The inputs for the transaction.
	 * @returns { Promise<Transaction> } A promise that resolves with the API transaction.
	 */

	public async getCreateLimitOrderTx(
		inputs: ApiLimitOrdersTransactionForCreateOrderBody
	): Promise<Transaction> {
		return this.fetchApiTransaction<ApiLimitOrdersTransactionForCreateOrderBody>(
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
		inputs: ApiLimitOrdersTransactionForCancelOrderBody
	): Promise<boolean> {
		return this.fetchApi<
			boolean,
			ApiLimitOrdersTransactionForCancelOrderBody
		>(`interactions/cancel-order`, inputs);
	}

	// =========================================================================
	// Interactions
	// =========================================================================

	/**
	 * Method for getting the cancellation limit order message to sign.
	 * @param inputs - The inputs for the message.
	 * @returns Message to sign.
	 */

	public cancelLimitOrderMessageToSign(inputs: { orderIds: ObjectId[] }): {
		action: string;
		order_object_ids: string[];
	} {
		return {
			action:
				inputs.orderIds.length === 1
					? "CANCEL_LIMIT_ORDER"
					: "CANCEL_LIMIT_ORDERS",
			order_object_ids: inputs.orderIds,
		};
	}
}
