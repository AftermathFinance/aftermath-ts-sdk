import type { Transaction } from "@mysten/sui/transactions";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig, ObjectId, SuiAddress } from "../../types";
import type {
	ApiDCAsOwnedBody,
	ApiDcaCreateUserBody,
	ApiDcaTransactionForCloseOrderBody,
	ApiDcaTransactionForCreateOrderBody,
	DcaOrderObject,
	DcaOrdersObject,
} from "./dcaTypes";

/**
 * The `Dca` class provides functionality for automating Dollar-Cost Averaging
 * (DCA) strategies on the Aftermath platform. It allows you to create, query,
 * and close DCA orders that execute periodic trades based on user-defined
 * parameters.
 *
 * @example
 * ```typescript
 * const afSdk = await Aftermath.create({ network: "MAINNET" });
 *
 * const dca = afSdk.Dca();
 * ```
 */
export class Dca extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Contains static values related to DCA on the Aftermath platform, such as
	 * default gas usage for DCA transactions.
	 */
	public static readonly constants = {
		/**
		 * The default gas budget for DCA-related transactions, in MIST.
		 * `50_000_000n` equals `0.05` SUI.
		 */
		gasAmount: BigInt(50_000_000),
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of the `Dca` class, responsible for
	 * managing DCA orders (querying, creating, closing).
	 *
	 * @param config - Optional caller configuration, such as network, API host,
	 * access token, and API path.
	 */
	constructor(config?: CallerConfig) {
		super(config, "dca");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * **Deprecated**. Fetches both active and past DCA orders for a given user in one response.
	 * Use `getActiveDcaOrders` and `getPastDcaOrders` for a more explicit approach.
	 *
	 * @param inputs - Object containing the user's `walletAddress`.
	 * @returns A `DcaOrdersObject` grouping active and past orders.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @deprecated Please use `getActiveDcaOrders` & `getPastDcaOrders` instead.
	 * @example
	 * ```typescript
	 * // Old usage:
	 * const allOrders = await dca.getAllDcaOrders({ walletAddress: "0x..." });
	 * console.log(allOrders.active, allOrders.past);
	 * ```
	 */
	public async getAllDcaOrders(inputs: ApiDCAsOwnedBody) {
		return this.fetchApi<DcaOrdersObject, ApiDCAsOwnedBody>("orders", inputs);
	}

	/**
	 * Retrieves the currently active DCA orders for a specific user.
	 *
	 * @param inputs - An object containing the user's `walletAddress`.
	 * @returns A promise that resolves to an array of `DcaOrderObject` for the active orders.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const activeOrders = await dca.getActiveDcaOrders({ walletAddress: "0x..." });
	 * console.log(activeOrders); // Array of active DCA orders
	 * ```
	 */
	public async getActiveDcaOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<DcaOrderObject[], ApiDCAsOwnedBody>("active", inputs);
	}

	/**
	 * Retrieves the past (completed or canceled) DCA orders for a specific user.
	 *
	 * @param inputs - An object containing the user's `walletAddress`.
	 * @returns A promise that resolves to an array of `DcaOrderObject` for the past orders.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const pastOrders = await dca.getPastDcaOrders({ walletAddress: "0x..." });
	 * console.log(pastOrders); // Array of past DCA orders
	 * ```
	 */
	public async getPastDcaOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<DcaOrderObject[], ApiDCAsOwnedBody>("past", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Requests a transaction block from the Aftermath API to create a new DCA order.
	 * The returned `Transaction` is not signed or executed.
	 *
	 * @param inputs - The DCA order parameters. Coin amounts are in the smallest
	 * units of their coin, and time values ending in `Ms` are milliseconds.
	 * @returns A parsed `Transaction` with the wallet address set as its sender.
	 * @throws `AftermathTransportError` when the API request, response decoding,
	 * or transaction parsing fails.
	 *
	 * @example
	 * ```typescript
	 * const createOrderTx = await dca.getCreateDcaOrderTx({
	 *   walletAddress: "0x<user>",
	 *   allocateCoinType: "0x2::sui::SUI",
	 *   allocateCoinAmount: BigInt(1_000_000_000),
	 *   buyCoinType: "0x<coin>",
	 *   frequencyMs: 3600000, // Every hour
	 *   tradesAmount: 5,
	 *   // ...other fields...
	 * });
	 * // sign & send the transaction
	 * ```
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
	 * Sends a signed request to cancel one or more DCA orders.
	 *
	 * Sign the exact string returned by
	 * `UserData.createTermsAndConditionsMessage()` as a personal message over
	 * its UTF-8 bytes. Send those signed bytes and the signature in `inputs`.
	 * The order IDs are sent in `orderObjectIds`; the deprecated per-action
	 * message from `closeDcaOrdersMessageToSign` is not the current credential.
	 *
	 * @param inputs - Wallet address, signed terms-message bytes, signature, and
	 * the order object IDs to cancel.
	 * @returns The backend cancellation result. `false` is a valid response.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const success = await dca.closeDcaOrder({
	 *   walletAddress: "0x...",
	 *   bytes: "0x<signed_bytes>",
	 *   signature: "0x<signature>",
	 * });
	 * ```
	 */
	public async closeDcaOrder(
		inputs: ApiDcaTransactionForCloseOrderBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiDcaTransactionForCloseOrderBody>(
			"cancel",
			inputs
		);
	}

	// =========================================================================
	//  Interactions
	// =========================================================================

	/**
	 * Builds the legacy per-action message for canceling DCA orders.
	 *
	 * This method performs no network I/O. The current cancellation endpoint
	 * authenticates with the canonical terms message instead. Put the order IDs
	 * in `closeDcaOrder`'s `orderObjectIds` field.
	 *
	 * @deprecated af-fe no longer accepts this per-action message. Sign
	 * `UserData.createTermsAndConditionsMessage` and pass `orderObjectIds` in the
	 * `closeDcaOrder` body instead.
	 * @param inputs - An object containing `orderIds`, an array of order object IDs to cancel.
	 * @returns `{ action: "CANCEL_DCA_ORDERS", order_object_ids: inputs.orderIds }`.
	 */
	public closeDcaOrdersMessageToSign(inputs: { orderIds: ObjectId[] }): {
		action: string;
		order_object_ids: string[];
	} {
		return {
			action: "CANCEL_DCA_ORDERS",
			order_object_ids: inputs.orderIds,
		};
	}

	// =========================================================================
	//  Interactions - Deprecated
	// =========================================================================

	/**
	 * **Deprecated**. Generates a message object used in older flows to create
	 * a DCA user account. Use the `userData` package for user key storage or account creation.
	 *
	 * @deprecated Please use method from `userData` package instead.
	 * @returns `{ action: "CREATE_DCA_ACCOUNT" }`. No network request is made.
	 */
	public createUserAccountMessageToSign(): {
		action: string;
	} {
		return {
			action: "CREATE_DCA_ACCOUNT",
		};
	}

	// =========================================================================
	//  User Public Key
	// =========================================================================

	/**
	 * **Deprecated**. Fetches the user's public key from the older DCA system.
	 * Please use `getUserPublicKey` from the `userData` package instead.
	 *
	 * @deprecated Use `userData` package method instead
	 * @param inputs - Contains the user's `walletAddress`.
	 * @returns The stored public key, or `undefined` when the API returns no key.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getUserPublicKey(inputs: {
		walletAddress: SuiAddress;
	}): Promise<string | undefined> {
		return this.fetchApi<
			string | undefined,
			{
				walletAddress: SuiAddress;
			}
		>("user/get", inputs);
	}

	/**
	 * **Deprecated**. Creates the user's public key in the older DCA system.
	 * Please use `createUserPublicKey` from the `userData` package instead.
	 *
	 * @deprecated Use `userData` package method instead
	 * @param inputs - User address, signed message bytes, and the corresponding signature.
	 * @returns `true` if the public key was stored. `false` is also a valid backend response.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async createUserPublicKey(
		inputs: ApiDcaCreateUserBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiDcaCreateUserBody>("/user/add", inputs);
	}
}
