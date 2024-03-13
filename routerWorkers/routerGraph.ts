import { CoinType } from "../src/packages/coin/coinTypes";
import {
	Balance,
	RouterCompleteGraph,
	RouterCompleteTradeRoute,
	RouterSynchronousOptions,
	RouterSerializableCompleteGraph,
	RouterTradeCoin,
	RouterTradeInfo,
	RouterTradePath,
	RouterTradeRoute,
	RouterSerializablePoolsById,
	SuiNetwork,
	UniqueId,
	Url,
	RouterPoolsById,
	RouterSerializablePool,
	SuiAddress,
	RouterSynchronousProtocolName,
	RouterProtocolName,
	RouterGraphCoinToPoolIds,
	ExternalFee,
} from "../src/types";
import {
	// RouterPoolInterface,
	createRouterPool,
} from "../src/packages/router/utils/synchronous/interfaces/routerPoolInterface";

type RouterPoolInterface = any;

const addLeadingZeroesToType = (type: any): any => {
	const expectedTypeLength = 64;

	let strippedType = type.replace("0x", "");
	let typeSuffix = "";

	if (strippedType.includes("::")) {
		const splitType = strippedType.replace("0x", "").split("::");

		typeSuffix = splitType
			.slice(1)
			// @ts-ignore
			.reduce((acc, str) => acc + "::" + str, "");
		strippedType = splitType[0];
	}

	const typeLength = strippedType.length;

	if (typeLength > expectedTypeLength) throw new Error("invalid type length");

	const zeros = Array(expectedTypeLength - typeLength)
		.fill("0")
		.reduce((acc, val) => acc + val, "");
	const newType = "0x" + zeros + strippedType;

	return newType + typeSuffix;
};

const deepCopy = <T>(target: T): T => {
	if (target === null) {
		return target;
	}
	if (target instanceof Date) {
		return new Date(target.getTime()) as any;
	}
	if (target instanceof Array) {
		const cp = [] as any[];
		(target as any[]).forEach((v) => {
			cp.push(v);
		});
		return cp.map((n: any) => deepCopy<any>(n)) as any;
	}
	if (typeof target === "object") {
		const cp = { ...(target as { [key: string]: any }) } as {
			[key: string]: any;
		};
		Object.keys(cp).forEach((k) => {
			cp[k] = deepCopy<any>(cp[k]);
		});
		return cp as T;
	}
	return target;
};

// =========================================================================
//  Internal Types
// =========================================================================

type CompleteTradeRoute = {
	routes: TradeRoute[];
} & TradeInfo;

type TradeRoute = {
	paths: TradePath[];
} & TradeInfo;

type TradePath = TradeInfo & {
	poolUid: UniqueId;
};

type TradeInfo = RouterTradeInfo & {
	estimatedGasCost: Balance; // in SUI
};

// =========================================================================
//  Class
// =========================================================================

export class RouterGraph {
	// =========================================================================
	//  Public Static Constants
	// =========================================================================

	// =========================================================================
	//  Class Members
	// =========================================================================

	// =========================================================================
	//  Public Methods
	// =========================================================================

