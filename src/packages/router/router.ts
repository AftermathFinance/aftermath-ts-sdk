import {
	ApiRouterCompleteTradeRouteBody,
	Balance,
	CoinType,
	RouterCompleteTradeRoute,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";

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
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): Promise<RouterCompleteTradeRoute> {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("tradeRoute", {
			coinIn,
			coinInAmount,
			coinOut,
		});
	}

	public async getCompleteTradeRouteGivenAmountOut(
		coinIn: CoinType,
		coinOut: CoinType,
		coinOutAmount: Balance
	): Promise<RouterCompleteTradeRoute> {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("tradeRoute", {
			coinIn,
			coinOut,
			coinOutAmount,
		});
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////
}
