import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Pool, Pools } from "../../pools";
import { Helpers } from "../../../general/utils/helpers";
import {
	Balance,
	RouterCompleteTradeRoute,
	RouterTradeInfo,
	RouterTradePath,
	RouterTradeRoute,
} from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Internal Types
/////////////////////////////////////////////////////////////////////

interface CoinGraph {
	coinNodes: CoinNodes;
	pools: PoolsById;
}

type CoinNodes = Record<CoinType, CoinNode>;
type PoolsById = Record<ObjectId, Pool>;

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
		// NOTE: should these default values be public ?
		defaultMaxRouteLength: 5,
		tradePartitionCount: 75,
		minRoutesToCheck: 20,
		maxPoolHopsForCompleteRoute: 10,
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

	public getCompleteRouteGivenAmountIn(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength?: number
	): RouterCompleteTradeRoute {
		return this.getCompleteRoute(
			coinIn,
			coinInAmount,
			coinOut,
			false,
			maxRouteLength
		);
	}

	public getCompleteRouteGivenAmountOut(
		coinIn: CoinType,
		coinOut: CoinType,
		coinOutAmount: Balance,
		maxRouteLength?: number
	): RouterCompleteTradeRoute {
		return this.getCompleteRoute(
			coinIn,
			coinOutAmount,
			coinOut,
			true,
			maxRouteLength
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	private getCompleteRoute(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		isGivenAmountOut: boolean,
		maxRouteLength: number = RouterGraph.constants.defaultMaxRouteLength
	): RouterCompleteTradeRoute {
		if (this.pools.length <= 0) throw new Error("pools has length of 0");

		const routes = RouterGraph.findRoutes(
			Helpers.deepCopy(this.graph),
			coinIn,
			coinOut,
			maxRouteLength,
			isGivenAmountOut
		);

		const routesAfterTrades = RouterGraph.splitTradeBetweenRoutes(
			Helpers.deepCopy(this.graph),
			routes,
			coinInAmount,
			isGivenAmountOut
		);

		const completeRoute = RouterGraph.completeRouteFromRoutes(
			routesAfterTrades,
			coinIn,
			coinInAmount,
			coinOut
		);

		const transformedRoute = isGivenAmountOut
			? RouterGraph.transformCompleteRouteIfGivenAmountOut(completeRoute)
			: completeRoute;

		return transformedRoute;
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
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
				const pools: PoolsById = {
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
		const coinTypes = Object.keys(poolObject.coins);

		let newCoinNodes: CoinNodes = { ...coinNodes };

		for (const coinA of coinTypes) {
			for (const coinB of coinTypes) {
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
		maxRouteLength: number,
		isGivenAmountOut: boolean
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
			maxRouteLength,
			isGivenAmountOut
		);

		return routes;
	};

	private static createStartingRoutes = (
		pools: PoolsById,
		coinInEdges: ToCoinThroughPoolEdges,
		coinIn: CoinType,
		coinOut: CoinType
	): RouterTradeRoute[] => {
		let routes: RouterTradeRoute[] = [];
		for (const [toCoin, throughPools] of Object.entries(coinInEdges)) {
			for (const poolObjectId of throughPools) {
				routes.push({
					coinIn: {
						type: coinIn,
						amount: BigInt(0),
						tradeFee: BigInt(0),
					},
					coinOut: {
						type: coinOut,
						amount: BigInt(0),
						tradeFee: BigInt(0),
					},
					spotPrice: 0,
					paths: [
						{
							poolObjectId,
							poolLpCoinType: pools[poolObjectId].pool.lpCoinType,
							coinIn: {
								type: coinIn,
								amount: BigInt(0),
								tradeFee: BigInt(0),
							},
							coinOut: {
								type: toCoin,
								amount: BigInt(0),
								tradeFee: BigInt(0),
							},
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
		maxRouteLength: number,
		isGivenAmountOut: boolean
	): RouterTradeRoute[] => {
		let currentRoutes = [...routes];
		let completeRoutes: RouterTradeRoute[] = [];

		while (currentRoutes.length > 0) {
			let newCurrentRoutes: RouterTradeRoute[] = [];

			for (const route of currentRoutes) {
				const lastPath = route.paths[route.paths.length - 1];

				if (lastPath.coinOut.type === coinOut) {
					completeRoutes = [...completeRoutes, route];
					continue;
				}

				if (route.paths.length >= maxRouteLength) continue;

				for (const [toCoin, throughPools] of Object.entries(
					graph.coinNodes[lastPath.coinOut.type]
						.toCoinThroughPoolEdges
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
										graph.pools[poolObjectId].pool
											.lpCoinType,
									coinIn: lastPath.coinOut,
									coinOut: {
										type: toCoin,
										amount: BigInt(0),
										tradeFee: BigInt(0),
									},
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

		const finalRoutes = isGivenAmountOut
			? completeRoutes.map((route) => {
					const newRoute = Helpers.deepCopy(route);
					return {
						...newRoute,
						paths: newRoute.paths.reverse(),
					};
			  })
			: completeRoutes;
		return finalRoutes;
	};

	private static splitTradeBetweenRoutes = (
		graph: CoinGraph,
		routes: RouterTradeRoute[],
		coinInAmount: Balance,
		isGivenAmountOut: boolean
	): RouterTradeRoute[] => {
		const coinInPartitionAmount =
			coinInAmount /
			BigInt(Math.floor(this.constants.tradePartitionCount));
		const coinInRemainderAmount =
			coinInAmount %
			BigInt(Math.floor(this.constants.tradePartitionCount));

		let currentPools = graph.pools;
		let currentRoutes = routes;

		const emptyArray = Array(this.constants.tradePartitionCount).fill(
			undefined
		);

		const linearCutStepSize =
			(routes.length - this.constants.minRoutesToCheck) /
			this.constants.tradePartitionCount;

		for (const [i] of emptyArray.entries()) {
			const { updatedPools, updatedRoutes } =
				this.findNextRouteAndUpdatePoolsAndRoutes(
					Helpers.deepCopy(currentPools),
					Helpers.deepCopy(currentRoutes),
					i === 0
						? coinInRemainderAmount + coinInPartitionAmount
						: coinInPartitionAmount,
					linearCutStepSize,
					isGivenAmountOut
				);

			currentPools = Helpers.deepCopy(updatedPools);
			currentRoutes = Helpers.deepCopy(updatedRoutes);
		}

		return currentRoutes;
	};

	private static findNextRouteAndUpdatePoolsAndRoutes = (
		pools: PoolsById,
		routes: RouterTradeRoute[],
		coinInAmount: Balance,
		linearCutStepSize: number,
		isGivenAmountOut: boolean
	): {
		updatedPools: PoolsById;
		updatedRoutes: RouterTradeRoute[];
	} => {
		const totalHops = this.totalHopsInRoutes(routes);

		const updatedRoutesAndPools = routes.map((route) =>
			this.getUpdatedPoolsAndRouteAfterTrade(
				Helpers.deepCopy(pools),
				Helpers.deepCopy(route),
				coinInAmount,
				totalHops,
				isGivenAmountOut
			)
		);

		const routesAndPoolsUnderMaxHops = updatedRoutesAndPools.filter(
			(data) => !data.isOverMaxHops
		);
		if (routesAndPoolsUnderMaxHops.length > 0) {
			const firstCheck = this.cutUpdatedRoutesAndPools(
				Helpers.deepCopy(routesAndPoolsUnderMaxHops),
				isGivenAmountOut
				// "LINEAR",
				// linearCutStepSize
			);

			if (
				isGivenAmountOut
					? firstCheck.coinOutAmount < BigInt("0xFFFFFFFFFFFFFFFF")
					: firstCheck.coinOutAmount > BigInt(0)
			)
				return firstCheck;
		}

		const routesAndPoolsOverMaxHops = updatedRoutesAndPools.filter(
			(data) => data.isOverMaxHops
		);
		if (routesAndPoolsOverMaxHops.length > 0) {
			const finalCheck = this.cutUpdatedRoutesAndPools(
				Helpers.deepCopy(routesAndPoolsOverMaxHops),
				isGivenAmountOut
				// "LINEAR",
				// linearCutStepSize
			);

			if (
				isGivenAmountOut
					? finalCheck.coinOutAmount < BigInt("0xFFFFFFFFFFFFFFFF")
					: finalCheck.coinOutAmount > BigInt(0)
			)
				return finalCheck;
		}

		throw Error("unable to find route");
	};

	private static cutUpdatedRoutesAndPools = (
		routesAndPools: {
			updatedPools: PoolsById;
			updatedRoute: RouterTradeRoute;
			coinOutAmount: Balance;
			startingRoute: RouterTradeRoute;
		}[],
		isGivenAmountOut: boolean,
		routeDecreaseType: "QUADRATIC" | "LINEAR" = "QUADRATIC",
		linearCutStepSize?: number
	): {
		updatedRoutes: RouterTradeRoute[];
		updatedPools: PoolsById;
		coinOutAmount: Balance;
	} => {
		if (routeDecreaseType === "LINEAR" && linearCutStepSize === undefined)
			throw new Error("linear cut step size has not been provided");

		// TODO: speed this up further by not sorting routesAndPools is already at minRoutesToCheck length

		const sortedRoutesAndPoolsByAmountOut = routesAndPools.sort((a, b) =>
			isGivenAmountOut
				? Number(a.coinOutAmount - b.coinOutAmount)
				: Number(b.coinOutAmount - a.coinOutAmount)
		);

		const firstUnusedRouteIndex = sortedRoutesAndPoolsByAmountOut.findIndex(
			(route) => route.startingRoute.coinOut.amount <= BigInt(0)
		);

		let newEndIndex;
		if (routeDecreaseType === "QUADRATIC") {
			const minRouteIndexToCheck =
				firstUnusedRouteIndex > this.constants.minRoutesToCheck
					? firstUnusedRouteIndex
					: this.constants.minRoutesToCheck;

			newEndIndex = Math.floor(
				(minRouteIndexToCheck +
					sortedRoutesAndPoolsByAmountOut.length) /
					2
			);
		} else {
			newEndIndex =
				sortedRoutesAndPoolsByAmountOut.length -
				(linearCutStepSize ?? 0);
		}

		const cutRoutesAndPools = sortedRoutesAndPoolsByAmountOut.slice(
			0,
			newEndIndex > sortedRoutesAndPoolsByAmountOut.length
				? sortedRoutesAndPoolsByAmountOut.length
				: newEndIndex < this.constants.minRoutesToCheck
				? this.constants.minRoutesToCheck
				: newEndIndex
		);

		const updatedRoutes = [
			cutRoutesAndPools[0].updatedRoute,
			...cutRoutesAndPools
				.slice(1)
				.map((udpatedData) => udpatedData.startingRoute),
		];

		return {
			updatedPools: cutRoutesAndPools[0].updatedPools,
			updatedRoutes,
			coinOutAmount: cutRoutesAndPools[0].updatedRoute.coinOut.amount,
		};
	};

	private static getUpdatedPoolsAndRouteAfterTrade = (
		pools: PoolsById,
		route: RouterTradeRoute,
		coinInAmount: Balance,
		currentTotalHops: number,
		isGivenAmountOut: boolean
	): {
		updatedPools: PoolsById;
		updatedRoute: RouterTradeRoute;
		coinOutAmount: Balance;
		startingRoute: RouterTradeRoute;
		isOverMaxHops: boolean;
	} => {
		const originalRoute = Helpers.deepCopy(route);

		const isOverMaxHops =
			originalRoute.coinIn.amount <= BigInt(0) &&
			originalRoute.paths.length + currentTotalHops >
				this.constants.maxPoolHopsForCompleteRoute;

		const failedAmount = isGivenAmountOut
			? BigInt("0xFFFFFFFFFFFFFFFF")
			: BigInt(0);

		let currentPools = Helpers.deepCopy(pools);
		let currentCoinInAmount = coinInAmount;
		let newRoute: RouterTradeRoute = { ...originalRoute, paths: [] };
		let routeSpotPrice = 1;

		for (const path of originalRoute.paths) {
			const pool = currentPools[path.poolObjectId];

			const spotPrice = pool.getSpotPrice({
				coinInType: path.coinIn.type,
				coinOutType: path.coinOut.type,
			});

			const poolBeforePathTrades = this.getUpdatedPoolAfterTrade(
				pool,
				path.coinIn.type,
				-path.coinIn.amount,
				path.coinOut.type,
				-path.coinOut.amount,
				isGivenAmountOut
			);

			const totalCoinInAmount = currentCoinInAmount + path.coinIn.amount;
			// (isGivenAmountOut ? path.coinOut.amount : path.coinIn.amount);

			let totalCoinOutAmount = isGivenAmountOut
				? poolBeforePathTrades.getTradeAmountIn({
						coinInType: path.coinIn.type,
						coinOutType: path.coinOut.type,
						coinOutAmount: totalCoinInAmount,
				  }).coinInAmount
				: poolBeforePathTrades.getTradeAmountOut({
						coinInType: path.coinIn.type,
						coinOutType: path.coinOut.type,
						coinInAmount: totalCoinInAmount,
				  }).coinOutAmount;

			let coinOutAmountFromTrade =
				totalCoinOutAmount >= path.coinOut.amount
					? totalCoinOutAmount - path.coinOut.amount
					: failedAmount;

			let updatedPool: Pool;
			if (
				(totalCoinOutAmount ||
					coinOutAmountFromTrade ||
					currentCoinInAmount) === failedAmount
			) {
				totalCoinOutAmount = failedAmount;
				coinOutAmountFromTrade = failedAmount;
				currentCoinInAmount = failedAmount;

				updatedPool = Helpers.deepCopy(pool);
			} else {
				updatedPool = this.getUpdatedPoolAfterTrade(
					pool,
					path.coinIn.type,
					currentCoinInAmount,
					path.coinOut.type,
					coinOutAmountFromTrade,
					isGivenAmountOut
				);
			}

			let newPath: RouterTradePath = {
				...path,
				coinIn: {
					...path.coinIn,
					amount: totalCoinInAmount,
				},
				coinOut: {
					...path.coinOut,
					amount: totalCoinOutAmount,
				},
				spotPrice,
			};

			newRoute = {
				...newRoute,
				paths: [...newRoute.paths, newPath],
			};

			currentCoinInAmount = coinOutAmountFromTrade;
			currentPools = {
				...currentPools,
				[path.poolObjectId]: updatedPool,
			};

			routeSpotPrice *= spotPrice;
		}

		const updatedRoute: RouterTradeRoute = {
			...newRoute,
			coinIn: {
				...newRoute.coinIn,
				amount: newRoute.paths[0].coinIn.amount,
			},
			coinOut: {
				...newRoute.coinOut,
				amount: newRoute.paths[newRoute.paths.length - 1].coinOut
					.amount,
			},
			spotPrice: routeSpotPrice,
		};

		return {
			updatedPools: currentPools,
			updatedRoute,
			coinOutAmount: currentCoinInAmount,
			startingRoute: route,
			isOverMaxHops,
		};
	};

	private static getUpdatedPoolAfterTrade = (
		pool: Pool,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		coinOutAmount: Balance,
		isGivenAmountOut: boolean
	) => {
		let newPoolObject = Helpers.deepCopy(pool.pool);

		if (isGivenAmountOut) {
			newPoolObject.coins[coinIn].balance += coinOutAmount;
			newPoolObject.coins[coinOut].balance -= coinInAmount;
		} else {
			newPoolObject.coins[coinIn].balance += coinInAmount;
			newPoolObject.coins[coinOut].balance -= coinOutAmount;
		}

		const newPool = new Pool(Helpers.deepCopy(newPoolObject), pool.network);
		return newPool;
	};

	private static completeRouteFromRoutes = (
		routes: RouterTradeRoute[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): RouterCompleteTradeRoute => {
		const nonZeroRoutes = routes.filter(
			(route) => route.coinIn.amount > BigInt(0)
		);
		const totalCoinOutAmount = nonZeroRoutes.reduce(
			(acc, cur) => acc + cur.coinOut.amount,
			BigInt(0)
		);
		const spotPrice = nonZeroRoutes.reduce(
			(acc, cur) =>
				acc +
				(Number(cur.coinIn.amount) / Number(coinInAmount)) *
					cur.spotPrice,
			0
		);

		return {
			coinIn: {
				type: coinIn,
				amount: coinInAmount,
				tradeFee: BigInt(0),
			},
			coinOut: {
				type: coinOut,
				amount: totalCoinOutAmount,
				tradeFee: BigInt(0),
			},
			routes: nonZeroRoutes,
			spotPrice,
		};
	};

	private static transformCompleteRouteIfGivenAmountOut = (
		completeRoute: RouterCompleteTradeRoute
	): RouterCompleteTradeRoute => {
		const newCompleteRoute =
			this.transformRouterTradeInfoIfGivenAmountOut(completeRoute);
		const newRoutes = completeRoute.routes.map((route) => {
			const newRoute =
				this.transformRouterTradeInfoIfGivenAmountOut(route);
			let newPaths = route.paths.map(
				this.transformRouterTradeInfoIfGivenAmountOut
			);
			newPaths.reverse();

			return {
				...newRoute,
				paths: newPaths,
			};
		});

		return {
			...newCompleteRoute,
			routes: newRoutes,
		};
	};

	private static transformRouterTradeInfoIfGivenAmountOut = <
		T extends Required<RouterTradeInfo>
	>(
		tradeInfo: T
	) => {
		const { coinIn, coinOut } = tradeInfo;
		return {
			...tradeInfo,
			coinIn: {
				...coinIn,
				amount: coinOut.amount,
			},
			coinOut: {
				...coinOut,
				amount: coinIn.amount,
			},
		};
	};

	private static totalHopsInRoutes = (routes: RouterTradeRoute[]) =>
		routes
			.filter((route) => route.coinIn.amount > BigInt(0))
			.reduce((acc, route) => acc + route.paths.length, 0);
}
