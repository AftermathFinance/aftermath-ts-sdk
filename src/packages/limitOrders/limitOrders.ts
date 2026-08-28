import type { Transaction } from "@mysten/sui/transactions";
import { Caller } from "../../general/utils/caller";
import type {
	CallerConfig,
	ObjectId,
	SerializedTransaction,
	SuiAddress,
} from "../../types";
import type {
	ApiLimitOrdersActiveOrdersOwnedBody,
	ApiLimitOrdersCancelOrderTransactionBody,
	ApiLimitOrdersCreateOrderTransactionBody,
	ApiLimitOrdersPastOrdersOwnedBody,
	LimitOrderObject,
} from "./limitOrdersTypes";

/**
 * The `LimitOrders` class manages creation, cancellation, and querying of
 * limit orders on the Aftermath platform. Limit orders allow you to buy or
 * sell at a specified price, giving more control over your trades compared
 * to market execution.
 *
 * @example
 * ```typescript
 * const afSdk = await Aftermath.create({ network: "MAINNET" });
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
		 * The default gas budget for limit-order transactions, in MIST.
		 * `50_000_000n` equals `0.05` SUI.
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
	 * @param config - Optional configuration, including network, API host,
	 * access token, and API path.
	 */
	constructor(config?: CallerConfig) {
		super(config, "limit-orders");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * Fetches the user's active limit orders from the Aftermath API.
	 *
	 * The `bytes` and `signature` fields authenticate the request. They are the
	 * signed terms-message credential, not a transaction or a limit-order
	 * cancellation payload.
	 *
	 * @param inputs - Contains the `walletAddress`, as well as `bytes` and `signature` if needed for auth.
	 * @returns A promise resolving to an array of `LimitOrderObject`, representing the active orders.
	 * @throws `AftermathTransportError` when the API request or response fails.
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
	 * Fetches the user's past limit orders from the Aftermath API, including
	 * completed, canceled, expired, and failed orders.
	 *
	 * @param inputs - An object containing the `walletAddress`.
	 * @returns A promise resolving to an array of `LimitOrderObject` representing past orders.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const pastOrders = await limitOrders.getPastLimitOrders({
	 *   walletAddress: "0x<address>",
	 * });
	 * ```
	 */
	public async getPastLimitOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<LimitOrderObject[], ApiLimitOrdersPastOrdersOwnedBody>(
			"past",
			inputs
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Requests a limit-order creation transaction from the Aftermath API.
	 * The returned `Transaction` is not signed or executed.
	 *
	 * @param inputs - Limit-order details. Coin amounts are in the smallest units
	 * of their coin, and `expiryDurationMs` is in milliseconds.
	 * @returns A parsed `Transaction` with the wallet address set as its sender.
	 * @throws `AftermathTransportError` when the API request, response decoding,
	 * or transaction parsing fails.
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
		const { tx } = await this.fetchApiTxObject<
			ApiLimitOrdersCreateOrderTransactionBody,
			{ txKind: SerializedTransaction }
		>("v1/transactions/create-order", inputs, undefined, { txKind: true });

		tx.setSenderIfNotSet(inputs.walletAddress);
		return tx;
	}

	/**
	 * Sends a signed request to cancel one or more limit orders.
	 *
	 * Sign the exact string returned by
	 * `UserData.createTermsAndConditionsMessage()` as a personal message over
	 * its UTF-8 bytes. Send those signed bytes and the signature in `inputs`.
	 * The order IDs are sent in `orderObjectIds`; the deprecated per-action
	 * message from `cancelLimitOrdersMessageToSign` is not the current credential.
	 *
	 * @param inputs - Wallet address, signed terms-message bytes, signature, and
	 * the order object IDs to cancel.
	 * @returns The backend cancellation result. `false` is a valid response.
	 * @throws `AftermathTransportError` when the API request or response fails.
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
			"cancel",
			inputs
		);
	}

	// =========================================================================
	//  Interactions
	// =========================================================================

	/**
	 * Builds the legacy per-action message for canceling limit orders.
	 *
	 * This method performs no network I/O. The current cancellation endpoint
	 * authenticates with the canonical terms message instead. Put the order IDs
	 * in `cancelLimitOrder`'s `orderObjectIds` field.
	 *
	 * @deprecated af-fe no longer accepts this per-action message. Sign
	 * `UserData.createTermsAndConditionsMessage` and pass `orderObjectIds` in the
	 * `cancelLimitOrder` body instead.
	 * @param inputs - Object with `orderIds`, an array of order object IDs to cancel.
	 * @returns `{ action: "CANCEL_LIMIT_ORDERS", order_object_ids: inputs.orderIds }`.
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
	 * Fetches the minimum allowable limit-order size in USD.
	 *
	 * @returns A promise resolving to a `number` (USD value) or `undefined` if not configured.
	 * @throws `AftermathTransportError` when the API request or response fails.
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
