import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinType,
	RouterAsyncSerializablePool,
	RouterCompleteTradeRoute,
	ExternalFee,
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
	Percentage,
	RouterTradePath,
} from "../../../types";
import { RouterGraph } from "../utils/synchronous/routerGraph";
import { RouterAsyncApiHelpers } from "./routerAsyncApiHelpers";
import { RouterSynchronousApiHelpers } from "./routerSynchronousApiHelpers";
import { RouterAsyncGraph } from "../utils/async/routerAsyncGraph";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { Helpers } from "../../../general/utils";
import { Coin } from "../..";

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
		private readonly Provider: AftermathApi,
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
		externalFee?: ExternalFee;
		excludeProtocols?: RouterProtocolName[];
	}): Promise<Omit<RouterCompleteTradeRoute, "netTradeFeePercentage">> => {
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

		const routerGraph = new RouterGraph(
			network,
			graph,
			this.options.regular.synchronous,
			excludeProtocols
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
		externalFee?: ExternalFee;
		excludeProtocols?: RouterProtocolName[];
	}): Promise<Omit<RouterCompleteTradeRoute, "netTradeFeePercentage">> => {
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
		routerGraph: RouterGraph;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmounts: Balance[];
		lastPool: RouterAsyncSerializablePool;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
	}): Promise<Omit<RouterCompleteTradeRoute, "netTradeFeePercentage">[]> => {
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

	public async fetchCalcNetTradeFeePercentageFromCompleteTradeRoute(inputs: {
		completeRoute: Omit<RouterCompleteTradeRoute, "netTradeFeePercentage">;
	}): Promise<Percentage> {
		const { completeRoute } = inputs;

		const coinsWithFees = completeRoute.routes
			.reduce(
				(acc, route) => [...acc, ...route.paths],
				[] as RouterTradePath[]
			)
			.reduce(
				(acc, path) => [
					...acc,
					{
						coinType: path.coinIn.type,
						fee: path.coinIn.tradeFee,
					},
					{
						coinType: path.coinOut.type,
						fee: path.coinOut.tradeFee,
					},
				],
				[] as { coinType: CoinType; fee: Balance }[]
			)
			.filter((data) => data.fee > BigInt(0));

		const coins = Helpers.uniqueArray([
			...coinsWithFees.map((data) => data.coinType),
			completeRoute.coinOut.type,
		]);
		const [coinsToPrice, coinsToDecimals] = await Promise.all([
			this.Provider.Prices().fetchCoinsToPrice({
				coins,
			}),
			this.Provider.Coin().fetchCoinsToDecimals({
				coins,
			}),
		]);

		const netFeeUsd = coinsWithFees.reduce(
			(acc, data) =>
				acc +
				(coinsToPrice[data.coinType] < 0
					? 0
					: coinsToPrice[data.coinType]) *
					Coin.balanceWithDecimals(
						data.fee,
						coinsToDecimals[data.coinType]
					),
			0
		);
		const coinOutAmountUsd =
			(coinsToPrice[completeRoute.coinOut.type] < 0
				? 0
				: coinsToPrice[completeRoute.coinOut.type]) *
			Coin.balanceWithDecimals(
				completeRoute.coinOut.amount,
				coinsToDecimals[completeRoute.coinOut.type]
			);

		return coinOutAmountUsd <= 0 ? 0 : netFeeUsd / coinOutAmountUsd;
	}

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
		startCompleteRoute: Omit<
			RouterCompleteTradeRoute,
			"netTradeFeePercentage"
		>;
		endCompleteRoute: Omit<
			RouterCompleteTradeRoute,
			"netTradeFeePercentage"
		>;
	}): Omit<RouterCompleteTradeRoute, "netTradeFeePercentage"> => {
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
