import { ObjectId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { PoolCompleteObject } from "../../pools/poolsTypes";
import { Graph, RouterPath, RouterPathInfo } from "../routerTypes";
import { Balance, CoinType } from "../../../types";

export class RouterApi extends RouterApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(Provider: AftermathApi) {
		super(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Graph
	/////////////////////////////////////////////////////////////////////

	public fetchIndicesRouterGraph = async () => {
		const pools = await this.Provider.Pools().fetchAllPools();
		const poolDynamicFields = await Promise.all(
			pools.map((pool) =>
				this.Provider.Pools().fetchPoolDynamicFields(pool.objectId)
			)
		);

		const completePools: PoolCompleteObject[] = pools.map((pool, index) => {
			return {
				pool,
				dynamicFields: poolDynamicFields[index],
			};
		});

		const graph = RouterApiHelpers.newGraph();

		completePools.map((pool) => RouterApiHelpers.addPool(graph, pool));

		return graph;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public getIntermediateTradeTransactions = (
		path: RouterPath,
		fromCoinId: ObjectId
	) => this.intermediateTradeTransactions(path, fromCoinId);

	public fetchFirstTradeTransactions = async (
		walletAddress: SuiAddress,
		fromCoinAmount: Balance,
		path: RouterPath
	): Promise<SignableTransaction[]> => {
		const { coinObjectId, joinAndSplitTransactions } =
			await this.Provider.Coin.fetchCoinJoinAndSplitWithExactAmountTransactions(
				walletAddress,
				path.baseAsset,
				fromCoinAmount
			);

		const tradeTransactions = this.intermediateTradeTransactions(
			path,
			coinObjectId
		);

		return [...joinAndSplitTransactions, ...tradeTransactions];
	};

	/////////////////////////////////////////////////////////////////////
	//// Info
	/////////////////////////////////////////////////////////////////////

	public getTradePathInfo = (
		graph: Graph,
		fromCoinType: CoinType,
		toCoinType: CoinType
	): RouterPathInfo => {
		const route = RouterApiHelpers.getBestRoute(
			graph,
			fromCoinType,
			toCoinType,
			BigInt(1),
			3
		);

		const paths: RouterPath[] = route.path.map((path) => {
			return {
				baseAsset: path.nodeFrom.coinType,
				quoteAsset: path.nodeTo.coinType,
				pool: path.alongPool.source.pool,
				weight: 0,
			};
		});

		const spotPrice = RouterApiHelpers.calcRouteSpotPrice(route);

		return { spotPrice, paths };
	};
}
