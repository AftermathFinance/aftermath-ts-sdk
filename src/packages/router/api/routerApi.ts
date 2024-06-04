import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterGraph } from "../utils/synchronous/routerGraph";
import {
	Balance,
	CoinType,
	ExternalFee,
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
	TxBytes,
	ApiRouterDynamicGasBody,
	RouterSynchronousSerializablePool,
} from "../../../types";
import {
	TransactionArgument,
	Transaction,
	TransactionDataBuilder,
} from "@mysten/sui/transactions";
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
import { IndexerSwapVolumeResponse } from "../../../general/types/castingTypes";
import { Helpers } from "../../..";

/**
 * RouterApi class provides methods for interacting with the Aftermath Router API.
 * @class
 */
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
				maxRoutesToCheck: 20,
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
			maxRoutesToCheck: 20,
			maxGasCost: BigInt(500_000_000), // 0.5 SUI
			// maxGasCost: BigInt(333_333_333), // 0.333 SUI
		},
	};

	private static readonly constants = {
		dynamicGas: {
			expectedRouterGasCostUpperBound: BigInt(7_000_000), // 0.007 SUI (mainnet)
			slippage: 0.1, // 10%
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

	/**
	 * Creates an instance of RouterApi.
	 * @constructor
	 * @param {AftermathApi} Provider - The Aftermath API instance.
	 * @param {RouterProtocolName[]} protocols - The list of protocols to use.
	 * @param {PartialRouterOptions} regularOptions - The regular options to use.
	 * @param {Partial<RouterSynchronousOptions>} preAsyncOptions - The pre-async options to use.
	 */
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
	//  Inspections
	// =========================================================================

	/**
	 * Fetches the total volume of swaps within a specified duration.
	 * @param inputs - The inputs for fetching the total volume.
	 * @returns A Promise that resolves to an array of total volumes.
	 */
	public fetchVolume = async (inputs: { durationMs: number }) => {
		const { durationMs } = inputs;
		return this.Provider.indexerCaller.fetchIndexer<IndexerSwapVolumeResponse>(
			`router/swap-volume/${durationMs}`
		);
	};

	// =========================================================================
	//  Graph
	// =========================================================================

	public fetchCreateSerializableGraph = this.Provider.withCache({
		key: "fetchCreateSerializableGraph",
		expirationSeconds: 10,
		callback: async (): Promise<RouterSerializableCompleteGraph> => {
			const [asyncPools, synchronousPools] = await Promise.all([
				this.fetchAsyncPools(),
				this.fetchSynchronousPools(),
			]);
			return this.Helpers.fetchCreateSerializableGraph({
				pools: [...asyncPools, ...synchronousPools],
			});
		},
	});

	// =========================================================================
	//  Coin Paths
	// =========================================================================

	public supportedCoinsFromGraph = (inputs: {
		graph: RouterSerializableCompleteGraph;
	}) => {
		return RouterGraph.supportedCoinsFromGraph(inputs);
	};

	// =========================================================================
	//  Routing
	// =========================================================================

	/**
	 * Fetches the complete trade route given an input amount of a specified coin type.
	 * @param inputs An object containing the necessary inputs for the trade route calculation.
	 * @returns A Promise that resolves to a RouterCompleteTradeRoute object.
	 */
	public fetchCompleteTradeRouteGivenAmountIn = async (inputs: {
		network: SuiNetwork;
		graph: RouterSerializableCompleteGraph;
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
		excludeProtocols?: RouterProtocolName[];
	}): Promise<RouterCompleteTradeRoute> => {
		return this.Helpers.fetchCompleteTradeRouteGivenAmountIn({
			...inputs,
			coinInType: Helpers.addLeadingZeroesToType(inputs.coinInType),
			coinOutType: Helpers.addLeadingZeroesToType(inputs.coinOutType),
			protocols: this.protocols,
		});
	};

	/**
	 * Fetches the complete trade route given the output amount of the trade.
	 * @param inputs - An object containing the necessary inputs for fetching the trade route.
	 * @returns A Promise that resolves to a RouterCompleteTradeRoute object.
	 */
	public fetchCompleteTradeRouteGivenAmountOut = async (inputs: {
		network: SuiNetwork;
		graph: RouterSerializableCompleteGraph;
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
		excludeProtocols?: RouterProtocolName[];
	}): Promise<RouterCompleteTradeRoute> => {
		return this.Helpers.fetchCompleteTradeRouteGivenAmountOut({
			...inputs,
			coinInType: Helpers.addLeadingZeroesToType(inputs.coinInType),
			coinOutType: Helpers.addLeadingZeroesToType(inputs.coinOutType),
			protocols: this.protocols,
		});
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Fetches a transaction for a complete trade route.
	 * @param inputs An object containing the wallet address, complete trade route, slippage, and optional sponsored transaction flag.
	 * @returns A promise that resolves to a Transaction object.
	 */
	public async fetchTransactionForCompleteTradeRoute(inputs: {
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
		isSponsoredTx?: boolean;
	}): Promise<Transaction> {
		const tx = new Transaction();
		await this.Helpers.fetchTransactionForCompleteTradeRoute({
			...inputs,
			tx,
			withTransfer: true,
		});
		return tx;
	}

	/**
	 * Fetches a transaction argument for a complete trade route.
	 * @param inputs An object containing the necessary inputs for the transaction.
	 * @returns A promise that resolves to a transaction argument, or undefined if the transaction failed.
	 */
	public async fetchAddTransactionForCompleteTradeRoute(inputs: {
		tx: Transaction;
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
		inputs: Omit<ApiRouterDynamicGasBody, "coinOutAmount"> & {
			coinOutAmount: Balance;
			network: SuiNetwork;
			graph: RouterSerializableCompleteGraph;
		}
	): Promise<TxBytes> {
		const { gasCoinData } = inputs;

		const tx = Transaction.fromKind(inputs.txKindBytes);

		const completeRoute = await this.fetchCompleteTradeRouteGivenAmountOut({
			...inputs,
			coinInType: inputs.gasCoinType,
			coinOutType: Coin.constants.suiCoinType,
			coinOutAmount:
				inputs.coinOutAmount +
				RouterApi.constants.dynamicGas.expectedRouterGasCostUpperBound,
		});

		let fullCoinInId: TransactionArgument;
		if ("Coin" in gasCoinData) {
			// coin object has NOT been used previously in tx
			fullCoinInId = tx.object(gasCoinData.Coin);
		} else {
			const data = TransactionDataBuilder.restore(tx.getData());

			data.mapArguments((arg) => {
				if (
					"Input" in gasCoinData &&
					arg.$kind === "Input" &&
					gasCoinData.Input === arg.Input
				) {
					fullCoinInId = tx.object(data.inputs[arg.Input]);
				} else if (
					"Result" in gasCoinData &&
					arg.$kind === "Result" &&
					gasCoinData.Result === arg.Result
				) {
					fullCoinInId = arg;
				} else if (
					"NestedResult" in gasCoinData &&
					arg.$kind === "NestedResult" &&
					gasCoinData.NestedResult[0] === arg.NestedResult[0] &&
					gasCoinData.NestedResult[1] === arg.NestedResult[1]
				) {
					fullCoinInId = arg;
				}

				return arg;
			});
		}

		const coinInId = tx.splitCoins(fullCoinInId!, [
			completeRoute.coinIn.amount,
		]);

		const coinOutId = await this.fetchAddTransactionForCompleteTradeRoute({
			tx,
			completeRoute,
			coinInId,
			// TODO: set this elsewhere
			slippage: RouterApi.constants.dynamicGas.slippage,
			walletAddress: inputs.senderAddress,
		});

		tx.transferObjects([coinOutId!], inputs.sponsorAddress);

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

	/**
	 * Fetches trade events for a given user.
	 * @param inputs - The inputs for fetching trade events.
	 * @returns A Promise that resolves with the fetched trade events.
	 */
	public async fetchTradeEvents(inputs: UserEventsInputs) {
		return this.Helpers.SynchronousHelpers.fetchTradeEvents(inputs);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private fetchAsyncPools = async (): Promise<
		RouterAsyncSerializablePool[]
	> => {
		return this.Helpers.AsyncHelpers.fetchAllPools({
			protocols: this.protocols.filter(isRouterAsyncProtocolName),
		});
	};

	private fetchSynchronousPools = async (): Promise<
		RouterSynchronousSerializablePool[]
	> => {
		return this.Helpers.SynchronousHelpers.fetchAllPools({
			protocols: this.protocols.filter(isRouterSynchronousProtocolName),
		});
	};
}
