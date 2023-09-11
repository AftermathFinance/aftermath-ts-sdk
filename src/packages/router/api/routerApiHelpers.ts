import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinType,
	RouterAsyncSerializablePool,
	RouterCompleteTradeRoute,
	RouterExternalFee,
	RouterProtocolName,
	RouterSerializableCompleteGraph,
	Slippage,
	SuiNetwork,
	SynchronousProtocolsToPoolObjectIds,
	Url,
	isRouterAsyncProtocolName,
	isRouterAsyncSerializablePool,
	AllRouterOptions,
	SuiAddress,
} from "../../../types";
import { RouterGraph } from "../utils/synchronous/routerGraph";
import { RouterAsyncApiHelpers } from "./routerAsyncApiHelpers";
import { RouterSynchronousApiHelpers } from "./routerSynchronousApiHelpers";
import { RouterAsyncGraph } from "../utils/async/routerAsyncGraph";
import { TransactionBlock } from "@mysten/sui.js/transactions";

export class RouterApiHelpers {
	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly SynchronousHelpers;
	public readonly AsyncHelpers;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		Provider: AftermathApi,
		private readonly options: AllRouterOptions
	) {
		this.SynchronousHelpers = new RouterSynchronousApiHelpers(Provider);
		this.AsyncHelpers = new RouterAsyncApiHelpers(
			Provider,
			options.regular.async
		);
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Graph
	// =========================================================================

	public fetchCreateSerializableGraph = async (inputs: {
		asyncPools: RouterAsyncSerializablePool[];
		synchronousProtocolsToPoolObjectIds: SynchronousProtocolsToPoolObjectIds;
	}) => {
		const synchronousPools =
			await this.SynchronousHelpers.fetchPoolsFromIds(inputs);

		return RouterGraph.createGraph({
			pools: [...synchronousPools, ...inputs.asyncPools],
		});
	};

	// =========================================================================
	//  Routing
	// =========================================================================

	public fetchCompleteTradeRouteGivenAmountIn = async (inputs: {
		protocols: RouterProtocolName[];
		network: SuiNetwork | Url;
		graph: RouterSerializableCompleteGraph;
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
		// TODO: add options to set all these params ?
		// maxRouteLength?: number,
	}): Promise<RouterCompleteTradeRoute> => {
		if (inputs.protocols.length === 0)
			throw new Error("no protocols set in constructor");

		const { network, graph, coinInAmount } = inputs;

		const coinInAmounts = this.amountsInForRouterTrade({
			coinInAmount,
		});
		const asyncProtocols = inputs.protocols.filter(
			isRouterAsyncProtocolName
		);

		const { exactMatchPools, partialMatchPools } =
			this.AsyncHelpers.filterPossiblePools({
				...inputs,
				pools: Object.values(graph.pools).filter(
					isRouterAsyncSerializablePool
				),
				protocols: asyncProtocols,
			});

		const routerGraph = new RouterGraph(
			network,
			graph,
			this.options.regular.synchronous
		);

		if (exactMatchPools.length <= 0 && partialMatchPools.length <= 0)
			return routerGraph.getCompleteRouteGivenAmountIn(inputs);

		const [exactTradeResults, completeRoutesForLastPoolAsync] =
			await Promise.all([
				this.AsyncHelpers.fetchTradeResults({
					...inputs,
					pools: exactMatchPools,
					coinInAmounts,
				}),
				Promise.all(
					partialMatchPools.map((lastPool) =>
						this.fetchCompleteTradeRoutesForLastRouteAsyncPool({
							...inputs,
							routerGraph,
							coinInAmounts,
							lastPool,
						})
					)
				),
			]);

		// NOTE: is this actually needed ?
		routerGraph.updateOptions(this.options.regular.synchronous);
		const synchronousCompleteRoutes =
			routerGraph.getCompleteRoutesGivenAmountIns({
				...inputs,
				coinInAmounts,
			});

		const allCompleteRoutes = [
			...completeRoutesForLastPoolAsync,
			synchronousCompleteRoutes,
		];

		const completeRoutes = allCompleteRoutes.filter(
			(routes) => routes.length > 0
		);

		const result = RouterAsyncGraph.createFinalCompleteRoute({
			tradeResults: exactTradeResults,
			completeRoutes:
				completeRoutes.length <= 0 ? undefined : completeRoutes,
			coinInAmounts,
		});

		return {
			...result,
			coinIn: {
				...result.coinIn,
				amount: coinInAmount,
			},
			referrer: inputs.referrer,
		};
	};

	private fetchCompleteTradeRoutesForLastRouteAsyncPool = async (inputs: {
		routerGraph: RouterGraph;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmounts: Balance[];
		lastPool: RouterAsyncSerializablePool;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
	}): Promise<RouterCompleteTradeRoute[]> => {
		const { routerGraph } = inputs;

		const asyncApi =
			this.AsyncHelpers.protocolNamesToApi[
				this.AsyncHelpers.protocolNameFromPool({
					pool: inputs.lastPool,
				})
			]();

		const lastPoolCoinInType = asyncApi.otherCoinInPool({
			coinType: inputs.coinOutType,
			pool: inputs.lastPool,
		});

		routerGraph.updateOptions(this.options.preAsync);
		const synchronousCompleteRoutes =
			routerGraph.getCompleteRoutesGivenAmountIns({
				...inputs,
				coinOutType: lastPoolCoinInType,
			});

		const lastPoolCoinInAmounts = synchronousCompleteRoutes.map(
			(route) => route.coinOut.amount
		);
		const tradeResults = await this.AsyncHelpers.fetchTradeResults({
			...inputs,
			coinInType: lastPoolCoinInType,
			pools: [inputs.lastPool],
			coinInAmounts: lastPoolCoinInAmounts,
		});

		const asyncCompleteRoutes =
			RouterAsyncGraph.completeRoutesFromTradeResults({
				tradeResults,
			})[0];

		const finalCompleteRoutes = synchronousCompleteRoutes.map(
			(syncRoute, index) =>
				RouterApiHelpers.addFinalRouterCompleteTradeRouteToRoute({
					startCompleteRoute: syncRoute,
					endCompleteRoute: asyncCompleteRoutes[index],
				})
		);

		return finalCompleteRoutes.every((route) => route.routes.length === 0)
			? []
			: finalCompleteRoutes;
	};

	// public fetchCompleteTradeRouteGivenAmountIn = async (inputs: {
	// 	protocols: RouterProtocolName[];
	// 	network: SuiNetwork | Url;
	// 	graph: RouterSerializableCompleteGraph;
	// 	coinInType: CoinType;
	// 	coinInAmount: Balance;
	// 	coinOutType: CoinType;
	// 	referrer?: SuiAddress;
	// 	externalFee?: RouterExternalFee;
	// 	// TODO: add options to set all these params ?
	// 	// maxRouteLength?: number,
	// }): Promise<RouterCompleteTradeRoute> => {
	// 	if (inputs.protocols.length === 0)
	// 		throw new Error("no protocols set in constructor");

	// 	const { network, graph, coinInAmount } = inputs;

	// 	const coinInAmounts = RouterApiHelpers.amountsInForRouterTrade({
	// 		coinInAmount,
	// 	});

	// 	const tradeResults = await this.AsyncHelpers.fetchTradeResults({
	// 		...inputs,
	// 		protocols: inputs.protocols.filter(isRouterAsyncProtocolName),
	// 		coinInAmounts,
	// 	});

	// 	const routerGraph = new RouterGraph(network, graph);

	// 	if (tradeResults.results.length <= 0)
	// 		return routerGraph.getCompleteRouteGivenAmountIn(inputs);

	// 	const synchronousCompleteRoutes =
	// 		routerGraph.getCompleteRoutesGivenAmountIns({
	// 			...inputs,
	// 			coinInAmounts,
	// 		});

	// 	return RouterAsyncGraph.createFinalCompleteRoute({
	// 		tradeResults,
	// 		synchronousCompleteRoutes,
	// 		coinInAmounts,
	// 	});
	// };

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public async fetchTransactionForCompleteTradeRoute(inputs: {
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
	}): Promise<TransactionBlock> {
		return this.SynchronousHelpers.fetchBuildTransactionForCompleteTradeRoute(
			inputs
		);
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public amountsInForRouterTrade = (inputs: {
		coinInAmount: Balance;
	}): Balance[] => {
		const { coinInAmount } = inputs;

		const partitions = this.options.regular.async.tradePartitionCount;

		const coinInPartitionAmount =
			coinInAmount / BigInt(Math.floor(partitions));
		const coinInRemainderAmount =
			coinInAmount % BigInt(Math.floor(partitions));

		const amountsIn = Array(partitions)
			.fill(0)
			.map((_, index) =>
				index === 0
					? coinInRemainderAmount + coinInPartitionAmount
					: BigInt(1 + index) * coinInPartitionAmount
			);

		return amountsIn;
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static addFinalRouterCompleteTradeRouteToRoute = (inputs: {
		startCompleteRoute: RouterCompleteTradeRoute;
		endCompleteRoute: RouterCompleteTradeRoute;
	}): RouterCompleteTradeRoute => {
		const { startCompleteRoute, endCompleteRoute } = inputs;

		const totalEndRouteAmountIn = endCompleteRoute.coinIn.amount;

		return {
			...startCompleteRoute,
			routes: startCompleteRoute.routes.map((route, index) => {
				const finalRoute = endCompleteRoute.routes[0];
				const finalPath = finalRoute.paths[0];

				const routesLength = startCompleteRoute.routes.length;
				const finalCoinOutAmountForRoute =
					index === routesLength - 1
						? route.coinOut.amount -
						  totalEndRouteAmountIn * BigInt(routesLength - 1)
						: route.coinOut.amount / totalEndRouteAmountIn;

				const spotPrice =
					Number(route.coinIn.amount) /
					Number(finalCoinOutAmountForRoute);

				return {
					spotPrice,
					coinIn: {
						...route.coinIn,
					},
					coinOut: {
						...finalRoute.coinOut,
						amount: finalCoinOutAmountForRoute,
					},
					paths: [...route.paths, finalPath],
				};
			}),
			coinOut: {
				...endCompleteRoute.coinOut,
			},
			spotPrice:
				startCompleteRoute.spotPrice * endCompleteRoute.spotPrice,
		};
	};
}
