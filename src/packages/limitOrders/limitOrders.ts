import { CallerConfig, CoinType, ObjectId } from "../../types";
import { Caller } from "../../general/utils/caller";
import { SuiAddress } from "../../types";
import {
	ApiLimitOrdersPastOrdersOwnedBody,
	ApiLimitOrdersCreateOrderTransactionBody,
	ApiLimitOrdersCancelOrderTransactionBody,
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

	constructor(config?: CallerConfig) {
		super(config, "limit-orders");
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
		>("active", inputs);
	}

	/**
	 * Fetches the API for limit cost finished orders list.
	 * @async
	 * @param { LimitOrderObject } inputs - An object containing the walletAddress.
	 * @returns { Promise<LimitOrderObject[]> } A promise that resolves to object with array of fetched events for past limit orders
	 */

	public async getPastLimitOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<
			LimitOrderObject[],
			ApiLimitOrdersPastOrdersOwnedBody
		>("executed", inputs);
	}

	// =========================================================================
	// Transactions
	// =========================================================================

	/**
	 * Fetches the API transaction for creating Limit order.
	 * @param { ApiLimitOrdersCreateOrderTransactionBody } inputs - The inputs for the transaction.
	 * @returns { Promise<Transaction> } A promise that resolves with the API transaction.
	 */

	public async getCreateLimitOrderTx(
		inputs: ApiLimitOrdersCreateOrderTransactionBody
	): Promise<Transaction> {
		return this.fetchApiTransaction<ApiLimitOrdersCreateOrderTransactionBody>(
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
		inputs: ApiLimitOrdersCancelOrderTransactionBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiLimitOrdersCancelOrderTransactionBody>(
			`cancel`,
			inputs
		);
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

	// =========================================================================
	// Configuration
	// =========================================================================

	/**
	 * Method for getting a minimum allowable order size.
	 * @returns Minimum order size in usd.
	 */

	public async getMinOrderSize() {
		return this.fetchApi<
			| {
					minOrderCoinType: CoinType;
					minOrderSizeUsd: number;
			  }
			| undefined,
			undefined
		>("min-order-size-usd");
	}
}
