import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
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
	Url,
	isRouterAsyncProtocolName,
} from "../../../types";
import { RouterGraph } from "../utils/synchronous/routerGraph";
import { RouterAsyncApiHelpers } from "./routerAsyncApiHelpers";
import { RouterSynchronousApiHelpers } from "./routerSynchronousApiHelpers";
import { RouterAsyncGraph } from "../utils/async/routerAsyncGraph";

export class RouterApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		defaults: {
			tradePartitionCount: 3,
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly SynchronousHelpers;
	public readonly AsyncHelpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;

		this.SynchronousHelpers = new RouterSynchronousApiHelpers(Provider);
		this.AsyncHelpers = new RouterAsyncApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Graph
	/////////////////////////////////////////////////////////////////////

	public fetchSerializableGraph = async (inputs: {
		protocols: RouterProtocolName[];
	}) => {
		const pools = await this.SynchronousHelpers.fetchAllPools(inputs);
		return RouterGraph.createGraph({ pools });
	};

	/////////////////////////////////////////////////////////////////////
	//// Routing
	/////////////////////////////////////////////////////////////////////

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

		const coinInAmounts = RouterApiHelpers.amountsInForRouterTrade({
			coinInAmount,
		});
		const asyncProtocols = inputs.protocols.filter(
			isRouterAsyncProtocolName
		);

		const { exactMatchPools, partialMatchPools } =
			await this.AsyncHelpers.fetchPossiblePools({
				...inputs,
				protocols: asyncProtocols,
			});

		const routerGraph = new RouterGraph(network, graph);

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

		routerGraph.updateOptions(RouterGraph.defaultOptions);
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

		return result;
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

		routerGraph.updateOptions({
			// maxRouteLength: 2,
			maxGasCost: BigInt(333_333_333), // 0.333 SUI
		});
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

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async fetchTransactionForCompleteTradeRoute(inputs: {
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
	}): Promise<TransactionBlock> {
		return this.SynchronousHelpers.fetchBuildTransactionForCompleteTradeRoute(
			inputs
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static amountsInForRouterTrade = (inputs: {
		coinInAmount: Balance;
		partitions?: number;
	}): Balance[] => {
		const { coinInAmount } = inputs;

		const partitions =
			inputs.partitions ||
			RouterApiHelpers.constants.defaults.tradePartitionCount;

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

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private static addFinalRouterCompleteTradeRouteToRoute = (inputs: {
		startCompleteRoute: RouterCompleteTradeRoute;
		endCompleteRoute: RouterCompleteTradeRoute;
	}): RouterCompleteTradeRoute => {
		const { startCompleteRoute, endCompleteRoute } = inputs;

		const totalEndRouteAmountIn = endCompleteRoute.coinIn.amount;

		return {
			...startCompleteRoute,
			routes: startCompleteRoute.routes.map((route) => {
				const finalRoute = endCompleteRoute.routes[0];
				const finalPath = finalRoute.paths[0];

				// TODO: handle remainder amount
				const finalCoinOutAmountForRoute =
					route.coinOut.amount / totalEndRouteAmountIn;

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
