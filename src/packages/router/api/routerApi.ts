import { AftermathApi } from "../../../general/providers/aftermathApi";
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
	UserEventsInputs,
	RouterAsyncSerializablePool,
	isRouterSynchronousProtocolName,
	isRouterAsyncProtocolName,
	RouterSynchronousProtocolName,
	SynchronousProtocolsToPoolObjectIds,
} from "../../../types";
import {
	EventId,
	ObjectId,
	SuiAddress,
	TransactionBlock,
} from "@mysten/sui.js";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { PoolsApi } from "../../pools/api/poolsApi";
import { CetusApi } from "../../external/cetus/cetusApi";
import { TurbosApi } from "../../external/turbos/turbosApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { InterestApi } from "../../external/interest/interestApi";
import { KriyaApi } from "../../external/kriya/kriyaApi";
import { BaySwapApi } from "../../external/baySwap/baySwapApi";
import { SuiswapApi } from "../../external/suiswap/suiswapApi";
import { BlueMoveApi } from "../../external/blueMove/blueMoveApi";

export class RouterApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly Helpers;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		private readonly Provider: AftermathApi,
		public readonly protocols: RouterProtocolName[] = ["Aftermath"]
	) {
		this.Provider = Provider;
		this.Helpers = new RouterApiHelpers(Provider);
	}

	// =========================================================================
	//  External Packages
	// =========================================================================

	public Aftermath = () => new PoolsApi(this.Provider);
	public DeepBook = () => new DeepBookApi(this.Provider);
	public Cetus = () => new CetusApi(this.Provider);
	public Turbos = () => new TurbosApi(this.Provider);
	public Interest = () => new InterestApi(this.Provider);
	public Kriya = () => new KriyaApi(this.Provider);
	public BaySwap = () => new BaySwapApi(this.Provider);
	public Suiswap = () => new SuiswapApi(this.Provider);
	public BlueMove = () => new BlueMoveApi(this.Provider);

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Graph
	// =========================================================================

	public fetchCreateSerializableGraph = async (inputs: {
		asyncPools: RouterAsyncSerializablePool[];
		synchronousProtocolsToPoolObjectIds: SynchronousProtocolsToPoolObjectIds;
	}): Promise<RouterSerializableCompleteGraph> => {
		return this.Helpers.fetchCreateSerializableGraph(inputs);
	};

	public fetchAsyncPools = async (): Promise<
		RouterAsyncSerializablePool[]
	> => {
		return this.Helpers.AsyncHelpers.fetchAllPools({
			protocols: this.protocols.filter(isRouterAsyncProtocolName),
		});
	};

	public fetchSynchronousPoolIds =
		async (): Promise<SynchronousProtocolsToPoolObjectIds> => {
			return this.Helpers.SynchronousHelpers.fetchAllPoolIds({
				protocols: this.protocols.filter(
					isRouterSynchronousProtocolName
				),
			});
		};

	// =========================================================================
	//  Coin Paths
	// =========================================================================

	public supportedCoinPathsFromGraph = async (inputs: {
		graph: RouterSerializableCompleteGraph;
	}) => {
		return RouterGraph.supportedCoinPathsFromGraph(inputs);
	};

	// =========================================================================
	//  Routing
	// =========================================================================

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

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async fetchTransactionForCompleteTradeRoute(inputs: {
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
	}): Promise<TransactionBlock> {
		return this.Helpers.fetchTransactionForCompleteTradeRoute(inputs);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async fetchTradeEvents(inputs: UserEventsInputs) {
		return this.Helpers.SynchronousHelpers.fetchTradeEvents(inputs);
	}
}
