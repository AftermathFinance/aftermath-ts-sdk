import {
	ApiRouterCompleteTradeRouteBody,
	ApiRouterTransactionForCompleteTradeRouteBody,
	Balance,
	CoinType,
	RouterCompleteTradeRoute,
	SerializedTransaction,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { TransactionBlock } from "@mysten/sui.js";

export class Router extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		maxExternalFeePercentage: 0.5, // 50%
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "router");
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getSupportedCoins() {
		return this.fetchApi<CoinType[]>("supported-coins");
	}

	public async getCompleteTradeRouteGivenAmountIn(
		inputs: ApiRouterCompleteTradeRouteBody,
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("trade-route", inputs, abortSignal);
	}

	// TODO: add all of these errors to return types !
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

	public async getTransactionForCompleteTradeRoute(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	) {
		return this.fetchApiTransaction<ApiRouterTransactionForCompleteTradeRouteBody>(
			"transactions/trade",
			inputs
		);
	}
}
