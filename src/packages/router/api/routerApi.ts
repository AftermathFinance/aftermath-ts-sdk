import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { RouterGraph } from "../utils/routerGraph";
import {
	Balance,
	CoinType,
	RouterExternalFee,
	RouterCompleteTradeRoute,
	SerializedTransaction,
	Slippage,
	SuiNetwork,
	Url,
	RouterProtocolName,
	RouterSerializableCompleteGraph,
} from "../../../types";
import { SuiAddress } from "@mysten/sui.js";
import { NojoAmmApi } from "../../external/nojo/nojoAmmApi";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { PoolsApi } from "../../pools/api/poolsApi";
import { CetusApi } from "../../external/cetus/cetusApi";

export class RouterApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		private readonly Provider: AftermathApi,
		public readonly protocols: RouterProtocolName[] = ["Aftermath"]
	) {
		this.Provider = Provider;
		this.Helpers = new RouterApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// External Packages
	/////////////////////////////////////////////////////////////////////

	public Aftermath = () => new PoolsApi(this.Provider);
	public Nojo = () => new NojoAmmApi(this.Provider);
	public DeepBook = () => new DeepBookApi(this.Provider);
	public Cetus = () => new CetusApi(this.Provider);

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
		return new RouterGraph(network, graph).getCompleteRouteGivenAmountIn(
			coinIn,
			coinInAmount,
			coinOut,
			referrer,
			externalFee
		);
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
