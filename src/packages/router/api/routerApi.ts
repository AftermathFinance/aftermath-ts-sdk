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
import { RouterAsyncApiHelpers } from "./routerAsyncApiHelpers";
import { RpcApiHelpers } from "../../../general/api/rpcApiHelpers";
import { Helpers } from "../../../general/utils";

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
		public readonly asyncProtocols: RouterAsyncProtocolName[] = []
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
		const asyncResults = await this.AsyncHelpers.fetchTradeResults({
			protocols: this.asyncProtocols,
			walletAddress: RpcApiHelpers.constants.devInspectSigner,
			coinInType: coinIn,
			coinOutType: coinOut,
			coinInAmount,
			tradePartitionCount: 5,
		});

		const routerGraph = new RouterGraph(network, graph);
		const synchronousResults = asyncResults.amountsIn.map((amountIn) =>
			routerGraph.getCompleteRouteGivenAmountIn(
				coinIn,
				amountIn,
				coinOut,
				referrer,
				externalFee
			)
		);

		const totalAmountsOut = synchronousResults.map((syncResult, index) => {
			const asyncIndex = synchronousResults.length - index - 1;

			asyncResults.results.sort((a, b) =>
				Number((b.amountsOut[asyncIndex] = a.amountsOut[asyncIndex]))
			);
			const bestAsyncResult = asyncResults.results[0];

			return {
				amountOut:
					bestAsyncResult.amountsOut[asyncIndex] +
					syncResult.coinOut.amount,
				asyncProtocol: bestAsyncResult.protocol,
			};
		});

		const maxAmountOutIndex = Helpers.indexOfMax(
			totalAmountsOut.map((data) => data.amountOut)
		);

		console.log("maxIndex", maxAmountOutIndex);
		console.log("amountOutTotal", totalAmountsOut[maxAmountOutIndex]);

		const chosenSync = synchronousResults[maxAmountOutIndex];
		const chosenAsync = asyncResults.results.find(
			(result) =>
				result.protocol ===
				totalAmountsOut[maxAmountOutIndex].asyncProtocol
		);

		if (!chosenAsync) throw new Error("");

		console.log("chosenSync", chosenSync);
		console.log("chosenAsync", chosenAsync);
		console.log(
			"chosenAsync amount out",
			chosenAsync.amountsOut[
				synchronousResults.length - maxAmountOutIndex - 1
			]
		);

		return chosenSync;
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
