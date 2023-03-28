import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Pool } from "../../pools";
import { Helpers } from "../../../general/utils/helpers";
import {
	Balance,
	PoolDynamicFields,
	RouterCompleteTradeRoute,
	RouterTradeInfo,
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
		tradePartitionCount: 100,
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
	): Promise<RouterCompleteTradeRoute> {
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

		const finalRoute = isGivenAmountOut
			? RouterGraph.transformCompleteRouteIfGivenAmountOut(completeRoute)
			: completeRoute;

		return finalRoute;
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
		maxRouteLength: number,
		isGivenAmountOut: boolean
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

		const emptyArray = Array(this.constants.tradePartitionCount + 1).fill(
			undefined
		);

		const linearCutStepSize =
			(routes.length - this.constants.minRoutesToCheck) /
			this.constants.tradePartitionCount;

		for (const [i] of emptyArray.entries()) {
			if (i === 0 && coinInRemainderAmount <= BigInt(0)) continue;

			const { updatedPools, updatedRoutes } =
				this.findNextRouteAndUpdatePoolsAndRoutes(
					Helpers.deepCopy(currentPools),
					Helpers.deepCopy(currentRoutes),
					i === 0 ? coinInRemainderAmount : coinInPartitionAmount,
					linearCutStepSize,
					isGivenAmountOut
				);

			currentPools = updatedPools;
			currentRoutes = updatedRoutes;
		}

		return currentRoutes;
	};

	private static findNextRouteAndUpdatePoolsAndRoutes = (
		pools: Pools,
		routes: RouterTradeRoute[],
		coinInAmount: Balance,
		linearCutStepSize: number,
		isGivenAmountOut: boolean
	): {
		updatedPools: Pools;
		updatedRoutes: RouterTradeRoute[];
	} => {
		const updatedRoutesAndPools = routes.map((route) =>
			this.getUpdatedPoolsAndRouteAfterTrade(
				Helpers.deepCopy(pools),
				Helpers.deepCopy(route),
				coinInAmount,
				isGivenAmountOut
			)
		);

		return this.cutUpdatedRoutesAndPools(
			updatedRoutesAndPools,
			isGivenAmountOut
			// "LINEAR",
			// linearCutStepSize
		);
	};

	private static cutUpdatedRoutesAndPools = (
		routesAndPools: {
			updatedPools: Pools;
			updatedRoute: RouterTradeRoute;
			coinOutAmount: Balance;
			startingRoute: RouterTradeRoute;
		}[],
		isGivenAmountOut: boolean,
		routeDecreaseType: "QUADRATIC" | "LINEAR" = "QUADRATIC",
		linearCutStepSize?: number
	): {
		updatedRoutes: RouterTradeRoute[];
		updatedPools: Pools;
	} => {
		if (routeDecreaseType === "LINEAR" && linearCutStepSize === undefined)
			throw new Error("linear cut step size has not been provided");

		// TODO: speed this up further by not sorting routesAndPools is already at minRoutesToCheck length

		const sortedRoutesAndPools = routesAndPools.sort((a, b) =>
			isGivenAmountOut
				? Number(a.coinOutAmount - b.coinOutAmount)
				: Number(b.coinOutAmount - a.coinOutAmount)
		);

		const firstUnusedRouteIndex = sortedRoutesAndPools.findIndex(
			(route) => route.coinOutAmount <= BigInt(0)
		);

		let newEndIndex;
		if (routeDecreaseType === "QUADRATIC") {
			const minRouteIndexToCheck =
				firstUnusedRouteIndex > this.constants.minRoutesToCheck
					? firstUnusedRouteIndex
					: this.constants.minRoutesToCheck;

			newEndIndex = Math.floor(
				(minRouteIndexToCheck + sortedRoutesAndPools.length) / 2
			);
		} else {
			newEndIndex =
				sortedRoutesAndPools.length - (linearCutStepSize ?? 0);
		}

		const cutRoutesAndPools = sortedRoutesAndPools.slice(
			0,
			newEndIndex > sortedRoutesAndPools.length
				? sortedRoutesAndPools.length
				: newEndIndex < this.constants.minRoutesToCheck
				? this.constants.minRoutesToCheck
				: newEndIndex
		);

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
		coinInAmount: Balance,
		isGivenAmountOut: boolean
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
			const coinOutAmount = isGivenAmountOut
				? pool.getTradeAmountIn(
						path.coinOut,
						currentCoinInAmount,
						path.coinIn
				  )
				: pool.getTradeAmountOut(
						path.coinIn,
						currentCoinInAmount,
						path.coinOut
				  );

			const updatedPool = this.getUpdatedPoolAfterTrade(
				pool,
				path.coinIn,
				currentCoinInAmount,
				path.coinOut,
				coinOutAmount,
				isGivenAmountOut
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
		coinOutAmount: Balance,
		isGivenAmountOut: boolean
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
		if (isGivenAmountOut) {
			newAmountDynamicFields[coinInDynamicFieldIndex].value +=
				coinOutAmount;
			newAmountDynamicFields[coinOutDynamicFieldIndex].value -=
				coinInAmount;
		} else {
			newAmountDynamicFields[coinInDynamicFieldIndex].value +=
				coinInAmount;
			newAmountDynamicFields[coinOutDynamicFieldIndex].value -=
				coinOutAmount;
		}

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
		const { coinInAmount, coinOutAmount } = tradeInfo;
		return {
			...tradeInfo,
			coinInAmount: coinOutAmount,
			coinOutAmount: coinInAmount,
		};
	};
}
