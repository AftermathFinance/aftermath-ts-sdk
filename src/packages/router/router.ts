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

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supported-coins");
	}

	public async getCompleteTradeRouteGivenAmountIn(
		inputs: ApiRouterCompleteTradeRouteBody,
		abortSignal?: AbortSignal
	): Promise<RouterCompleteTradeRoute | { error: string }> {
		try {
			return this.fetchApi<
				RouterCompleteTradeRoute,
				ApiRouterCompleteTradeRouteBody
			>("trade-route", inputs, abortSignal);
		} catch (e) {
			return {
				error: "No possible routes exist.",
			};
		}
	}

	public async getCompleteTradeRouteGivenAmountOut(
		inputs: ApiRouterCompleteTradeRouteBody,
		abortSignal?: AbortSignal
	): Promise<RouterCompleteTradeRoute | { error: string }> {
		try {
			return this.fetchApi<
				RouterCompleteTradeRoute,
				ApiRouterCompleteTradeRouteBody
			>("trade-route", inputs, abortSignal);
		} catch (e) {
			return {
				error: "No possible routes exist.",
			};
		}
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getTransactionForCompleteTradeRoute(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiRouterTransactionForCompleteTradeRouteBody
			>("transactions/trade", inputs)
		);
	}
}