	public static getCompleteRouteGivenAmountIn(inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
		// constructor
		network: SuiNetwork;
		graph: RouterSerializableCompleteGraph;
		options: RouterSynchronousOptions;
		excludeProtocols?: RouterProtocolName[];
	}): RouterCompleteTradeRoute {
		const graph = RouterGraph.graphFromSerializable(inputs);
		const result = this.getCompleteRoute({
			...inputs,
			graph,
			isGivenAmountOut: false,
		});
		return result;
	}

	public static getCompleteRouteGivenAmountOut(inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
		// constructor
		network: SuiNetwork;
		graph: RouterSerializableCompleteGraph;
		options: RouterSynchronousOptions;
		excludeProtocols?: RouterProtocolName[];
	}): RouterCompleteTradeRoute {
		const graph = RouterGraph.graphFromSerializable(inputs);
		const result = this.getCompleteRoute({
			...inputs,
			graph,
			coinInAmount: inputs.coinOutAmount,
			isGivenAmountOut: true,
		});
		return result;
	}

	public static getCompleteRoutesGivenAmountIns(inputs: {
		coinInType: CoinType;
		coinInAmounts: Balance[];
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
		// constructor
		network: SuiNetwork;
		graph: RouterCompleteGraph;
		options: RouterSynchronousOptions;
		excludeProtocols?: RouterProtocolName[];
	}): RouterCompleteTradeRoute[] {
		const completeRoutes = inputs.coinInAmounts.map((coinInAmount) => {
			try {
				return this.getCompleteRoute({
					...inputs,
					coinInAmount,
					isGivenAmountOut: false,
				});
			} catch (e) {
				return {
					routes: [],
					coinIn: {
						type: inputs.coinInType,
						amount: coinInAmount,
						tradeFee: BigInt(0),
					},
					coinOut: {
						type: inputs.coinOutType,
						amount: BigInt(0),
						tradeFee: BigInt(0),
					},
					spotPrice: 0,
				};
			}
		});

		const result = completeRoutes.every(
			(route) => route.routes.length === 0
		)
			? []
			: completeRoutes;

		return result;
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Graph Creation
	// =========================================================================

	public static createGraph(inputs: {
		pools: RouterSerializablePool[];
	}): RouterSerializableCompleteGraph {
		const poolClasses = inputs.pools.map((pool) =>
			createRouterPool({
				pool,
				network: "",
			})
		);

		// const graph: RouterSerializableCompleteGraph = poolClasses.reduce(
		// 	(graph, pool) => {
		// 		const coinNodes = this.updateCoinNodesFromPool(
		// 			graph.coinNodes,
		// 			pool
		// 		);
		// 		const pools: RouterSerializablePoolsById = {
		// 			...graph.pools,
		// 			[pool.uid]: pool.pool,
		// 		};

		// 		return {
		// 			coinNodes,
		// 			pools,
		// 		};
		// 	},
		// 	{
		// 		coinNodes: {},
		// 		pools: {},
		// 	}
		// );

		const graph: RouterSerializableCompleteGraph = poolClasses.reduce(
			(graph, pool) => {
				const coinNodes = this.updateCoinNodesFromPool(
					graph.coinNodes,
					pool
				);
				const pools: RouterSerializablePoolsById = {
					...graph.pools,
					[pool.uid]: pool.pool,
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

	public static graphFromSerializable(inputs: {
		graph: RouterSerializableCompleteGraph;
		network: SuiNetwork;
		excludeProtocols?: RouterProtocolName[];
	}): RouterCompleteGraph {
		const pools: RouterPoolsById = Object.entries(
			inputs.graph.pools
		).reduce((acc, [uid, pool]) => {
			const poolClass = createRouterPool({
				pool,
				network: inputs.network,
			});

			if (
				poolClass.noHopsAllowed ||
				inputs.excludeProtocols?.includes(poolClass.protocolName)
			)
				return acc;

			return {
				...acc,
				[uid]: poolClass,
			};
		}, {});

		// const coinNodes = Object.entries(inputs.graph.coinNodes).reduce(
		// 	(acc, [coinIn, coinNode]) => ({
		// 		acc,
		// 		[coinIn]: {
		// 			...coinNode,
		// 			coinOutThroughPoolEdges: Object.entries(
		// 				coinNode.coinOutThroughPoolEdges
		// 			).reduce(
		// 				(acc, [coin, poolUids]) => ({
		// 					...acc,
		// 					[coin]: poolUids.filter((uid) =>
		// 						Object.keys(pools).includes(uid)
		// 					),
		// 				}),
		// 				{}
		// 			),
		// 		},
		// 	}),
		// 	{}
		// );

		const graph: RouterCompleteGraph = {
			coinNodes: inputs.graph.coinNodes,
			pools,
		};
		return graph;
	}

	// =========================================================================
	//  Supported Coins
	// =========================================================================

	public static supportedCoinsFromGraph = (inputs: {
		graph: RouterSerializableCompleteGraph;
	}): CoinType[] => {
		return Object.keys(inputs.graph.coinNodes);
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	private static getCompleteRoute(inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		isGivenAmountOut: boolean;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
		// constructor
		network: SuiNetwork;
		graph: RouterCompleteGraph;
		options: RouterSynchronousOptions;
		excludeProtocols?: RouterProtocolName[];
	}): RouterCompleteTradeRoute {
		if (Object.keys(inputs.graph).length <= 0)
			throw new Error("empty graphs");

		const {
			coinInType,
			coinInAmount,
			coinOutType,
			referrer,
			externalFee,
			isGivenAmountOut,
			graph,
			options,
		} = inputs;

		if (externalFee && externalFee.feePercentage >= 0.5)
			throw new Error(`external fee percentage exceeds max of ${0.5}`);

		const routes = RouterGraph.findRoutes(
			deepCopy(graph),
			coinInType,
			coinOutType,
			options.maxRouteLength,
			isGivenAmountOut,
			options.maxRoutesToCheck
		);

		const routesAfterTrades = this.splitTradeBetweenRoutes(
			deepCopy(graph),
			routes,
			coinInAmount,
			isGivenAmountOut,
			options,
			referrer
		);

		const completeRoute = RouterGraph.completeRouteFromRoutes(
			routesAfterTrades,
			coinInType,
			coinInAmount,
			coinOutType
		);

		const transformedRoute = isGivenAmountOut
			? RouterGraph.transformCompleteRouteIfGivenAmountOut(completeRoute)
			: completeRoute;

		const completeTradeRoute =
			RouterGraph.routerCompleteTradeRouteFromCompleteTradeRoute(
				transformedRoute,
				graph.pools,
				referrer,
				externalFee
			);

		return completeTradeRoute;
	}

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Graph Creation
	// =========================================================================

	// private static updateCoinNodesFromPool = (
	// 	coinNodes: RouterGraphCoinNodes,
	// 	pool: RouterPoolInterface
	// ): RouterGraphCoinNodes => {
	// 	const coinTypes = pool.coinTypes.map(addLeadingZeroesToType);
	// 	const uid = pool.uid;

	// 	let newCoinNodes: RouterGraphCoinNodes = { ...coinNodes };

	// 	for (const coinA of coinTypes) {
	// 		for (const coinB of coinTypes) {
	// 			if (coinA === coinB) continue;

	// 			newCoinNodes =
	// 				coinA in newCoinNodes
	// 					? {
	// 							...newCoinNodes,
	// 							[coinA]: {
	// 								...newCoinNodes[coinA],
	// 								coinOutThroughPoolEdges:
	// 									coinB in
	// 									newCoinNodes[coinA]
	// 										.coinOutThroughPoolEdges
	// 										? {
	// 												...newCoinNodes[coinA]
	// 													.coinOutThroughPoolEdges,
	// 												[coinB]:
	// 													Helpers.uniqueArray([
	// 														...newCoinNodes[
	// 															coinA
	// 														]
	// 															.coinOutThroughPoolEdges[
	// 															coinB
	// 														],
	// 														uid,
	// 													]),
	// 										  }
	// 										: {
	// 												...newCoinNodes[coinA]
	// 													.coinOutThroughPoolEdges,
	// 												[coinB]: [uid],
	// 										  },
	// 							},
	// 					  }
	// 					: {
	// 							...newCoinNodes,
	// 							[coinA]: {
	// 								coin: coinA,
	// 								coinOutThroughPoolEdges: {
	// 									[coinB]: [uid],
	// 								},
	// 							},
	// 					  };
	// 		}
	// 	}

	// 	return newCoinNodes;
	// };

	private static updateCoinNodesFromPool = (
		coinNodes: RouterGraphCoinToPoolIds,
		pool: RouterPoolInterface
	): RouterGraphCoinToPoolIds => {
		const coinTypes = pool.coinTypes.map(addLeadingZeroesToType);
		const uid = pool.uid;

		let newCoinNodes: RouterGraphCoinToPoolIds = { ...coinNodes };

		for (const coin of coinTypes) {
			if (coin in newCoinNodes) {
				newCoinNodes[coin] = [...newCoinNodes[coin], uid];
				continue;
			}
			newCoinNodes[coin] = [uid];
		}

		return newCoinNodes;
	};

	// =========================================================================
	//  Route Finding
	// =========================================================================

	private static findRoutes = (
		syncGraph: RouterCompleteGraph,
		coinIn: CoinType,
		coinOut: CoinType,
		maxRouteLength: number,
		isGivenAmountOut: boolean,
		maxRoutesToCheck: number
	): TradeRoute[] => {
		const syncCoinInPoolIds = syncGraph.coinNodes[coinIn];
		const startingRoutes = this.createStartingRoutes(
			syncGraph.pools,
			syncCoinInPoolIds,
			coinIn,
			false
		);

		const routes = this.findCompleteRoutes(
			syncGraph,
			startingRoutes,
			coinOut,
			maxRouteLength,
			isGivenAmountOut,
			maxRoutesToCheck
		);

		// const asyncCoinInEdges =
		// 	syncGraph.coinNodes[coinIn].coinOutThroughPoolEdges;
		// const noHopRoutes = this.createStartingRoutes(
		// 	asyncGraph.pools,
		// 	asyncCoinInEdges,
		// 	coinIn,
		// 	coinOut,
		// 	true
		// );

		// return [...routes, ...noHopRoutes];
		return [...routes];
	};

	private static createStartingRoutes = (
		pools: RouterPoolsById,
		coinInPoolIds: UniqueId[],
		coinIn: CoinType,
		onlyNoHopPools: boolean
	): TradeRoute[] => {
		let routes: TradeRoute[] = [];
		for (const poolUid of coinInPoolIds) {
			if (!(poolUid in pools)) continue;

			const pool = pools[poolUid];

			if (onlyNoHopPools && !pool.noHopsAllowed) continue;

			const coinOut = this.otherCoin({ pool, coinType: coinIn });

			routes.push({
				estimatedGasCost: pool.expectedGasCostPerHop,
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
						poolUid: pool.uid,
						estimatedGasCost: pool.expectedGasCostPerHop,
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
					},
				],
			});
		}

		return routes;

		// let routes: TradeRoute[] = [];
		// for (const [coinOut, throughPools] of Object.entries(coinInEdges)) {
		// 	for (const poolUid of throughPools) {
		// 		if (!(poolUid in pools)) continue;

		// 		const pool = pools[poolUid];

		// 		if (onlyNoHopPools && !pool.noHopsAllowed) continue;

		// 		routes.push({
		// 			estimatedGasCost: pool.expectedGasCostPerHop,
		// 			coinIn: {
		// 				type: coinIn,
		// 				amount: BigInt(0),
		// 				tradeFee: BigInt(0),
		// 			},
		// 			coinOut: {
		// 				type: coinOut,
		// 				amount: BigInt(0),
		// 				tradeFee: BigInt(0),
		// 			},
		// 			spotPrice: 0,
		// 			paths: [
		// 				{
		// 					poolUid: pool.uid,
		// 					estimatedGasCost: pool.expectedGasCostPerHop,
		// 					coinIn: {
		// 						type: coinIn,
		// 						amount: BigInt(0),
		// 						tradeFee: BigInt(0),
		// 					},
		// 					coinOut: {
		// 						type: coinOut,
		// 						amount: BigInt(0),
		// 						tradeFee: BigInt(0),
		// 					},
		// 					spotPrice: 0,
		// 				},
		// 			],
		// 		});
		// 	}
		// }

		// return routes;
	};

	// private static findCompleteRoutes = (
	// 	graph: RouterCompleteGraph,
	// 	routes: TradeRoute[],
	// 	finalCoinOut: CoinType,
	// 	maxRouteLength: number,
	// 	isGivenAmountOut: boolean,
	// 	maxRoutesToCheck: number
	// ): TradeRoute[] => {
	// 	let currentRoutes = [...routes];
	// 	let completeRoutes: TradeRoute[] = [];

	// 	outerLoop: while (currentRoutes.length > 0) {
	// 		let newCurrentRoutes: TradeRoute[] = [];

	// 		for (const route of currentRoutes) {
	// 			const lastPath = route.paths[route.paths.length - 1];

	// 			if (lastPath.coinOut.type === finalCoinOut) {
	// 				completeRoutes = [...completeRoutes, route];

	// 				// break if too many routes to look at
	// 				if (completeRoutes.length >= maxRoutesToCheck)
	// 					break outerLoop;

	// 				continue;
	// 			}

	// 			if (route.paths.length >= maxRouteLength) continue;

	// 			for (const [coinOut, throughPools] of Object.entries(
	// 				graph.coinNodes[lastPath.coinOut.type]
	// 					.coinOutThroughPoolEdges
	// 			)) {
	// 				for (const poolUid of throughPools) {
	// 					if (
	// 						route.paths.some(
	// 							// NOTE: would it ever make sense to go back into a pool ?
	// 							// (could relax this restriction)
	// 							(path) => path.poolUid === poolUid
	// 						)
	// 						// lastPath.poolUid === poolUid
	// 					)
	// 						continue;

	// 					if (!(poolUid in graph.pools)) continue;

	// 					const pool = graph.pools[poolUid];
	// 					const newRoute: TradeRoute = {
	// 						...route,
	// 						paths: [
	// 							...route.paths,
	// 							{
	// 								poolUid: pool.uid,
	// 								estimatedGasCost:
	// 									pool.expectedGasCostPerHop,
	// 								coinIn: lastPath.coinOut,
	// 								coinOut: {
	// 									type: coinOut,
	// 									amount: BigInt(0),
	// 									tradeFee: BigInt(0),
	// 								},
	// 								spotPrice: 0,
	// 							},
	// 						],
	// 					};

	// 					if (coinOut === finalCoinOut) {
	// 						completeRoutes = [...completeRoutes, newRoute];

	// 						// break if too many routes to look at
	// 						if (completeRoutes.length >= maxRoutesToCheck)
	// 							break outerLoop;

	// 						continue;
	// 					}

	// 					newCurrentRoutes = [...newCurrentRoutes, newRoute];
	// 				}
	// 			}
	// 		}
	// 		currentRoutes = [...newCurrentRoutes];
	// 	}

	// 	if (completeRoutes.length === 0)
	// 		throw new Error("no routes found for this coin pair");

	// 	const finalRoutes = isGivenAmountOut
	// 		? completeRoutes.map((route) => {
	// 				const newRoute = deepCopy(route);
	// 				return {
	// 					...newRoute,
	// 					paths: newRoute.paths.reverse(),
	// 				};
	// 		  })
	// 		: completeRoutes;

	// 	// console.log("completeRoutes", completeRoutes);
	// 	console.log("completeRoutes", completeRoutes.length);

	// 	return finalRoutes;
	// };

	private static findCompleteRoutes = (
		graph: RouterCompleteGraph,
		routes: TradeRoute[],
		finalCoinOut: CoinType,
		maxRouteLength: number,
		isGivenAmountOut: boolean,
		maxRoutesToCheck: number
	): TradeRoute[] => {
		let currentRoutes = [...routes];
		let completeRoutes: TradeRoute[] = [];

		outerLoop: while (currentRoutes.length > 0) {
			let newCurrentRoutes: TradeRoute[] = [];

			for (const route of currentRoutes) {
				const lastPath = route.paths[route.paths.length - 1];

				if (lastPath.coinOut.type === finalCoinOut) {
					completeRoutes = [...completeRoutes, route];

					// break if too many routes to look at
					if (completeRoutes.length >= maxRoutesToCheck)
						break outerLoop;

					continue;
				}

				if (route.paths.length >= maxRouteLength) continue;

				for (const poolUid of graph.coinNodes[lastPath.coinOut.type]) {
					if (
						route.paths.some(
							// NOTE: would it ever make sense to go back into a pool ?
							// (could relax this restriction)
							(path) => path.poolUid === poolUid
						)
						// lastPath.poolUid === poolUid
					)
						continue;

					if (!(poolUid in graph.pools)) continue;

					const pool = graph.pools[poolUid];
					const coinOut = this.otherCoin({
						pool,
						coinType: lastPath.coinOut.type,
					});
					const newRoute: TradeRoute = {
						...route,
						paths: [
							...route.paths,
							{
								poolUid: pool.uid,
								estimatedGasCost: pool.expectedGasCostPerHop,
								coinIn: lastPath.coinOut,
								coinOut: {
									type: coinOut,
									amount: BigInt(0),
									tradeFee: BigInt(0),
								},
								spotPrice: 0,
							},
						],
					};

					if (coinOut === finalCoinOut) {
						completeRoutes = [...completeRoutes, newRoute];

						// break if too many routes to look at
						if (completeRoutes.length >= maxRoutesToCheck)
							break outerLoop;

						continue;
					}

					newCurrentRoutes = [...newCurrentRoutes, newRoute];
				}
			}
			currentRoutes = [...newCurrentRoutes];
		}

		if (completeRoutes.length === 0)
			throw new Error("no routes found for this coin pair");

		const finalRoutes = isGivenAmountOut
			? completeRoutes.map((route) => {
					const newRoute = deepCopy(route);
					return {
						...newRoute,
						paths: newRoute.paths.reverse(),
					};
			  })
			: completeRoutes;

		return finalRoutes;
	};

	private static splitTradeBetweenRoutes = (
		graph: RouterCompleteGraph,
		routes: TradeRoute[],
		coinInAmount: Balance,
		isGivenAmountOut: boolean,
		// constructor
		options: RouterSynchronousOptions,

		referrer?: SuiAddress
	): TradeRoute[] => {
		const coinInPartitionAmount =
			coinInAmount / BigInt(Math.floor(options.tradePartitionCount));
		const coinInRemainderAmount =
			coinInAmount % BigInt(Math.floor(options.tradePartitionCount));

		let currentPools = graph.pools;
		let currentRoutes = routes;

		const emptyArray = Array(options.tradePartitionCount).fill(undefined);

		const linearCutStepSize =
			(routes.length - options.minRoutesToCheck) /
			options.tradePartitionCount;

		for (const [i] of emptyArray.entries()) {
			const { updatedPools, updatedRoutes } =
				this.findNextRouteAndUpdatePoolsAndRoutes(
					deepCopy(currentPools),
					deepCopy(currentRoutes),
					i === 0
						? coinInRemainderAmount + coinInPartitionAmount
						: coinInPartitionAmount,
					linearCutStepSize,
					isGivenAmountOut,
					options,
					referrer
				);

			currentPools = deepCopy(updatedPools);
			currentRoutes = deepCopy(updatedRoutes);
		}

		return currentRoutes;
	};

	private static findNextRouteAndUpdatePoolsAndRoutes = (
		pools: RouterPoolsById,
		routes: TradeRoute[],
		coinInAmount: Balance,
		linearCutStepSize: number,
		isGivenAmountOut: boolean,
		options: RouterSynchronousOptions,
		referrer?: SuiAddress
	): {
		updatedPools: RouterPoolsById;
		updatedRoutes: TradeRoute[];
	} => {
		const currentGasCost = RouterGraph.gasCostForRoutes(routes);

		const routesAndPools = routes.map((route) =>
			this.getUpdatedPoolsAndRouteAfterTrade(
				deepCopy(pools),
				deepCopy(route),
				coinInAmount,
				currentGasCost,
				isGivenAmountOut,
				options,
				referrer
			)
		);
		const updatedRoutesAndPools = routesAndPools.filter(
			(data) => data !== undefined
		) as {
			updatedPools: RouterPoolsById;
			updatedRoute: TradeRoute;
			coinOutAmount: Balance;
			startingRoute: TradeRoute;
			isOverMaxGasCost: boolean;
		}[];

		let cutRoutesAndPools:
			| {
					updatedRoute: TradeRoute;
					updatedPools: RouterPoolsById;
					coinOutAmount: Balance;
			  }
			| undefined = undefined;

		// TODO: add me back
		// const routesAndPoolsUnderGasCost = updatedRoutesAndPools.filter(
		// 	(data) => !data.isOverMaxGasCost
		// );
		if (updatedRoutesAndPools.length > 0)
			cutRoutesAndPools = this.cutUpdatedRouteAndPools(
				deepCopy(updatedRoutesAndPools),
				isGivenAmountOut,
				// "LINEAR",
				"QUADRATIC",
				options
				// linearCutStepSize
			);

		if (cutRoutesAndPools === undefined) {
			const routesAndPoolsOverGasCost = updatedRoutesAndPools.filter(
				(data) => data.isOverMaxGasCost
			);
			if (routesAndPoolsOverGasCost.length > 0)
				cutRoutesAndPools = this.cutUpdatedRouteAndPools(
					deepCopy(routesAndPoolsOverGasCost),
					isGivenAmountOut,
					// "LINEAR",
					"QUADRATIC",
					options
					// linearCutStepSize
				);
		}

		if (cutRoutesAndPools === undefined)
			throw Error("unable to find synchronous route");

		// TODO: update me
		const oldRouteIndex = routes.findIndex(
			(route) =>
				JSON.stringify(route.paths.map((path) => path.poolUid)) ===
				JSON.stringify(
					cutRoutesAndPools?.updatedRoute.paths.map(
						(path) => path.poolUid
					)
				)
		);
		let updatedRoutes = deepCopy(routes);
		updatedRoutes[oldRouteIndex] = cutRoutesAndPools.updatedRoute;

		return {
			updatedRoutes: deepCopy(updatedRoutes),
			updatedPools: cutRoutesAndPools.updatedPools,
		};
	};

	private static cutUpdatedRouteAndPools = (
		routesAndPools: {
			updatedPools: RouterPoolsById;
			updatedRoute: TradeRoute;
			coinOutAmount: Balance;
			startingRoute: TradeRoute;
		}[],
		isGivenAmountOut: boolean,
		routeDecreaseType: "QUADRATIC" | "LINEAR" = "QUADRATIC",
		options: RouterSynchronousOptions,
		linearCutStepSize?: number
	): {
		updatedRoute: TradeRoute;
		updatedPools: RouterPoolsById;
		coinOutAmount: Balance;
	} => {
		if (routeDecreaseType === "LINEAR" && linearCutStepSize === undefined)
			throw new Error("linear cut step size has not been provided");

		// TODO: speed this up further by not sorting routesAndPools if already at minRoutesToCheck length

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
				firstUnusedRouteIndex > options.minRoutesToCheck
					? firstUnusedRouteIndex
					: options.minRoutesToCheck;

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
				: newEndIndex < options.minRoutesToCheck
				? options.minRoutesToCheck
				: newEndIndex
		);

		return {
			updatedPools: cutRoutesAndPools[0].updatedPools,
			updatedRoute: cutRoutesAndPools[0].updatedRoute,
			coinOutAmount: cutRoutesAndPools[0].updatedRoute.coinOut.amount,
		};
	};

	private static getUpdatedPoolsAndRouteAfterTrade = (
		pools: RouterPoolsById,
		route: TradeRoute,
		coinInAmount: Balance,
		currentGasCost: Balance,
		isGivenAmountOut: boolean,
		options: RouterSynchronousOptions,
		referrer?: SuiAddress
	):
		| {
				updatedPools: RouterPoolsById;
				updatedRoute: TradeRoute;
				coinOutAmount: Balance;
				startingRoute: TradeRoute;
				isOverMaxGasCost: boolean;
		  }
		| undefined => {
		const originalRoute = deepCopy(route);

		const isOverMaxGasCost =
			originalRoute.coinIn.amount <= BigInt(0) &&
			RouterGraph.gasCostForRoute(originalRoute) + currentGasCost >
				options.maxGasCost;

		let currentPools = deepCopy(pools);
		let currentCoinInAmount = coinInAmount;
		let newRoute: TradeRoute = { ...originalRoute, paths: [] };
		let routeSpotPrice = 1;

		try {
			for (const path of originalRoute.paths) {
				if (!(path.poolUid in currentPools)) continue;

				const pool = currentPools[path.poolUid];

				const spotPrice = pool.getSpotPrice({
					coinInType: path.coinIn.type,
					coinOutType: path.coinOut.type,
				});

				const poolBeforePathTrades = pool.getUpdatedPoolBeforeTrade(
					!isGivenAmountOut
						? {
								coinInType: path.coinIn.type,
								coinInAmount: path.coinIn.amount,
								coinOutType: path.coinOut.type,
								coinOutAmount: path.coinOut.amount,
						  }
						: {
								coinInType: path.coinIn.type,
								coinInAmount: path.coinOut.amount,
								coinOutType: path.coinOut.type,
								coinOutAmount: path.coinIn.amount,
						  }
				);

				const totalCoinInAmount =
					currentCoinInAmount + path.coinIn.amount;

				const totalCoinOutAmount = isGivenAmountOut
					? poolBeforePathTrades.getTradeAmountIn({
							coinInType: path.coinIn.type,
							coinOutType: path.coinOut.type,
							coinOutAmount: totalCoinInAmount,
							referrer,
					  })
					: poolBeforePathTrades.getTradeAmountOut({
							coinInType: path.coinIn.type,
							coinOutType: path.coinOut.type,
							coinInAmount: totalCoinInAmount,
							referrer,
					  });

				const coinOutAmountFromTrade =
					totalCoinOutAmount - path.coinOut.amount;

				const updatedPool = pool.getUpdatedPoolAfterTrade(
					!isGivenAmountOut
						? {
								coinInType: path.coinIn.type,
								coinInAmount: currentCoinInAmount,
								coinOutType: path.coinOut.type,
								coinOutAmount: coinOutAmountFromTrade,
						  }
						: {
								coinInType: path.coinIn.type,
								coinInAmount: coinOutAmountFromTrade,
								coinOutType: path.coinOut.type,
								coinOutAmount: currentCoinInAmount,
						  }
				);

				let newPath: TradePath = {
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
					[path.poolUid]: updatedPool,
				};

				routeSpotPrice *= spotPrice;
			}

			const updatedRoute: TradeRoute = {
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
				isOverMaxGasCost,
			};
		} catch (e) {
			return undefined;
		}
	};

	public static completeRouteFromRoutes = (
		routes: TradeRoute[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): CompleteTradeRoute => {
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
		const estimatedGasCost = RouterGraph.gasCostForRoutes(routes);

		return {
			estimatedGasCost,
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
		completeRoute: CompleteTradeRoute
	): CompleteTradeRoute => {
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
		T extends Required<TradeInfo>
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

	// TODO: fix me
	private static gasCostForRoutes = (routes: TradeRoute[]): Balance =>
		BigInt(0);
	// routes
	// 	.filter((route) => route.coinIn.amount > BigInt(0))
	// 	.reduce(
	// 		(acc, route) => acc + RouterGraph.gasCostForRoute(route),
	// 		BigInt(0)
	// 	);

	// TODO: fix me
	private static gasCostForRoute = (route: TradeRoute): Balance => BigInt(0);
	// route.paths.reduce(
	// 	(acc, route) => acc + route.estimatedGasCost,
	// 	BigInt(0)
	// );

	private static routerCompleteTradeRouteFromCompleteTradeRoute = (
		completeRoute: CompleteTradeRoute,
		pools: RouterPoolsById,
		referrer?: SuiAddress,
		externalFee?: ExternalFee
	): RouterCompleteTradeRoute => {
		const { coinIn, coinOut, spotPrice } = completeRoute;

		const newRoutes: RouterTradeRoute[] = completeRoute.routes.map(
			(route) => {
				const { coinIn, coinOut, spotPrice } = route;

				const newPaths: RouterTradePath[] = route.paths.map((path) => {
					const { coinIn, coinOut, spotPrice, poolUid } = path;

					const pool = pools[poolUid];
					return {
						coinIn,
						coinOut,
						spotPrice,
						protocolName: pool.protocolName,
						pool: pool.pool,
					};
				});

				return {
					coinIn,
					coinOut,
					spotPrice,
					paths: newPaths,
				};
			}
		);

		const newCoinOut: RouterTradeCoin = externalFee
			? {
					...coinOut,
					amount: BigInt(
						Math.floor(
							(1 - externalFee.feePercentage) *
								Number(coinOut.amount)
						)
					),
			  }
			: coinOut;

		return {
			coinIn,
			coinOut: newCoinOut,
			spotPrice,
			routes: newRoutes,
			externalFee,
			referrer,
		};
	};

	// =========================================================================
	//  Supported Coins
	// =========================================================================

	private static otherCoin = (inputs: {
		pool: RouterPoolInterface;
		coinType: CoinType;
	}) => {
		const { pool, coinType } = inputs;

		// @ts-ignore
		const otherCoin = pool.coinTypes.find((coin) => coin !== coinType);
		if (!otherCoin) throw new Error("no other coin found");

		return otherCoin;
	};
}
