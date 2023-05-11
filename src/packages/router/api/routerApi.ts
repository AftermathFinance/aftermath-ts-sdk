import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterSynchronousApiHelpers } from "./routerSynchronousApiHelpers";
import { RouterGraph } from "../utils/synchronous/routerGraph";
import {
	Balance,
	CoinType,
	RouterExternalFee,
	RouterCompleteTradeRoute,
	SerializedTransaction,
	Slippage,
	SuiNetwork,
	Url,
	RouterSynchronousProtocolName,
	RouterSerializableCompleteGraph,
	RouterAsyncProtocolName,
} from "../../../types";
import { SuiAddress } from "@mysten/sui.js";
import { NojoAmmApi } from "../../external/nojo/nojoAmmApi";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { PoolsApi } from "../../pools/api/poolsApi";
import { CetusApi } from "../../external/cetus/cetusApi";
import { RouterAsyncGraph } from "../utils/async/routerAsyncGraph";
import { RouterAsyncApiHelpers } from "./routerAsyncApiHelpers";
import { TurbosApi } from "../../external/turbos/turbosApi";

export class RouterApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;
	public readonly AsyncHelpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		private readonly Provider: AftermathApi,
		public readonly protocols: RouterSynchronousProtocolName[] = [
			"Aftermath",
		],
		public readonly asyncProtocols: RouterAsyncProtocolName[] = [
			"Cetus",
			"Turbos",
		]
	) {
		this.Provider = Provider;
		this.Helpers = new RouterSynchronousApiHelpers(Provider);
		this.AsyncHelpers = new RouterAsyncApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// External Packages
	/////////////////////////////////////////////////////////////////////

	public Aftermath = () => new PoolsApi(this.Provider);
	public Nojo = () => new NojoAmmApi(this.Provider);
	public DeepBook = () => new DeepBookApi(this.Provider);
	public Cetus = () => new CetusApi(this.Provider);
	public Turbos = () => new TurbosApi(this.Provider);

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Graph
	/////////////////////////////////////////////////////////////////////

	public fetchSerializableGraph = async (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		const pools = await this.Helpers.fetchAllPools({
			...inputs,
			protocols: this.protocols,
		});
		return RouterGraph.createGraph({ pools });
	};

	/////////////////////////////////////////////////////////////////////
	//// Coin Paths
	/////////////////////////////////////////////////////////////////////

	public supportedCoinPathsFromGraph = async (inputs: {
		graph: RouterSerializableCompleteGraph;
	}) => {
		return RouterGraph.supportedCoinPathsFromGraph(inputs);
	};

	/////////////////////////////////////////////////////////////////////
	//// Routing
	/////////////////////////////////////////////////////////////////////

	public fetchCompleteTradeRouteGivenAmountIn = async (
		network: SuiNetwork | Url,
		graph: RouterSerializableCompleteGraph,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		referrer?: SuiAddress,
		externalFee?: RouterExternalFee
		// TODO: add options to set all these params ?
		// maxRouteLength?: number,
	): Promise<RouterCompleteTradeRoute> => {
		const coinInAmounts =
			RouterSynchronousApiHelpers.amountsInForRouterTrade({
				coinInAmount,
				partitions: 10,
			});

		const tradeResults = await this.AsyncHelpers.fetchTradeResults({
			protocols: this.asyncProtocols,
			coinInType: coinIn,
			coinOutType: coinOut,
			coinInAmounts,
		});

		console.log("tradeResults", tradeResults);

		const routerGraph = new RouterGraph(network, graph);

		if (tradeResults.results.length <= 0)
			return routerGraph.getCompleteRouteGivenAmountIn(
				coinIn,
				coinInAmount,
				coinOut,
				referrer,
				externalFee
			);

		const synchronousCompleteRoutes =
			routerGraph.getCompleteRoutesGivenAmountIns(
				coinIn,
				coinInAmounts,
				coinOut,
				referrer,
				externalFee
			);

		return RouterAsyncGraph.createFinalCompleteRoute({
			tradeResults,
			synchronousCompleteRoutes,
			coinInAmounts,
		});
	};

	public fetchCompleteTradeRouteGivenAmountOut = async (
		network: SuiNetwork | Url,
		graph: RouterSerializableCompleteGraph,
		coinIn: CoinType,
		coinOut: CoinType,
		coinOutAmount: Balance,
		referrer?: SuiAddress,
		externalFee?: RouterExternalFee
	): Promise<RouterCompleteTradeRoute> => {
		return new RouterGraph(network, graph).getCompleteRouteGivenAmountOut(
			coinIn,
			coinOut,
			coinOutAmount,
			referrer,
			externalFee
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async fetchTransactionForCompleteTradeRoute(inputs: {
		// TODO: make it so that api can be called with different rpc nodes ?
		network: SuiNetwork | Url;
		provider: AftermathApi;
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
	}): Promise<SerializedTransaction> {
		const tx =
			await this.Helpers.fetchBuildTransactionForCompleteTradeRoute(
				inputs
			);
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			tx
		);
	}
}
