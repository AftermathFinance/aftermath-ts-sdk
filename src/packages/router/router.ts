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
import { SuiAddress, TransactionBlock } from "@mysten/sui.js";

export class Router extends Caller {
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
		return this.fetchApi("supportedCoins");
	}

	public async getCompleteTradeRouteGivenAmountIn(
		inputs: ApiRouterCompleteTradeRouteBody
	): Promise<RouterCompleteTradeRoute> {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("tradeRoute", inputs);
	}

	public async getCompleteTradeRouteGivenAmountOut(
		inputs: ApiRouterCompleteTradeRouteBody
	): Promise<RouterCompleteTradeRoute> {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("tradeRoute", inputs);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getTransactionForCompleteTradeRoute(
		walletAddress: SuiAddress,
		completeRoute: RouterCompleteTradeRoute
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiRouterTransactionForCompleteTradeRouteBody
			>("transactions/trade", {
				walletAddress,
				completeRoute,
			})
		);
	}
}
