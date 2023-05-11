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
	RouterProtocolName,
	isRouterAsyncProtocolName,
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
		public readonly protocols: RouterProtocolName[] = ["Aftermath"]
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

	public fetchSerializableGraph = async () => {
		const pools = await this.Helpers.fetchAllPools({
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

	public fetchCompleteTradeRouteGivenAmountIn = async (inputs: {
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
		if (this.protocols.length === 0)
			throw new Error("no protocols set in constructor");

		const { network, graph, coinInAmount } = inputs;

		const coinInAmounts =
			RouterSynchronousApiHelpers.amountsInForRouterTrade({
				coinInAmount,
			});

		const tradeResults = await this.AsyncHelpers.fetchTradeResults({
			...inputs,
			protocols: this.protocols.filter(isRouterAsyncProtocolName),
			coinInAmounts,
		});

		const routerGraph = new RouterGraph(network, graph);

		if (tradeResults.results.length <= 0)
			return routerGraph.getCompleteRouteGivenAmountIn(inputs);

		const synchronousCompleteRoutes =
			routerGraph.getCompleteRoutesGivenAmountIns({
				...inputs,
				coinInAmounts,
			});

		return RouterAsyncGraph.createFinalCompleteRoute({
			tradeResults,
			synchronousCompleteRoutes,
			coinInAmounts,
		});
	};

	// public fetchCompleteTradeRouteGivenAmountOut = async (
	// 	network: SuiNetwork | Url,
	// 	graph: RouterSerializableCompleteGraph,
	// 	coinIn: CoinType,
	// 	coinOut: CoinType,
	// 	coinOutAmount: Balance,
	// 	referrer?: SuiAddress,
	// 	externalFee?: RouterExternalFee
	// ): Promise<RouterCompleteTradeRoute> => {
	// 	return new RouterGraph(network, graph).getCompleteRouteGivenAmountOut(
	// 		coinIn,
	// 		coinOut,
	// 		coinOutAmount,
	// 		referrer,
	// 		externalFee
	// 	);
	// };

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
