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
		defaultMaxRouteLength: 4,
		tradePartitionCount: BigInt(100),
		minRoutesToCheck: 25,
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Class Members
	/////////////////////////////////////////////////////////////////////

	private readonly graph: CoinGraph;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly pools: Pool[]) {
		// TODO: check handle remove duplicate pools (same object Id) to avoid errors ?
		this.pools = pools;
		this.graph = RouterGraph.createGraph(pools);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	public getCompleteRoute(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength: number = RouterGraph.constants.defaultMaxRouteLength
	): Promise<RouterCompleteTradeRoute> {
		if (this.pools.length <= 0) throw new Error("pools has length of 0");

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

		return Promise.resolve(completeRoute);
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
			graph.pools,
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
		pools: Pools,
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
							poolLpCoinType:
								pools[poolObjectId].pool.fields.lpType,
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

				if (lastPath.coinOut === coinOut) {
					completeRoutes = [...completeRoutes, route];
					continue;
				}

				if (route.paths.length >= maxRouteLength) continue;

				for (const [toCoin, throughPools] of Object.entries(
					graph.coinNodes[lastPath.coinOut].toCoinThroughPoolEdges
				)) {
					for (const poolObjectId of throughPools) {
						if (
							// route.paths.some(
							// 	// NOTE: would it ever make sense to go back into a pool ?
							// 	// (could relax this restriction)
							// 	(path) => path.poolObjectId === poolObjectId
							// )
							lastPath.poolObjectId === poolObjectId
						)
							continue;

						const newRoute: RouterTradeRoute = {
							...route,
							paths: [
								...route.paths,
								{
									poolObjectId,
									poolLpCoinType:
										graph.pools[poolObjectId].pool.fields
											.lpType,
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
					Helpers.deepCopy(currentPools),
					Helpers.deepCopy(currentRoutes),
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
		const updatedRoutesAndPools = routes.map((route) =>
			RouterGraph.getUpdatedPoolsAndRouteAfterTrade(
				Helpers.deepCopy(pools),
				Helpers.deepCopy(route),
				coinInAmount
			)
		);

		return this.cutUpdatedRoutesAndPools(updatedRoutesAndPools);
	};

	private static cutUpdatedRoutesAndPools = (
		routesAndPools: {
			updatedPools: Pools;
			updatedRoute: RouterTradeRoute;
			coinOutAmount: Balance;
			startingRoute: RouterTradeRoute;
		}[]
	): {
		updatedRoutes: RouterTradeRoute[];
		updatedPools: Pools;
	} => {
		const sortedRoutesAndPools = routesAndPools.sort((a, b) =>
			Number(b.coinOutAmount - a.coinOutAmount)
		);

		const firstUnusedRouteIndex = sortedRoutesAndPools.findIndex(
			(route) => route.coinOutAmount <= BigInt(0)
		);

		const minRouteIndexToCheck =
			firstUnusedRouteIndex > this.constants.minRoutesToCheck
				? firstUnusedRouteIndex
				: this.constants.minRoutesToCheck;
		const newEndIndex = Math.floor(
			(minRouteIndexToCheck + sortedRoutesAndPools.length) / 2
		);

		const cutRoutesAndPools = sortedRoutesAndPools.slice(0, newEndIndex);

		const updatedRoutes = [
			cutRoutesAndPools[0].updatedRoute,
			...cutRoutesAndPools
				.map((udpatedData) => udpatedData.startingRoute)
				.slice(1),
		];

		return {
			updatedPools: cutRoutesAndPools[0].updatedPools,
			updatedRoutes,
		};
	};

	private static getUpdatedPoolsAndRouteAfterTrade = (
		pools: Pools,
		route: RouterTradeRoute,
		coinInAmount: Balance
	): {
		updatedPools: Pools;
		updatedRoute: RouterTradeRoute;
		coinOutAmount: Balance;
		startingRoute: RouterTradeRoute;
	} => {
		const originalRoute = Helpers.deepCopy(route);
		let currentPools = Helpers.deepCopy(pools);
		let currentCoinInAmount = coinInAmount;
		let newRoute: RouterTradeRoute = { ...originalRoute, paths: [] };
		let routeSpotPrice = 1;

		for (const path of originalRoute.paths) {
			const pool = currentPools[path.poolObjectId];
			const spotPrice = pool.getSpotPrice(path.coinIn, path.coinOut);
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
				spotPrice,
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

			routeSpotPrice *= spotPrice;
		}

		const updatedRoute: RouterTradeRoute = {
			...newRoute,
			coinInAmount: newRoute.coinInAmount + coinInAmount,
			coinOutAmount: newRoute.coinOutAmount + currentCoinInAmount,
			spotPrice: routeSpotPrice,
		};

		return {
			updatedPools: currentPools,
			updatedRoute,
			coinOutAmount: currentCoinInAmount,
			startingRoute: route,
		};
	};

	private static getUpdatedPoolAfterTrade = (
		pool: Pool,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		coinOutAmount: Balance
	) => {
		const poolDynamicFields = Helpers.deepCopy(pool.dynamicFields);
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

		const newPool = new Pool(
			Helpers.deepCopy(pool.pool),
			newDynamicFields,
			pool.network
		);
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
		const totalCoinOutAmount = nonZeroRoutes.reduce(
			(acc, cur) => acc + cur.coinOutAmount,
			BigInt(0)
		);
		const spotPrice = nonZeroRoutes.reduce(
			(acc, cur) =>
				acc +
				(Number(cur.coinInAmount) / Number(coinInAmount)) *
					cur.spotPrice,
			0
		);

		return {
			coinIn,
			coinOut,
			coinInAmount,
			coinOutAmount: totalCoinOutAmount,
			routes: nonZeroRoutes,
			tradeFee: BigInt(0),
			spotPrice,
		};
	};
}
