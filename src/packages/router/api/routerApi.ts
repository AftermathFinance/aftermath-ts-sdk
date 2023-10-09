import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterGraph } from "../utils/synchronous/routerGraph";
import {
	Balance,
	CoinType,
	RouterExternalFee,
	RouterCompleteTradeRoute,
	Slippage,
	SuiNetwork,
	Url,
	RouterSerializableCompleteGraph,
	RouterProtocolName,
	UserEventsInputs,
	RouterAsyncSerializablePool,
	isRouterSynchronousProtocolName,
	isRouterAsyncProtocolName,
	SynchronousProtocolsToPoolObjectIds,
	RouterSynchronousOptions,
	AllRouterOptions,
	PartialRouterOptions,
	SuiAddress,
	SerializedTransaction,
	TxBytes,
	DynamicGasCoinData,
	ApiRouterDynamicGasBody,
} from "../../../types";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
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
import { FlowXApi } from "../../external/flowX/flowXApi";
import { Coin } from "../..";
import { MoveCallSuiTransaction, SuiTransaction } from "@mysten/sui.js/client";

export class RouterApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly defaultRouterOptions: AllRouterOptions = {
		regular: {
			synchronous: {
				maxRouteLength: 3,
				tradePartitionCount: 2,
				minRoutesToCheck: 5,
				maxGasCost: BigInt(500_000_000), // 0.5 SUI
			},
			async: {
				tradePartitionCount: 1,
				maxAsyncPoolsPerProtocol: 2,
			},
		},
		preAsync: {
			maxRouteLength: 2,
			tradePartitionCount: 1,
			minRoutesToCheck: 5,
			maxGasCost: BigInt(500_000_000), // 0.5 SUI
			// maxGasCost: BigInt(333_333_333), // 0.333 SUI
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly Helpers;

	private readonly options;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		private readonly Provider: AftermathApi,
		public readonly protocols: RouterProtocolName[] = [
			"Aftermath",
			"afSUI",
		],
		regularOptions?: PartialRouterOptions,
		preAsyncOptions?: Partial<RouterSynchronousOptions>
	) {
		const optionsToSet: AllRouterOptions = {
			regular: {
				synchronous: {
					...RouterApi.defaultRouterOptions.regular.synchronous,
					...regularOptions?.synchronous,
				},
				async: {
					...RouterApi.defaultRouterOptions.regular.async,
					...regularOptions?.async,
				},
			},
			preAsync: {
				...RouterApi.defaultRouterOptions.preAsync,
				...preAsyncOptions,
			},
		};

		this.options = optionsToSet;

		this.Provider = Provider;
		this.Helpers = new RouterApiHelpers(Provider, optionsToSet);
	}

	// =========================================================================
	//  External Packages
	// =========================================================================

	public Aftermath = () => new PoolsApi(this.Provider);
	public DeepBook = () => new DeepBookApi(this.Provider);
	public Cetus = () => new CetusApi(this.Provider);
	public Turbos = () => new TurbosApi(this.Provider);
	public FlowX = () => new FlowXApi(this.Provider);
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

	public supportedCoinPathsFromGraph = (inputs: {
		graph: RouterSerializableCompleteGraph;
	}) => {
		const maxRouteLength = this.options.regular.synchronous.maxRouteLength;
		return RouterGraph.supportedCoinPathsFromGraph({
			...inputs,
			maxRouteLength,
		});
	};

	public supportedCoinsFromGraph = (inputs: {
		graph: RouterSerializableCompleteGraph;
	}) => {
		return RouterGraph.supportedCoinsFromGraph(inputs);
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
	}): Promise<RouterCompleteTradeRoute> => {
		return this.Helpers.fetchCompleteTradeRouteGivenAmountIn({
			...inputs,
			protocols: this.protocols,
		});
	};

	public fetchCompleteTradeRouteGivenAmountOut = async (inputs: {
		network: SuiNetwork | Url;
		graph: RouterSerializableCompleteGraph;
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
	}): Promise<RouterCompleteTradeRoute> => {
		return this.Helpers.fetchCompleteTradeRouteGivenAmountOut({
			...inputs,
			protocols: this.protocols,
		});
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async fetchTransactionForCompleteTradeRoute(inputs: {
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> {
		const tx = new TransactionBlock();
		await this.Helpers.fetchTransactionForCompleteTradeRoute({
			...inputs,
			tx,
			withTransfer: true,
		});
		return tx;
	}

	public async fetchAddTransactionForCompleteTradeRoute(inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
		coinInId?: TransactionArgument;
		isSponsoredTx?: boolean;
	}): Promise<TransactionArgument | undefined> {
		return this.Helpers.fetchTransactionForCompleteTradeRoute(inputs);
	}

	// =========================================================================
	//  Dynamic Gas Helper
	// =========================================================================

	public async fetchAddDynamicGasRouteToTxKind(
		inputs: ApiRouterDynamicGasBody & {
			coinOutAmount: Balance;
			network: SuiNetwork | Url;
			graph: RouterSerializableCompleteGraph;
		}
	): Promise<TxBytes> {
		const { gasCoinData } = inputs;

		const tx = TransactionBlock.fromKind(inputs.txKindBytes);

		const completeRoute = await this.fetchCompleteTradeRouteGivenAmountOut({
			...inputs,
			coinInType: inputs.gasCoinType,
			coinOutType: Coin.constants.suiCoinType,
		});

		let coinInId: TransactionArgument;
		if ("Coin" in gasCoinData) {
			// coin object has NOT been used previously in tx
			coinInId = tx.object(gasCoinData.Coin);
		} else {
			// coin object has been used previously in tx
			const txArgs = tx.blockData.transactions.reduce(
				(acc, aTx) => [
					...acc,
					...("objects" in aTx
						? [aTx.objects]
						: "arguments" in aTx
						? [aTx.arguments]
						: []),
				],
				[] as TransactionArgument[]
			);

			coinInId = txArgs.find((arg) => {
				if (!arg) return false;

				// this is here because TS having troubles inferring type for some reason
				// (still being weird)
				const txArg = arg as TransactionArgument;
				return (
					("Input" in gasCoinData &&
						txArg.kind === "Input" &&
						txArg.index === gasCoinData.Input) ||
					("Result" in gasCoinData &&
						txArg.kind === "Result" &&
						txArg.index === gasCoinData.Result) ||
					("NestedResult" in gasCoinData &&
						txArg.kind === "NestedResult" &&
						txArg.index === gasCoinData.NestedResult[0] &&
						txArg.resultIndex === gasCoinData.NestedResult[1])
				);
			});
		}

		const coinOutId = await this.fetchAddTransactionForCompleteTradeRoute({
			tx,
			completeRoute,
			coinInId,
			// TODO: set this elsewhere
			slippage: 0.01,
			walletAddress: inputs.senderAddress,
		});

		tx.transferObjects(
			[coinOutId],
			tx.pure(inputs.sponsorAddress, "address")
		);

		const txBytes = await tx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});
		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		return b64TxBytes;
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async fetchTradeEvents(inputs: UserEventsInputs) {
		return this.Helpers.SynchronousHelpers.fetchTradeEvents(inputs);
	}
}
