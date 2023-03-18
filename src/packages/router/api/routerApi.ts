import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { PoolCompleteObject } from "../../pools/poolsTypes";
import { CoinType } from "../../../types";

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

	// public fetchGraph = async () => {
	// 	const pools = await this.Provider.Pools().fetchAllPools();
	// 	const poolDynamicFields = await Promise.all(
	// 		pools.map((pool) =>
	// 			this.Provider.Pools().fetchPoolDynamicFields(pool.objectId)
	// 		)
	// 	);

	// 	const completePools: PoolCompleteObject[] = pools.map((pool, index) => {
	// 		return {
	// 			pool,
	// 			dynamicFields: poolDynamicFields[index],
	// 		};
	// 	});

	// 	const graph = RouterApiHelpers.newGraph();

	// 	completePools.map((pool) => RouterApiHelpers.addPool(graph, pool));

	// 	return graph;
	// };

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	// public getIntermediateTradeTransactions = (
	// 	path: RouterPath,
	// 	fromCoinId: ObjectId
	// ) => this.Helpers.intermediateTradeTransactions(path, fromCoinId);

	// public fetchFirstTradeTransactions = async (
	// 	walletAddress: SuiAddress,
	// 	fromCoinAmount: Balance,
	// 	path: RouterPath
	// ): Promise<SignableTransaction[]> => {
	// 	const { coinObjectId, joinAndSplitTransactions } =
	// 		await this.Provider.Coin().Helpers.fetchCoinJoinAndSplitWithExactAmountTransactions(
	// 			walletAddress,
	// 			path.baseAsset,
	// 			fromCoinAmount
	// 		);

	// 	const tradeTransactions = this.Helpers.intermediateTradeTransactions(
	// 		path,
	// 		coinObjectId
	// 	);

	// 	return [...joinAndSplitTransactions, ...tradeTransactions];
	// };

	/////////////////////////////////////////////////////////////////////
	//// Path Info
	/////////////////////////////////////////////////////////////////////

	// public getTradePathInfo = (
	// 	graph: Graph,
	// 	fromCoinType: CoinType,
	// 	toCoinType: CoinType
	// ): RouterCompleteRoute => {
	// 	const route = RouterApiHelpers.getBestRoute(
	// 		graph,
	// 		fromCoinType,
	// 		toCoinType,
	// 		BigInt(1),
	// 		3
	// 	);

	// 	const paths: RouterPath[] = route.path.map((path) => {
	// 		return {
	// 			baseAsset: path.nodeFrom.coinType,
	// 			quoteAsset: path.nodeTo.coinType,
	// 			pool: path.alongPool.source.pool,
	// 			weight: 0,
	// 		};
	// 	});

	// 	const spotPrice = RouterApiHelpers.calcRouteSpotPrice(route);

	// 	return { spotPrice, paths };
	// };
}
