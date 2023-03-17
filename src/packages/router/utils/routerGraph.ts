import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Pool } from "../../pools";
import { Helpers } from "../../../general/utils/helpers";
import {
	Balance,
	PoolDynamicFields,
	RouterCompleteTradeRoute,
	RouterTradeRoute,
	SuiNetwork,
} from "../../../types";
import { Caller } from "../../../general/utils/caller";

/////////////////////////////////////////////////////////////////////
//// Internal Types
/////////////////////////////////////////////////////////////////////

interface CoinGraph {
	coinNodes: CoinNodes;
	pools: Pools;
}

type CoinNodes = Record<CoinType, CoinNode>;
type Pools = Record<ObjectId, Pool>;

interface CoinNode {
	coin: CoinType;
	toCoinThroughPoolEdges: ToCoinThroughPoolEdges;
}

type ToCoinThroughPoolEdges = Record<CoinType, ObjectId[]>;

/////////////////////////////////////////////////////////////////////
//// Class
/////////////////////////////////////////////////////////////////////

export class RouterGraph extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Private Static Contstants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		// NOTE: should this default value be public ?
		defaultMaxRouteLength: 3,
		tradePartitionCount: BigInt(1000),
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Class Members
	/////////////////////////////////////////////////////////////////////

	private readonly graph: CoinGraph;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly pools: Pool[],
		public readonly network?: SuiNetwork
	) {
		// if (pools.length <= 0) throw new Error("pools has length of 0");

		super(network, "router");

		// check handle remove duplicate pools (same object Id)
		this.pools = pools;
		this.graph = RouterGraph.createGraph(pools);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supportedCoins");
	}

	public getCompleteRoute(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength: number = RouterGraph.constants.defaultMaxRouteLength
	): RouterCompleteTradeRoute {
		const routes = RouterGraph.findRoutes(
			this.graph,
			coinIn,
			coinOut,
			maxRouteLength
		);

		const routesAfterTrades = RouterGraph.splitTradeBetweenRoutes(
			this.graph,
			routes,
			coinInAmount
		);

		const completeRoute = RouterGraph.completeRouteFromRoutes(
			routesAfterTrades,
			coinIn,
			coinInAmount,
			coinOut
		);

		return completeRoute;
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Graph Creation
	/////////////////////////////////////////////////////////////////////

	private static createGraph(pools: Pool[]): CoinGraph {
		const graph: CoinGraph = pools.reduce(
			(graph, pool) => {
				const coinNodes = this.updateCoinNodesFromPool(
					graph.coinNodes,
					pool
				);
				const pools: Pools = {
					...graph.pools,
					[pool.pool.objectId]: pool,
				};

				return {
					coinNodes,
					pools,
				};
			},
			{
				coinNodes: {},
				pools: {},
			}
		);
		return graph;
	}

	private static updateCoinNodesFromPool = (
		coinNodes: CoinNodes,
		pool: Pool
	): CoinNodes => {
		const poolObject = pool.pool;

		let newCoinNodes: CoinNodes = { ...coinNodes };

		// for (const [index, coinA] of poolObject.fields.coins
		// 	.slice(0, -1)
		// 	.entries()) {
		// 	for (const coinB of poolObject.fields.coins.slice(index + 1)) {
		for (const coinA of poolObject.fields.coins) {
			for (const coinB of poolObject.fields.coins) {
				if (coinA === coinB) continue;

				newCoinNodes =
					coinA in newCoinNodes
						? {
								...newCoinNodes,
								[coinA]: {
									...newCoinNodes[coinA],
									toCoinThroughPoolEdges:
										coinB in
										newCoinNodes[coinA]
											.toCoinThroughPoolEdges
											? {
													...newCoinNodes[coinA]
														.toCoinThroughPoolEdges,
													[coinB]:
														Helpers.uniqueArray([
															...newCoinNodes[
																coinA
															]
																.toCoinThroughPoolEdges[
																coinB
															],
															poolObject.objectId,
														]),
											  }
											: {
													...newCoinNodes[coinA]
														.toCoinThroughPoolEdges,
													[coinB]: [
														poolObject.objectId,
													],
											  },
								},
						  }
						: {
								...newCoinNodes,
								[coinA]: {
									coin: coinA,
									toCoinThroughPoolEdges: {
										[coinB]: [poolObject.objectId],
									},
								},
						  };
			}
		}

		return newCoinNodes;
	};

	/////////////////////////////////////////////////////////////////////
	//// Route Finding
	/////////////////////////////////////////////////////////////////////

	private static findRoutes = (
		graph: CoinGraph,
		coinIn: CoinType,
		coinOut: CoinType,
		maxRouteLength: number
	): RouterTradeRoute[] => {
		const coinInEdges = graph.coinNodes[coinIn].toCoinThroughPoolEdges;
		const startingRoutes = this.createStartingRoutes(
			coinInEdges,
			coinIn,
			coinOut
		);

		const routes = this.findCompleteRoutes(
			graph,
			startingRoutes,
			coinOut,
			maxRouteLength
		);

		return routes;
	};

	private static createStartingRoutes = (
		coinInEdges: ToCoinThroughPoolEdges,
		coinIn: CoinType,
		coinOut: CoinType
	): RouterTradeRoute[] => {
		let routes: RouterTradeRoute[] = [];
		for (const [toCoin, throughPools] of Object.entries(coinInEdges)) {
			for (const poolObjectId of throughPools) {
				routes.push({
					coinIn,
					coinOut,
					coinInAmount: BigInt(0),
					coinOutAmount: BigInt(0),
					tradeFee: BigInt(0),
					spotPrice: 0,
					paths: [
						{
							poolObjectId,
							coinIn,
							coinOut: toCoin,
							coinInAmount: BigInt(0),
							coinOutAmount: BigInt(0),
							tradeFee: BigInt(0),
							spotPrice: 0,
						},
					],
				});
			}
		}

		return routes;
	};

	private static findCompleteRoutes = (
		graph: CoinGraph,
		routes: RouterTradeRoute[],
		coinOut: CoinType,
		maxRouteLength: number
	): RouterTradeRoute[] => {
		let currentRoutes = [...routes];
		let completeRoutes: RouterTradeRoute[] = [];

		while (currentRoutes.length > 0) {
			let newCurrentRoutes: RouterTradeRoute[] = [];

			for (const route of currentRoutes) {
				const lastPath = route.paths[route.paths.length - 1];

				if (
					route.paths.length >= maxRouteLength ||
					lastPath.coinOut === coinOut
				) {
					completeRoutes = [...completeRoutes, route];
					continue;
				}

				for (const [toCoin, throughPools] of Object.entries(
					graph.coinNodes[lastPath.coinOut].toCoinThroughPoolEdges
				)) {
					for (const poolObjectId of throughPools) {
						if (
							route.paths.some(
								(path) =>
									// ((path.coinIn === lastPath.coinOut &&
									// 	path.coinOut === toCoin) ||
									// 	(path.coinOut === lastPath.coinOut &&
									// 		path.coinIn === toCoin)) &&
									// path.poolObjectId === poolObjectId
									path.poolObjectId === poolObjectId
							)
						)
							continue;

						const newRoute: RouterTradeRoute = {
							...route,
							paths: [
								...route.paths,
								{
									poolObjectId,
									coinIn: lastPath.coinOut,
									coinOut: toCoin,
									coinInAmount: BigInt(0),
									coinOutAmount: BigInt(0),
									tradeFee: BigInt(0),
									spotPrice: 0,
								},
							],
						};

						newCurrentRoutes = [...newCurrentRoutes, newRoute];
					}
				}
			}
			currentRoutes = [...newCurrentRoutes];
		}

		return completeRoutes;
	};

	private static splitTradeBetweenRoutes = (
		graph: CoinGraph,
		routes: RouterTradeRoute[],
		coinInAmount: Balance
	): RouterTradeRoute[] => {
		const coinInPartitionAmount =
			coinInAmount / this.constants.tradePartitionCount;
		const coinInRemainderAmount =
			coinInAmount % this.constants.tradePartitionCount;

		let currentPools = graph.pools;
		let currentRoutes = routes;

		const emptyArray = Array(
			Number(this.constants.tradePartitionCount) + 1
		).fill(undefined);

		for (const [i] of emptyArray.entries()) {
			if (i === 0 && coinInRemainderAmount <= BigInt(0)) continue;

			const { updatedPools, updatedRoutes } =
				this.findNextRouteAndUpdatePoolsAndRoutes(
					currentPools,
					currentRoutes,
					i === 0 ? coinInRemainderAmount : coinInPartitionAmount
				);

			currentPools = updatedPools;
			currentRoutes = updatedRoutes;
		}

		return currentRoutes;
	};

	private static findNextRouteAndUpdatePoolsAndRoutes = (
		pools: Pools,
		routes: RouterTradeRoute[],
		coinInAmount: Balance
	): {
		updatedPools: Pools;
		updatedRoutes: RouterTradeRoute[];
	} => {
		const indexOfBestRoute = this.indexOfBestRouteForTrade(
			pools,
			routes,
			coinInAmount
		);

		const bestRoute = routes[indexOfBestRoute];
		const { updatedPools, updatedRoute } =
			RouterGraph.getUpdatedPoolsAndRouteAfterTrade(
				bestRoute,
				pools,
				coinInAmount
			);

		let updatedRoutes = [...routes];
		updatedRoutes[indexOfBestRoute] = updatedRoute;

		return {
			updatedPools,
			updatedRoutes,
		};
	};

	private static indexOfBestRouteForTrade = (
		pools: Pools,
		routes: RouterTradeRoute[],
		coinInAmount: Balance
	) => {
		return Helpers.indexOfMax(
			routes.map((route) =>
				route.paths.reduce((acc, path) => {
					return pools[path.poolObjectId].getTradeAmountOut(
						path.coinIn,
						acc,
						path.coinOut
					);
				}, coinInAmount)
			)
		);
	};

	private static getUpdatedPoolsAndRouteAfterTrade = (
		route: RouterTradeRoute,
		pools: Pools,
		coinInAmount: Balance
	) => {
		let currentPools = { ...pools };
		let currentCoinInAmount = coinInAmount;
		let newRoute: RouterTradeRoute = { ...route, paths: [] };

		for (const path of route.paths) {
			const pool = currentPools[path.poolObjectId];
			const coinOutAmount = pool.getTradeAmountOut(
				path.coinIn,
				currentCoinInAmount,
				path.coinOut
			);

			const updatedPool = this.getUpdatedPoolAfterTrade(
				pool,
				path.coinIn,
				currentCoinInAmount,
				path.coinOut,
				coinOutAmount
			);

			let newPath = {
				...path,

				coinInAmount: path.coinInAmount + currentCoinInAmount,
				coinOutAmount: path.coinOutAmount + coinOutAmount,

				spotPrice: pool.getSpotPrice(path.coinIn, path.coinOut),
				tradeFee: pool.pool.fields.tradeFee,
			};

			newRoute = {
				...newRoute,
				paths: [...newRoute.paths, newPath],
			};

			currentCoinInAmount = coinOutAmount;
			currentPools = {
				...currentPools,
				[path.poolObjectId]: updatedPool,
			};
		}

		const updatedRoute = {
			...newRoute,
			coinInAmount: newRoute.coinInAmount + coinInAmount,
			coinOutAmount: newRoute.coinOutAmount + currentCoinInAmount,
		};

		return {
			updatedPools: currentPools,
			updatedRoute,
		};
	};

	private static getUpdatedPoolAfterTrade = (
		pool: Pool,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		coinOutAmount: Balance
	) => {
		const poolDynamicFields = pool.dynamicFields;
		const poolAmountDynamicFields = poolDynamicFields.amountFields;

		const coinInDynamicFieldIndex = poolAmountDynamicFields.findIndex(
			(field) => field.coin === coinIn
		);
		const coinOutDynamicFieldIndex = poolAmountDynamicFields.findIndex(
			(field) => field.coin === coinOut
		);

		let newAmountDynamicFields = [...poolAmountDynamicFields];
		newAmountDynamicFields[coinInDynamicFieldIndex].value += coinInAmount;
		newAmountDynamicFields[coinOutDynamicFieldIndex].value -= coinOutAmount;

		const newDynamicFields: PoolDynamicFields = {
			...poolDynamicFields,
			amountFields: newAmountDynamicFields,
		};

		const newPool = new Pool(pool.pool, newDynamicFields, pool.network);
		return newPool;
	};

	private static completeRouteFromRoutes = (
		routes: RouterTradeRoute[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): RouterCompleteTradeRoute => {
		const nonZeroRoutes = routes.filter(
			(route) => route.coinInAmount > BigInt(0)
		);
		return {
			coinIn,
			coinOut,
			coinInAmount,
			coinOutAmount: nonZeroRoutes.reduce(
				(acc, cur) => acc + cur.coinOutAmount,
				BigInt(0)
			),
			routes: nonZeroRoutes,
			tradeFee: BigInt(0),
			spotPrice: 0,
		};
	};
}
