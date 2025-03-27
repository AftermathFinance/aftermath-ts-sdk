import {
	ApiRouterCompleteTradeRouteBody,
	ApiRouterTransactionForCompleteTradeRouteBody,
	CoinType,
	RouterCompleteTradeRoute,
	SuiNetwork,
	ApiRouterTradeEventsBody,
	RouterTradeEvent,
	Balance,
	ApiRouterPartialCompleteTradeRouteBody,
	ApiRouterAddTransactionForCompleteTradeRouteBody,
	ApiRouterAddTransactionForCompleteTradeRouteResponse,
	ApiRouterAddTransactionForCompleteTradeRouteV0Body,
	ApiRouterAddTransactionForCompleteTradeRouteV0Response,
	ModuleName,
	Slippage,
	ApiIndexerEventsBody,
	CallerConfig,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { Transaction } from "@mysten/sui/transactions";
import { TransactionBlock } from "@mysten/sui.js/transactions";

/**
 * The `Router` class provides a collection of methods to interact with Aftermath's
 * smart order routing system on the Sui Network. It handles routing trades through
 * various liquidity pools to achieve the best possible execution price, retrieving
 * trade volume, managing supported coins, and more.
 *
 * @example
 * ```typescript
 * // Create provider
 * const router = (new Aftermath("MAINNET")).Router();
 * // Retrieve 24h volume
 * const volume24h = await router.getVolume24hrs();
 * // Get supported coins
 * const supportedCoins = await router.getSupportedCoins();
 * ```
 */
export class Router extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Contains static information about the router, such as the maximum
	 * allowable external fee percentage.
	 */
	public static readonly constants = {
		/**
		 * The maximum external fee percentage that a third party can charge on router trades.
		 * @remarks 0.5 = 50%
		 */
		maxExternalFeePercentage: 0.5,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new `Router` instance to perform router-related calls on the
	 * Aftermath platform.
	 *
	 * @param config - Optional configuration settings, including network and access token.
	 * @returns A new `Router` instance.
	 *
	 * @example
	 * ```typescript
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // initialize provider
	 *
	 * const router = afSdk.Router();
	 * ```
	 */
	constructor(config?: CallerConfig) {
		super(config, "router");
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Retrieves the total trading volume in the last 24 hours.
	 *
	 * @returns A promise that resolves to a `number` representing the total volume in the last 24 hours.
	 *
	 * @example
	 * ```typescript
	 * const volume = await router.getVolume24hrs();
	 * console.log(volume); // e.g. 1234567.89
	 * ```
	 */
	public getVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	/**
	 * Fetches a list of all coin types that are supported for trading through the router.
	 *
	 * @returns A promise that resolves to an array of coin types (`CoinType[]`).
	 *
	 * @example
	 * ```typescript
	 * const supportedCoins = await router.getSupportedCoins();
	 * console.log(supportedCoins); // ["0x2::sui::SUI", "0x<...>::coin::TOKEN", ...]
	 * ```
	 */
	public async getSupportedCoins() {
		return this.fetchApi<CoinType[]>("supported-coins");
	}

	/**
	 * Searches the supported coins by applying a filter string.
	 *
	 * @param inputs - An object containing a `filter` string to match against supported coins.
	 * @param abortSignal - An optional `AbortSignal` to cancel the request if needed.
	 * @returns A promise that resolves to an array of coin types matching the filter.
	 *
	 * @example
	 * ```typescript
	 * const searchResult = await router.searchSupportedCoins({ filter: "SUI" });
	 * console.log(searchResult); // e.g. ["0x2::sui::SUI"]
	 * ```
	 */
	public async searchSupportedCoins(
		inputs: { filter: string },
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<CoinType[]>(
			`supported-coins/${inputs.filter}`,
			undefined,
			abortSignal
		);
	}

	/**
	 * Creates an optimal trade route for a given token input (`coinInType`) with a
	 * specified input amount (`coinInAmount`). This route may consist of multiple
	 * swaps across different DEX protocols to achieve the best price.
	 *
	 * @param inputs - Details required to construct the trade route, including `coinInType`, `coinOutType`, and `coinInAmount`.
	 * @param abortSignal - An optional signal to abort the request if needed.
	 * @returns A promise resolving to a `RouterCompleteTradeRoute` object containing the full route details.
	 *
	 * @example
	 * ```typescript
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({
	 *   coinInType: "0x2::sui::SUI",
	 *   coinOutType: "0x<...>::coin::TOKEN",
	 *   coinInAmount: BigInt(10_000_000_000),
	 *   // optional fields:
	 *   referrer: "0x<referrer_address>",
	 *   externalFee: {
	 *     recipient: "0x<fee_collector>",
	 *     feePercentage: 0.01
	 *   },
	 *   protocolBlacklist: ["Cetus", "BlueMove"]
	 * });
	 * console.log(route);
	 * ```
	 */
	public async getCompleteTradeRouteGivenAmountIn(
		inputs: ApiRouterPartialCompleteTradeRouteBody & {
			/**
			 * Amount of coin being given away
			 */
			coinInAmount: Balance;
		},
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("trade-route", inputs, abortSignal);
	}

	/**
	 * Creates an optimal trade route for a given token output (`coinOutType`) with a
	 * specified output amount (`coinOutAmount`). This route may consist of multiple
	 * swaps to achieve the target output amount, factoring in slippage.
	 *
	 * @param inputs - Details required to construct the trade route, including `coinInType`, `coinOutType`, `coinOutAmount`, and `slippage`.
	 * @param abortSignal - An optional signal to abort the request if needed.
	 * @returns A promise resolving to a `RouterCompleteTradeRoute` object containing the full route details.
	 *
	 * @example
	 * ```typescript
	 * const route = await router.getCompleteTradeRouteGivenAmountOut({
	 *   coinInType: "0x2::sui::SUI",
	 *   coinOutType: "0x<...>::coin::TOKEN",
	 *   coinOutAmount: BigInt(20_000_000),
	 *   slippage: 0.01, // 1%
	 *   protocolWhitelist: ["Aftermath", "Cetus"]
	 * });
	 * console.log(route);
	 * ```
	 */
	public async getCompleteTradeRouteGivenAmountOut(
		inputs: ApiRouterPartialCompleteTradeRouteBody & {
			/**
			 * Amount of coin expected to receive
			 */
			coinOutAmount: Balance;
			slippage: Slippage;
		},
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("trade-route", inputs, abortSignal);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Generates a transaction to execute a previously calculated complete trade route.
	 * This transaction can then be signed and executed by the user.
	 *
	 * @param inputs - An object containing the wallet address, the complete trade route, slippage tolerance, and optional sponsorship settings.
	 * @returns A promise resolving to a `Uint8Array` representing the serialized transaction.
	 *
	 * @example
	 * ```typescript
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
	 * const transactionBytes = await router.getTransactionForCompleteTradeRoute({
	 *   walletAddress: "0x<your_address>",
	 *   completeRoute: route,
	 *   slippage: 0.01
	 * });
	 * // The returned bytes can now be signed and executed using your chosen wallet.
	 * ```
	 */
	public async getTransactionForCompleteTradeRoute(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	) {
		return this.fetchApiTransaction<ApiRouterTransactionForCompleteTradeRouteBody>(
			"transactions/trade",
			inputs
		);
	}

	/**
	 * **Legacy method** for generating a transaction to execute a complete trade route.
	 * Uses an older version of transaction serialization.
	 *
	 * @param inputs - Similar to `getTransactionForCompleteTradeRoute` but serialized using the legacy method.
	 * @returns A promise resolving to a `Uint8Array` representing the serialized transaction.
	 *
	 * @example
	 * ```typescript
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
	 * const transactionBytesV0 = await router.getTransactionForCompleteTradeRouteV0({
	 *   walletAddress: "0x<your_address>",
	 *   completeRoute: route,
	 *   slippage: 0.01
	 * });
	 * // Use this if your environment requires legacy transaction structure
	 * ```
	 */
	public async getTransactionForCompleteTradeRouteV0(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	) {
		return this.fetchApiTransactionV0<ApiRouterTransactionForCompleteTradeRouteBody>(
			"transactions/trade-v0",
			inputs
		);
	}

	/**
	 * Adds a trade route to an existing transaction, allowing you to build complex
	 * transactions containing multiple actions (swaps, transfers, etc.) in a single
	 * atomic transaction.
	 *
	 * @param inputs - Includes the existing `Transaction`, a complete route, slippage, wallet address, and an optional `coinInId`.
	 * @returns An object containing:
	 *  - `tx`: The updated `Transaction` including the route instructions
	 *  - `coinOutId`: A `TransactionObjectArgument` referencing the output coin after the swap
	 *
	 * @example
	 * ```typescript
	 * // 1) Create a route
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
	 *
	 * // 2) Initialize your transaction
	 * const tx = new Transaction();
	 *
	 * // 3) Add router instructions
	 * const { tx: updatedTx, coinOutId } =
	 *   await router.addTransactionForCompleteTradeRoute({
	 *     tx,
	 *     completeRoute: route,
	 *     slippage: 0.01,
	 *     walletAddress: "0x<your_address>"
	 * });
	 *
	 * // 4) Continue building your transaction with the resulting coinOutId, if desired
	 * updatedTx.transferObjects([coinOutId!], "0x<your_address>");
	 * ```
	 */
	public async addTransactionForCompleteTradeRoute(
		inputs: Omit<
			ApiRouterAddTransactionForCompleteTradeRouteBody,
			"serializedTx"
		> & {
			tx: Transaction;
		}
	) {
		const { tx, ...otherInputs } = inputs;
		const { tx: newTx, coinOutId } = await this.fetchApi<
			ApiRouterAddTransactionForCompleteTradeRouteResponse,
			ApiRouterAddTransactionForCompleteTradeRouteBody
		>("transactions/add-trade", {
			...otherInputs,
			serializedTx: tx.serialize(),
		});
		return {
			tx: Transaction.from(newTx),
			coinOutId,
		};
	}

	/**
	 * **Legacy method** for adding a trade route to an existing transaction.
	 * Uses an older version of transaction serialization.
	 *
	 * @param inputs - Similar to `addTransactionForCompleteTradeRoute` but returns a `TransactionBlock`.
	 * @returns An object containing:
	 *  - `tx`: The updated `TransactionBlock`
	 *  - `coinOutId`: A `TransactionObjectArgumentV0` referencing the output coin
	 *
	 * @example
	 * ```typescript
	 * // 1) Create a route
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
	 *
	 * // 2) Initialize your transaction block
	 * const txBlock = new TransactionBlock();
	 *
	 * // 3) Add router instructions (legacy)
	 * const { tx: updatedTxBlock, coinOutId } =
	 *   await router.addTransactionForCompleteTradeRouteV0({
	 *     tx: txBlock,
	 *     completeRoute: route,
	 *     slippage: 0.01,
	 *     walletAddress: "0x<your_address>"
	 * });
	 *
	 * // 4) Continue building your transaction with the resulting coinOutId
	 * updatedTxBlock.transferObjects([coinOutId!], "0x<your_address>");
	 * ```
	 */
	public async addTransactionForCompleteTradeRouteV0(
		inputs: Omit<
			ApiRouterAddTransactionForCompleteTradeRouteV0Body,
			"serializedTx"
		> & {
			tx: TransactionBlock;
		}
	) {
		const { tx, ...otherInputs } = inputs;
		const { tx: newTx, coinOutId } = await this.fetchApi<
			ApiRouterAddTransactionForCompleteTradeRouteV0Response,
			ApiRouterAddTransactionForCompleteTradeRouteV0Body
		>("transactions/add-trade-v0", {
			...otherInputs,
			serializedTx: tx.serialize(),
		});
		return {
			tx: TransactionBlock.from(newTx),
			coinOutId,
		};
	}

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Retrieves trade events (interactions) for a given user based on router usage.
	 *
	 * @param inputs - Includes a `walletAddress`, cursor pagination, and limit.
	 * @returns A promise resolving to the user's `RouterTradeEvent`s, potentially paginated.
	 *
	 * @example
	 * ```typescript
	 * const events = await router.getInteractionEvents({
	 *   walletAddress: "0x<your_address>",
	 *   cursor: 0,
	 *   limit: 10
	 * });
	 * console.log(events);
	 * ```
	 */
	public async getInteractionEvents(inputs: ApiRouterTradeEventsBody) {
		return this.fetchApiIndexerEvents<
			RouterTradeEvent,
			ApiRouterTradeEventsBody
		>("events-by-user", inputs);
	}
}
