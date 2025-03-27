import { CallerConfig, ObjectId, SuiAddress } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiDCAsOwnedBody,
	ApiDcaTransactionForCreateOrderBody,
	ApiDcaTransactionForCloseOrderBody,
	DcaOrderObject,
	DcaOrdersObject,
	ApiDcaCreateUserBody,
} from "./dcaTypes";
import { Transaction } from "@mysten/sui/transactions";

/**
 * The `Dca` class provides functionality for automating Dollar-Cost Averaging
 * (DCA) strategies on the Aftermath platform. It allows you to create, query,
 * and close DCA orders that execute periodic trades based on user-defined
 * parameters.
 *
 * @example
 * ```typescript
 * const afSdk = new Aftermath("MAINNET");
 * await afSdk.init(); // initialize provider
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
		 * The default gas budget for DCA-related transactions (50 SUI).
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
	 * @param config - Optional caller configuration, such as network and access token.
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
		return this.fetchApi<DcaOrdersObject, ApiDCAsOwnedBody>(
			"orders",
			inputs
		);
	}

	/**
	 * Retrieves the currently active DCA orders for a specific user.
	 *
	 * @param inputs - An object containing the user's `walletAddress`.
	 * @returns A promise that resolves to an array of `DcaOrderObject` for the active orders.
	 *
	 * @example
	 * ```typescript
	 * const activeOrders = await dca.getActiveDcaOrders({ walletAddress: "0x..." });
	 * console.log(activeOrders); // Array of active DCA orders
	 * ```
	 */
	public async getActiveDcaOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<DcaOrderObject[], ApiDCAsOwnedBody>(
			"active",
			inputs
		);
	}

	/**
	 * Retrieves the past (completed or canceled) DCA orders for a specific user.
	 *
	 * @param inputs - An object containing the user's `walletAddress`.
	 * @returns A promise that resolves to an array of `DcaOrderObject` for the past orders.
	 *
	 * @example
	 * ```typescript
	 * const pastOrders = await dca.getPastDcaOrders({ walletAddress: "0x..." });
	 * console.log(pastOrders); // Array of past DCA orders
	 * ```
	 */
	public async getPastDcaOrders(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApi<DcaOrderObject[], ApiDCAsOwnedBody>(
			"past",
			inputs
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds a transaction block on the Aftermath API to create a new DCA order.
	 * The resulting `Transaction` can then be signed and executed by the user.
	 *
	 * @param inputs - The parameters describing the DCA order (coin types, amounts, frequency, etc.).
	 * @returns A `Transaction` object that can be signed and submitted to the Sui network.
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
	 * Closes (cancels) an existing DCA order by sending a transaction with user signature.
	 * Typically used after generating a message to sign with `closeDcaOrdersMessageToSign`.
	 *
	 * @param inputs - Contains the user's `walletAddress`, plus the `bytes` and `signature` from message signing.
	 * @returns A boolean indicating success or failure (true if canceled).
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
			`cancel`,
			inputs
		);
	}

	// =========================================================================
	//  Interactions
	// =========================================================================

	/**
	 * Generates a JSON object representing the message to sign for canceling one or more DCA orders.
	 * The user can sign this message (converted to bytes) locally, then submit the signature to
	 * `closeDcaOrder`.
	 *
	 * @param inputs - An object containing `orderIds`, an array of order object IDs to cancel.
	 * @returns An object with `action: "CANCEL_DCA_ORDERS"` and the `order_object_ids`.
	 *
	 * @example
	 * ```typescript
	 * const msg = dca.closeDcaOrdersMessageToSign({ orderIds: ["0x<order1>", "0x<order2>"] });
	 * console.log(msg);
	 * // sign this as JSON or string-encode, then pass to closeDcaOrder
	 * ```
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
	 * @returns An object with `action: "CREATE_DCA_ACCOUNT"`.
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
	 * @returns The public key as a string or `undefined`.
	 */
	public async getUserPublicKey(inputs: {
		walletAddress: SuiAddress;
	}): Promise<string | undefined> {
		return this.fetchApi<
			string | undefined,
			{
				walletAddress: SuiAddress;
			}
		>(`user/get`, inputs);
	}

	/**
	 * **Deprecated**. Creates the user's public key in the older DCA system.
	 * Please use `createUserPublicKey` from the `userData` package instead.
	 *
	 * @deprecated Use `userData` package method instead
	 * @param inputs - Body containing the user address, bytes, and signature.
	 * @returns `true` if the public key was successfully stored, otherwise `false`.
	 */
	public async createUserPublicKey(
		inputs: ApiDcaCreateUserBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiDcaCreateUserBody>(
			`/user/add`,
			inputs
		);
	}
}
