import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Pool } from "../../pools";
import { Helpers } from "../../../general/utils/helpers";
import {
	Balance,
	PoolDynamicFields,
	RouterCompleteTradeRoute,
	RouterTradeRoute,
} from "../../../types";

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

export class RouterGraph {
	/////////////////////////////////////////////////////////////////////
	//// Private Static Contstants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		// NOTE: should this default value be public ?
		defaultMaxRouteLength: 5,
		tradePartitionCount: BigInt(1000),
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Class Members
	/////////////////////////////////////////////////////////////////////

	private readonly graph: CoinGraph;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly pools: Pool[]) {
		if (pools.length <= 0) throw new Error("pools has length of 0");
		// check handle remove duplicate pools (same object Id)
		this.pools = pools;
		this.graph = RouterGraph.createGraph(pools);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	public getRoutes(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength: number = RouterGraph.constants.defaultMaxRouteLength
	): RouterCompleteTradeRoute {
		const routes = RouterGraph.findRoutes(
			this.graph,
			coinIn,
			coinInAmount,
			coinOut,
			maxRouteLength
		);

		const routesAfterTrades = RouterGraph.splitTradeBetweenRoutes(
			this.graph,
			routes,
			coinIn,
			coinInAmount,
			coinOut
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

		for (const [index, coinA] of poolObject.fields.coins
			.slice(0, -1)
			.entries()) {
			for (const coinB of poolObject.fields.coins.slice(index + 1)) {
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
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength: number
	): RouterTradeRoute[] => {
		const coinInEdges = graph.coinNodes[coinIn].toCoinThroughPoolEdges;
		const startingRoutes = this.createStartingRoutes(
			coinInEdges,
			coinIn,
			coinInAmount,
			coinOut
		);

		const routes = this.findCompleteRoutes(
			graph,
			startingRoutes,
			maxRouteLength
		);

		return routes;
	};

	private static createStartingRoutes = (
		coinInEdges: ToCoinThroughPoolEdges,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): RouterTradeRoute[] => {
		let routes: RouterTradeRoute[] = [];
		for (const [toCoin, throughPools] of Object.entries(coinInEdges)) {
			for (const poolObjectId of throughPools) {
				routes.push({
					coinIn,
					coinOut,
					coinInAmount,
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
		maxRouteLength: number
	): RouterTradeRoute[] => {
		let currentRoutes = [...routes];
		let completeRoutes: RouterTradeRoute[] = [];

		while (currentRoutes.length > 0) {
			let newCurrentRoutes: RouterTradeRoute[] = [];

			for (const route of currentRoutes) {
				if (route.paths.length >= maxRouteLength) {
					completeRoutes = [...completeRoutes, route];
					continue;
				}

				const lastPath = route.paths[route.paths.length - 1];

				for (const [toCoin, throughPools] of Object.entries(
					graph.coinNodes[lastPath.coinOut]
				)) {
					for (const poolObjectId of throughPools) {
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
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
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

		for (const i of emptyArray) {
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

			currentCoinInAmount = coinOutAmount;
			currentPools = {
				...currentPools,
				[path.poolObjectId]: updatedPool,
			};

			let newPath = {
				...path,

				coinInAmount: path.coinInAmount + coinInAmount,
				coinOutAmount: path.coinOutAmount + coinOutAmount,

				spotPrice: pool.getSpotPrice(path.coinIn, path.coinOut),
				tradeFee: pool.pool.fields.tradeFee,
			};

			newRoute = {
				...newRoute,

				paths: [...newRoute.paths, newPath],
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
		return {
			coinIn,
			coinOut,
			coinInAmount,
			coinOutAmount: routes[routes.length - 1].coinOutAmount,
			routes,
			tradeFee: BigInt(0),
			spotPrice: 0,
		};
	};
}
