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
	RouterSerializableCompleteGraph,
	RouterProtocolName,
} from "../../../types";
import { SuiAddress } from "@mysten/sui.js";
import { NojoAmmApi } from "../../external/nojo/nojoAmmApi";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { PoolsApi } from "../../pools/api/poolsApi";
import { CetusApi } from "../../external/cetus/cetusApi";
import { RouterAsyncGraph } from "../utils/async/routerAsyncGraph";
import { RouterAsyncApiHelpers } from "./routerAsyncApiHelpers";
import { TurbosApi } from "../../external/turbos/turbosApi";
import { RouterApiHelpers } from "./routerApiHelpers";

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

	// public Aftermath = () => new PoolsApi(this.Provider);
	// public Nojo = () => new NojoAmmApi(this.Provider);
	// public DeepBook = () => new DeepBookApi(this.Provider);
	// public Cetus = () => new CetusApi(this.Provider);
	// public Turbos = () => new TurbosApi(this.Provider);

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Graph
	/////////////////////////////////////////////////////////////////////

	public fetchSerializableGraph = async () => {
		return this.Helpers.fetchSerializableGraph({
			protocols: this.protocols,
		});
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
		return this.Helpers.fetchCompleteTradeRouteGivenAmountIn({
			...inputs,
			protocols: this.protocols,
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
		const tx = await this.Helpers.fetchTransactionForCompleteTradeRoute(
			inputs
		);
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			tx
		);
	}
}
