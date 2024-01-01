import {
	ApiRouterCompleteTradeRouteBody,
	ApiRouterTransactionForCompleteTradeRouteBody,
	CoinType,
	RouterCompleteTradeRoute,
	RouterSerializableCompleteGraph,
	RouterSynchronousSerializablePool,
	RouterSupportedCoinPaths,
	SuiNetwork,
	Url,
	ApiRouterTradeEventsBody,
	RouterTradeEvent,
	RouterAsyncSerializablePool,
	RouterSynchronousProtocolName,
	ObjectId,
	Balance,
	ApiRouterPartialCompleteTradeRouteBody,
} from "../../types";
import { Caller } from "../../general/utils/caller";

/**
 * @class Router Provider
 *
 * @example
 * ```
 * // Create provider
 * const router = (new Aftermath("MAINNET")).Router();
 * // Call sdk
 * const supportedCoins = await router.getSupportedCoins();
 * ```
 */
export class Router extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		/**
		 * Max fee percentage that third parties can charge on router trades
		 */
		maxExternalFeePercentage: 0.5, // 50%
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates `Router` provider to call api.
	 *
	 * @param network - The Sui network to interact with
	 * @returns New `Router` instance
	 */
	constructor(public readonly network?: SuiNetwork) {
		super(network, "router");
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Retrieves the total volume in the last 24 hours.
	 * @returns A Promise that resolves to a number representing the total volume.
	 */
	public getVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	/**
	 * Queries all coins that router can trade between.
	 *
	 * @returns Mapping of coin type in to array of supported coin types out
	 */
	public async getSupportedCoinPaths() {
		return this.fetchApi<RouterSupportedCoinPaths>("supported-coin-paths");
	}

	public async getSupportedCoins() {
		return this.fetchApi<CoinType[]>("supported-coins");
	}

	/**
	 * Queries current graph of router including all pools and coins.
	 *
	 * @returns Complete graph of all pools used in router
	 */
	public async getGraph(inputs?: { isDynamicGas: boolean }) {
		return this.fetchApi<RouterSerializableCompleteGraph>(
			"graph" + (inputs?.isDynamicGas ? "/dynamic-gas" : "")
		);
	}

	public async getAsyncPools() {
		return this.fetchApi<RouterAsyncSerializablePool[]>("async-pools");
	}

	public async getSynchronousPoolIds(inputs?: { isDynamicGas: boolean }) {
		return this.fetchApi<Record<RouterSynchronousProtocolName, ObjectId[]>>(
			"synchronous-pool-ids" +
				(inputs?.isDynamicGas ? "/dynamic-gas" : "")
		);
	}

	/**
	 * Creates route across multiple pools and protocols for best trade execution price
	 *
	 * @param inputs - Details for router to construct trade route
	 * @param abortSignal - Optional signal to abort passed to fetch call
	 * @returns Routes, paths, and amounts of each smaller trade within complete trade
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
	 * Creates route across multiple pools and protocols for best trade execution price
	 *
	 * @param inputs - Details for router to construct trade route
	 * @param abortSignal - Optional signal to abort passed to fetch call
	 * @returns Routes, paths, and amounts of each smaller trade within complete trade
	 */
	public async getCompleteTradeRouteGivenAmountOut(
		inputs: ApiRouterPartialCompleteTradeRouteBody & {
			/**
			 * Amount of coin expected to receive
			 */
			coinOutAmount: Balance;
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
	 * Creates `TranscationBlock` from previously created complete trade route
	 *
	 * @example
	 * ```
	 * const route = await router.getCompleteTradeRouteGivenAmountIn(routeDetails);
	 * const tx = await router.getTransactionForCompleteTradeRoute({
	 * 	completeRoute: route,
	 * 	walletAddress: "0xBEEF",
	 * 	slippage: 0.01
	 * });
	 * // sign and execute tx using wallet
	 * ```
	 *
	 * @param inputs - Info to construct router trade transaction from complete route
	 * @returns Executable `TranscationBlock` trading from `coinIn` to `coinOut`
	 */
	public async getTransactionForCompleteTradeRoute(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	) {
		return this.fetchApiTransaction<ApiRouterTransactionForCompleteTradeRouteBody>(
			"transactions/trade",
			inputs
		);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async getTradeEvents(inputs: ApiRouterTradeEventsBody) {
		return this.fetchApiEvents<RouterTradeEvent>("events/trade", inputs);
	}
}
