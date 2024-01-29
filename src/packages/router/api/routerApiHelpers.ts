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
	RouterSerializablePool,
	RouterSynchronousOptions,
} from "../../../types";
import { RouterGraph } from "../utils/synchronous/routerGraph";
import { RouterAsyncApiHelpers } from "./routerAsyncApiHelpers";
import { RouterSynchronousApiHelpers } from "./routerSynchronousApiHelpers";
import { RouterAsyncGraph } from "../utils/async/routerAsyncGraph";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import handleDoRoute from "../../../workerCaller";

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
		pools: RouterSerializablePool[];
	}) => {
		return RouterGraph.createGraph(inputs);
	};

	// =========================================================================
	//  Routing
	// =========================================================================

	public fetchCompleteTradeRouteGivenAmountIn = async (inputs: {
		protocols: RouterProtocolName[];
		network: SuiNetwork;
		graph: RouterSerializableCompleteGraph;
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
		excludeProtocols?: RouterProtocolName[];
	}): Promise<RouterCompleteTradeRoute> => {
		if (inputs.protocols.length === 0)
			throw new Error("no protocols set in constructor");

		const { network, graph, coinInAmount, excludeProtocols } = inputs;

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

		// const routerGraph = new RouterGraph(
		// 	network,
		// 	graph,
		// 	this.options.regular.synchronous,
		// 	excludeProtocols
		// );

		const graphInputs = {
			network,
			graph,
			excludeProtocols: excludeProtocols ?? [],
			options: this.options.regular.synchronous,
		};

		if (exactMatchPools.length <= 0 && partialMatchPools.length <= 0)
			return (
				await handleDoRoute({
					graphInputs,
					inputs: { ...inputs, coinInAmounts: [inputs.coinInAmount] },
				})
			)[0];
		// return routerGraph.getCompleteRouteGivenAmountIn(inputs);

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
							routerGraphInputs: graphInputs,
							coinInAmounts,
							lastPool,
						})
					)
				),
			]);

		// NOTE: is this actually needed ?
		// routerGraph.updateOptions(this.options.regular.synchronous);
		const synchronousCompleteRoutes = await handleDoRoute({
			graphInputs: {
				...graphInputs,
				options: this.options.regular.synchronous,
			},
			inputs: { ...inputs, coinInAmounts },
		});
		// routerGraph.getCompleteRoutesGivenAmountIns({
		// 	...inputs,
		// 	coinInAmounts,
		// });

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
			externalFee: inputs.externalFee,
		};
	};

	public fetchCompleteTradeRouteGivenAmountOut = async (inputs: {
		protocols: RouterProtocolName[];
		network: SuiNetwork;
		graph: RouterSerializableCompleteGraph;
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
		excludeProtocols?: RouterProtocolName[];
	}): Promise<RouterCompleteTradeRoute> => {
		if (inputs.protocols.length === 0)
			throw new Error("no protocols set in constructor");

		const { network, graph, excludeProtocols } = inputs;

		const routerGraph = new RouterGraph(
			network,
			graph,
			this.options.regular.synchronous,
			excludeProtocols
		);
		return routerGraph.getCompleteRouteGivenAmountOut(inputs);
	};

	private fetchCompleteTradeRoutesForLastRouteAsyncPool = async (inputs: {
		routerGraphInputs: {
			network: SuiNetwork;
			graph: RouterSerializableCompleteGraph;
			options: RouterSynchronousOptions;
			excludeProtocols: RouterProtocolName[];
		};
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmounts: Balance[];
		lastPool: RouterAsyncSerializablePool;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
	}): Promise<RouterCompleteTradeRoute[]> => {
		const { routerGraphInputs } = inputs;

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

		// routerGraph.updateOptions(this.options.preAsync);
		// const synchronousCompleteRoutes =
		// 	routerGraph.getCompleteRoutesGivenAmountIns({
		// 		...inputs,
		// 		coinOutType: lastPoolCoinInType,
		// 	});

		const synchronousCompleteRoutes = await handleDoRoute({
			graphInputs: {
				...routerGraphInputs,
				options: this.options.preAsync,
			},
			inputs: { ...inputs, coinOutType: lastPoolCoinInType },
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

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public async fetchTransactionForCompleteTradeRoute(inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
		coinInId?: TransactionArgument;
		isSponsoredTx?: boolean;
		withTransfer?: boolean;
	}): Promise<TransactionArgument | undefined> {
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
