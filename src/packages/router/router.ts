import {
	ApiRouterCompleteTradeRouteBody,
	ApiRouterTransactionForCompleteTradeRouteBody,
	CoinType,
	RouterCompleteTradeRoute,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";

export class Router extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		/**
		 * Max fee percentage that third parties can charge on router trades
		 */
		maxExternalFeePercentage: 0.5, // 50%
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	/**
	 * Creates `Router` provider to call api.
	 *
	 * @param network - The Sui network to interact with
	 * @returns New `Router` instance
	 */
	constructor(public readonly network?: SuiNetwork) {
		super(network, "router");
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	/**
	 * Queries all coins that router can trade between.
	 *
	 * @returns Array of supported coin types
	 */
	public async getSupportedCoins() {
		return this.fetchApi<CoinType[]>("supported-coins");
	}

	/**
	 * Creates route across multiple pools and protocols for best trade execution price
	 *
	 * @fix
	 * @param abortSignal - Optional signal to abort passed to fetch call
	 * @returns Routes, paths, and amounts of each smaller trade within complete trade
	 */
	public async getCompleteTradeRouteGivenAmountIn(
		inputs: ApiRouterCompleteTradeRouteBody,
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
	 * @fix
	 * @param abortSignal - Optional signal to abort passed to fetch call
	 * @returns Routes, paths, and amounts of each smaller trade within complete trade
	 */
	public async getCompleteTradeRouteGivenAmountOut(
		inputs: ApiRouterCompleteTradeRouteBody,
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("trade-route", inputs, abortSignal);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	/**
	 * Creates `TranscationBlock` from previously created complete trade route
	 *
	 * @fix
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
}
