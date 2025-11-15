import { CallerConfig, CoinType, ObjectId, SuiAddress } from "../../types.ts";
import { Caller } from "../../general/utils/caller.ts";
import {
	ApiLimitOrdersPastOrdersOwnedBody,
	ApiLimitOrdersCreateOrderTransactionBody,
	ApiLimitOrdersCancelOrderTransactionBody,
	LimitOrderObject,
	ApiLimitOrdersActiveOrdersOwnedBody,
} from "./limitOrdersTypes.ts";
import { Transaction } from "@mysten/sui/transactions";

/**
 * The `LimitOrders` class manages creation, cancellation, and querying of
 * limit orders on the Aftermath platform. Limit orders allow you to buy or
 * sell at a specified price, giving more control over your trades compared
 * to market execution.
 *
 * @example
 * ```typescript
 * const afSdk = new Aftermath("MAINNET");
 * await afSdk.init(); // initialize provider
 *
 * const limitOrders = afSdk.LimitOrders();
 * ```
 */
export class LimitOrders extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Static configuration constants, including a default gas amount for
	 * limit order transactions (50 SUI).
	 */
	public static readonly constants = {
		/**
		 * The default gas budget for limit orders. This may be subject to change.
		 */
		gasAmount: BigInt(50_000_000),
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new `LimitOrders` instance for interacting with limit order functionality
	 * on Aftermath.
	 *
	 * @param config - Optional configuration, including network and access token.
	 */
	constructor(config?: CallerConfig) {
		super(config, "limit-orders");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * Fetches the list of **active** limit orders for a given user. The user must
	 * provide a signature for identification.
	 *
	 * @param inputs - Contains the `walletAddress`, as well as `bytes` and `signature` if needed for auth.
	 * @returns A promise resolving to an array of `LimitOrderObject`, representing the active orders.
	 *
	 * @example
	 * ```typescript
	 * const activeOrders = await limitOrders.getActiveLimitOrders({
	 *   walletAddress: "0x<address>",
	 *   bytes: "0x<signed_bytes>",
	 *   signature: "0x<signature>"
	 * });
	 * ```
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
	 * Fetches the list of **past** limit orders for a given user (e.g., completed, canceled, or expired).
	 *
	 * @param inputs - An object containing the `walletAddress`.
	 * @returns A promise resolving to an array of `LimitOrderObject` representing past orders.
	 *
	 * @example
	 * ```typescript
	 * const pastOrders = await limitOrders.getPastLimitOrders({
	 *   walletAddress: "0x<address>",
	 * });
	 * ```
	 */
	public async getPastLimitOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<
			LimitOrderObject[],
			ApiLimitOrdersPastOrdersOwnedBody
		>("past", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Constructs a limit order creation transaction on the Aftermath API, returning a `Transaction`
	 * object that can be signed and submitted to the network.
	 *
	 * @param inputs - The limit order details, including coin types, amounts, expiry, etc.
	 * @returns A promise resolving to a `Transaction` that can be locally signed and executed.
	 *
	 * @example
	 * ```typescript
	 * const tx = await limitOrders.getCreateLimitOrderTx({
	 *   walletAddress: "0x<address>",
	 *   allocateCoinType: "0x<coin>",
	 *   allocateCoinAmount: BigInt(1000),
	 *   buyCoinType: "0x<other_coin>",
	 *   expiryDurationMs: 3600000, // 1 hour
	 *   outputToInputExchangeRate: 0.5,
	 * });
	 * // sign and execute the transaction
	 * ```
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
	 * Cancels an existing limit order by sending a request to the Aftermath API
	 * with the user's signed cancellation message.
	 *
	 * @param inputs - Contains the user's `walletAddress`, plus `bytes` and `signature`.
	 * @returns A boolean indicating whether the cancellation was successful.
	 *
	 * @example
	 * ```typescript
	 * const success = await limitOrders.cancelLimitOrder({
	 *   walletAddress: "0x<address>",
	 *   bytes: "0x<signed_bytes>",
	 *   signature: "0x<signature>",
	 * });
	 * ```
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
	//  Interactions
	// =========================================================================

	/**
	 * Generates the JSON message needed to cancel one or more limit orders. The user
	 * signs this message (converted to bytes), and the resulting signature is passed
	 * to `cancelLimitOrder`.
	 *
	 * @param inputs - Object with `orderIds`, an array of order object IDs to cancel.
	 * @returns A JSON structure with the action and order IDs to be canceled.
	 *
	 * @example
	 * ```typescript
	 * const msg = limitOrders.cancelLimitOrdersMessageToSign({
	 *   orderIds: ["0x<order1>", "0x<order2>"]
	 * });
	 * // user signs this JSON
	 * ```
	 */
	public cancelLimitOrdersMessageToSign(inputs: { orderIds: ObjectId[] }): {
		action: string;
		order_object_ids: string[];
	} {
		return {
			action: "CANCEL_LIMIT_ORDERS",
			order_object_ids: inputs.orderIds,
		};
	}

	// =========================================================================
	//  Configuration
	// =========================================================================

	/**
	 * Retrieves the minimum allowable order size (in USD) for limit orders on Aftermath.
	 *
	 * @returns A promise resolving to a `number` (USD value) or `undefined` if not configured.
	 *
	 * @example
	 * ```typescript
	 * const minSize = await limitOrders.getMinOrderSizeUsd();
	 * console.log("Minimum order size in USD:", minSize);
	 * ```
	 */
	public async getMinOrderSizeUsd() {
		return this.fetchApi<number | undefined, {}>("min-order-size-usd", {});
	}
}
