import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { PoolCompleteObject } from "../../pools/poolsTypes";
import { Balance, CoinType, RouterCompleteTradeRoute } from "../../../types";
import { Pool } from "../../pools";
import { RouterGraph } from "../utils/routerGraph";

export class RouterApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new RouterApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSupportedCoins = async () => {
		const pools = await this.Provider.Pools().fetchAllPools();
		const allCoins: CoinType[] = pools
			.map((pool) => pool.fields.coins)
			.reduce((prev, cur) => [...prev, ...cur], []);

		const uniqueCoins = [...new Set(allCoins)];
		return uniqueCoins;
	};

	public fetchCompleteTradeRouteGivenAmountIn = async (
		pools: Pool[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength?: number
	): Promise<RouterCompleteTradeRoute> => {
		return new RouterGraph(pools).getCompleteRouteGivenAmountIn(
			coinIn,
			coinInAmount,
			coinOut,
			maxRouteLength
		);
	};

	public fetchCompleteTradeRouteGivenAmountOut = async (
		pools: Pool[],
		coinIn: CoinType,
		coinOut: CoinType,
		coinOutAmount: Balance,
		maxRouteLength?: number
	): Promise<RouterCompleteTradeRoute> => {
		return new RouterGraph(pools).getCompleteRouteGivenAmountOut(
			coinIn,
			coinOut,
			coinOutAmount,
			maxRouteLength
		);
	};
}
