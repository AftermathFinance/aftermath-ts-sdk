import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinType,
	ExternalFee,
	RouterCompleteTradeRoute,
	Slippage,
	UserEventsInputs,
	SuiAddress,
	ServiceCoinData,
	SerializedTransaction,
	RouterServicePaths,
	RouterTradeEvent,
	AnyObjectType,
	RouterAddresses,
	Percentage,
	RouterTradePath,
	MoveErrorCode,
	ModuleName,
	PackageId,
	RouterProtocolName,
} from "../../../types";
import {
	TransactionObjectArgument,
	Transaction,
} from "@mysten/sui/transactions";
import { IndexerSwapVolumeResponse } from "../../../general/types/castingTypes";
import { Casting, Coin, Helpers } from "../../..";
import {
	RouterServiceProtocol,
	RouterTradeEventOnChain,
} from "./routerApiCastingTypes";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { RouterApiCasting } from "./routerApiCasting";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { TransactionObjectArgument as TransactionObjectArgumentV0 } from "@mysten/sui.js/transactions";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";

/**
 * RouterApi class provides methods for interacting with the Aftermath Router API.
 * @class
 */
export class RouterApi implements MoveErrorsInterface {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		moduleNames: {
			router: "router",
			events: "events",
			protocolFee: "protocol_fee",
			version: "version",
			admin: "admin",
		},
		eventNames: {
			routerTrade: "SwapCompletedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: RouterAddresses;
	public readonly eventTypes: {
		routerTrade: AnyObjectType;
	};
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an instance of RouterApi.
	 * @constructor
	 * @param {AftermathApi} Provider - The Aftermath API instance.
	 */
	constructor(private readonly Provider: AftermathApi) {
		if (!this.Provider.addresses.router)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = this.Provider.addresses.router;
		this.eventTypes = {
			routerTrade: this.routerTradeEventType(),
		};
		this.moveErrors = {
			[this.addresses.packages.utils]: {
				[RouterApi.constants.moduleNames.protocolFee]: {
					/// A non-one-time-witness type has been provided to the `ProtocolFeeConfig`'s `create` function.
					1: "Protocol Fee Config Already Created",
					/// Occurs when `change_fee` is called more than once during the same Epoch.
					2: "Bad Epoch",
					/// A user provided a new protocol fees that do not sum to one.
					3: "Not Normalized",
				},
				[RouterApi.constants.moduleNames.router]: {
					0: "Not Authorized",
					1: "Invalid Coin In",
					2: "Invalid Coin Out",
					4: "Invalid Previous Swap",
					5: "Invalid Slippage",
					/// A route is constructed that bypasses one of `begin_router_tx_and_pay_fees` or
					///  `end_router_tx_and_pay_fees`.
					6: "No Fees Paid",
				},
				[RouterApi.constants.moduleNames.version]: {
					/// A user tries to interact with an old contract.
					0: "Invalid Version",
				},
				[RouterApi.constants.moduleNames.admin]: {
					/// Admin has not authorized the calling shared object to acess a permissioned function.
					0: "Not Authorized",
					/// Admin has already authorized the calling shared object to acess a permissioned function.
					1: "Already Authorized",
				},
			},
		};
	}

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
	//  Coin Paths
	// =========================================================================

	public supportedCoins = (): Promise<CoinType[]> => {
		return this.Provider.indexerCaller.fetchIndexer(
			"router/supported-coins",
			undefined,
			undefined,
			undefined,
			undefined,
			true
		);
	};

	public searchSupportedCoins = async (inputs: {
		filter: string;
	}): Promise<CoinType[]> => {
		const { filter } = inputs;

		const coinTypes = await this.supportedCoins();
		if (coinTypes.includes(filter)) return [filter];

		const coinMetadatas = (
			await Promise.all(
				coinTypes.map((coin) =>
					this.Provider.Coin().fetchCoinMetadata({ coin })
				)
			)
		).reduce(
			(acc, metadata, index) => ({
				...acc,
				[coinTypes[index]]: metadata,
			}),
			{}
		);
		return Helpers.uniqueArray([
			...Coin.filterCoinsByMetadata({
				filter: filter,
				coinMetadatas,
			}),
			...Coin.filterCoinsByType({ filter, coinTypes }),
		]);
	};

	// =========================================================================
	//  Routing
	// =========================================================================

	/**
	 * Fetches the complete trade route given an input amount of a specified coin type.
	 * @param inputs An object containing the necessary inputs for the trade route calculation.
	 * @returns A Promise that resolves to a RouterCompleteTradeRoute object.
	 */
	public fetchCompleteTradeRouteGivenAmountIn = async (
		inputs: {
			coinInType: CoinType;
			coinInAmount: Balance;
			coinOutType: CoinType;
			referrer?: SuiAddress;
			externalFee?: ExternalFee;
		} & (
			| {
					protocolBlacklist?: RouterProtocolName[];
			  }
			| {
					protocolWhitelist?: RouterProtocolName[];
			  }
		)
	): Promise<RouterCompleteTradeRoute> => {
		const { coinInType, coinOutType, coinInAmount, referrer, externalFee } =
			inputs;

		const { paths, output_amount } =
			await this.Provider.indexerCaller.fetchIndexer<
				{
					output_amount: number;
					paths: RouterServicePaths;
				},
				{
					from_coin_type: CoinType;
					to_coin_type: CoinType;
					input_amount: number;
					referred: boolean;
					protocol_blacklist?: RouterServiceProtocol[];
					protocol_whitelist?: RouterServiceProtocol[];
				}
			>(
				"router/forward-trade-route",
				{
					from_coin_type: Helpers.addLeadingZeroesToType(coinInType),
					to_coin_type: Helpers.addLeadingZeroesToType(coinOutType),
					// NOTE: is this conversion safe ?
					input_amount: Number(coinInAmount),
					referred: referrer !== undefined,
					...("protocolBlacklist" in inputs
						? {
								protocol_blacklist:
									inputs.protocolBlacklist?.map(
										RouterApiCasting.routerProtocolNameToRouterServiceProtocol
									),
						  }
						: "protocolWhitelist" in inputs
						? {
								protocol_whitelist:
									inputs.protocolWhitelist?.map(
										RouterApiCasting.routerProtocolNameToRouterServiceProtocol
									),
						  }
						: {}),
				},
				undefined,
				undefined,
				undefined,
				true
			);

		const completeRoute =
			await this.fetchAddNetTradeFeePercentageToCompleteTradeRoute({
				completeRoute:
					Casting.router.routerCompleteTradeRouteFromServicePaths(
						paths
					),
			});
		return {
			...completeRoute,
			// NOTE: should these be here ?
			referrer,
			externalFee,
		};
	};

	/**
	 * Fetches the complete trade route given the output amount of the trade.
	 * @param inputs - An object containing the necessary inputs for fetching the trade route.
	 * @returns A Promise that resolves to a RouterCompleteTradeRoute object.
	 */
	public fetchCompleteTradeRouteGivenAmountOut = async (
		inputs: {
			coinInType: CoinType;
			coinOutAmount: Balance;
			coinOutType: CoinType;
			slippage: Slippage;
			referrer?: SuiAddress;
			externalFee?: ExternalFee;
		} & (
			| {
					protocolBlacklist?: RouterProtocolName[];
			  }
			| {
					protocolWhitelist?: RouterProtocolName[];
			  }
		)
	): Promise<RouterCompleteTradeRoute> => {
		const {
			coinInType,
			coinOutType,
			coinOutAmount,
			referrer,
			externalFee,
			slippage,
		} = inputs;

		const { paths } = await this.Provider.indexerCaller.fetchIndexer<
			{
				input_amount: number;
				paths: RouterServicePaths;
			},
			{
				from_coin_type: CoinType;
				to_coin_type: CoinType;
				output_amount: number;
				referred: boolean;
				protocol_blacklist?: RouterServiceProtocol[];
				protocol_whitelist?: RouterServiceProtocol[];
			}
		>(
			"router/backward-trade-route",
			{
				from_coin_type: Helpers.addLeadingZeroesToType(coinInType),
				to_coin_type: Helpers.addLeadingZeroesToType(coinOutType),
				// NOTE: is this conversion safe ?
				output_amount: Math.ceil(
					(1 + slippage + (externalFee?.feePercentage ?? 0)) *
						Number(coinOutAmount)
				),
				referred: referrer !== undefined,
				...("protocolBlacklist" in inputs
					? {
							protocol_blacklist: inputs.protocolBlacklist?.map(
								RouterApiCasting.routerProtocolNameToRouterServiceProtocol
							),
					  }
					: "protocolWhitelist" in inputs
					? {
							protocol_whitelist: inputs.protocolWhitelist?.map(
								RouterApiCasting.routerProtocolNameToRouterServiceProtocol
							),
					  }
					: {}),
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const completeRoute =
			await this.fetchAddNetTradeFeePercentageToCompleteTradeRoute({
				completeRoute:
					Casting.router.routerCompleteTradeRouteFromServicePaths(
						paths
					),
			});
		return {
			...completeRoute,
			// NOTE: should these be here ?
			referrer,
			externalFee,
			slippage,
		};
	};

	public fetchCompleteTradeRouteAndTxGivenAmountIn = async (
		inputs: {
			coinInType: CoinType;
			coinInAmount: Balance;
			coinOutType: CoinType;
			slippage: Slippage;
			tx?: Transaction;
			coinIn?: TransactionObjectArgument;
			walletAddress?: SuiAddress;
			referrer?: SuiAddress;
			externalFee?: ExternalFee;
			isSponsoredTx?: boolean;
			transferCoinOut?: boolean;
		} & (
			| {
					protocolBlacklist?: RouterProtocolName[];
			  }
			| {
					protocolWhitelist?: RouterProtocolName[];
			  }
		)
	): Promise<{
		tx: Transaction;
		completeRoute: RouterCompleteTradeRoute;
		coinOut: TransactionObjectArgument;
		coinOutAmount: Balance;
	}> => {
		const {
			coinInType,
			coinOutType,
			coinInAmount,
			walletAddress,
			referrer,
			externalFee,
			coinIn,
			isSponsoredTx,
			slippage,
			transferCoinOut,
		} = inputs;

		const initTx = inputs.tx ?? new Transaction();
		if (walletAddress) initTx.setSender(walletAddress);

		const coinTxArg =
			coinIn ??
			(walletAddress
				? await this.Provider.Coin().fetchCoinWithAmountTx({
						tx: initTx,
						coinAmount: coinInAmount,
						coinType: coinInType,
						walletAddress,
						isSponsoredTx,
				  })
				: (() => {
						throw new Error("no walletAddress provided");
				  })());

		const txBytes = await initTx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});
		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		const { output_coin, tx_kind, output_amount, paths } =
			await this.Provider.indexerCaller.fetchIndexer<
				{
					output_coin: ServiceCoinData;
					tx_kind: SerializedTransaction;
					output_amount: number;
					paths: RouterServicePaths;
				},
				{
					from_coin_type: CoinType;
					to_coin_type: CoinType;
					input_amount: number;
					input_coin: ServiceCoinData;
					slippage: number;
					tx_kind: SerializedTransaction;
					referrer?: SuiAddress;
					router_fee_recipient?: SuiAddress;
					router_fee?: number; // u64 format (same as on-chain)
					protocol_blacklist?: RouterServiceProtocol[];
					protocol_whitelist?: RouterServiceProtocol[];
				}
			>(
				"router/forward-trade-route-tx",
				{
					slippage,
					referrer,
					from_coin_type: Helpers.addLeadingZeroesToType(coinInType),
					to_coin_type: Helpers.addLeadingZeroesToType(coinOutType),
					// NOTE: is this conversion safe ?
					input_amount: Number(coinInAmount),
					input_coin:
						Helpers.transactions.serviceCoinDataFromCoinTxArg({
							coinTxArg,
						}),
					tx_kind: b64TxBytes,
					router_fee_recipient: externalFee?.recipient,
					// NOTE: is this conversion safe ?
					router_fee: externalFee
						? Number(
								Casting.numberToFixedBigInt(
									externalFee.feePercentage
								)
						  )
						: undefined,
					...("protocolBlacklist" in inputs
						? {
								protocol_blacklist:
									inputs.protocolBlacklist?.map(
										RouterApiCasting.routerProtocolNameToRouterServiceProtocol
									),
						  }
						: "protocolWhitelist" in inputs
						? {
								protocol_whitelist:
									inputs.protocolWhitelist?.map(
										RouterApiCasting.routerProtocolNameToRouterServiceProtocol
									),
						  }
						: {}),
				},
				undefined,
				undefined,
				undefined,
				true
			);

		const tx = Transaction.fromKind(tx_kind);
		TransactionsApiHelpers.transferTxMetadata({
			initTx,
			newTx: tx,
		});

		const coinOut = Helpers.transactions.coinTxArgFromServiceCoinData({
			serviceCoinData: output_coin,
		});
		if (transferCoinOut && walletAddress) {
			tx.transferObjects([coinOut], walletAddress);
		}

		const completeRoute =
			await this.fetchAddNetTradeFeePercentageToCompleteTradeRoute({
				completeRoute:
					Casting.router.routerCompleteTradeRouteFromServicePaths(
						paths
					),
			});
		return {
			tx,
			coinOut,
			coinOutAmount: BigInt(Math.round(output_amount)),
			completeRoute: {
				...completeRoute,
				referrer,
				externalFee,
			},
		};
	};

	public fetchCompleteTradeRouteAndTxGivenAmountOut = async (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		slippage: Slippage;
		tx?: Transaction;
		coinIn?: TransactionObjectArgument;
		walletAddress?: SuiAddress;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
		isSponsoredTx?: boolean;
		transferCoinOut?: boolean;
	}): Promise<{
		tx: Transaction;
		completeRoute: RouterCompleteTradeRoute;
		coinOut: TransactionObjectArgument;
		coinInAmount: Balance;
	}> => {
		const {
			coinInType,
			walletAddress,
			coinIn,
			isSponsoredTx,
			transferCoinOut,
		} = inputs;

		const completeRoute = await this.fetchCompleteTradeRouteGivenAmountOut(
			inputs
		);

		const initTx = inputs.tx ?? new Transaction();
		if (walletAddress) initTx.setSender(walletAddress);

		const coinTxArg =
			coinIn ??
			(walletAddress
				? await this.Provider.Coin().fetchCoinWithAmountTx({
						tx: initTx,
						coinAmount: completeRoute.coinIn.amount,
						coinType: coinInType,
						walletAddress,
						isSponsoredTx,
				  })
				: (() => {
						throw new Error("no walletAddress provided");
				  })());

		const { tx, coinOut } = await this.fetchTxForCompleteTradeRoute({
			...inputs,
			completeRoute,
			coinInId: coinTxArg,
		});

		if (transferCoinOut && walletAddress) {
			tx.transferObjects([coinOut], walletAddress);
		}

		return {
			tx,
			coinOut,
			coinInAmount: completeRoute.coinIn.amount,
			completeRoute,
		};
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	public fetchTxForCompleteTradeRoute = async (inputs: {
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
		tx?: Transaction;
		coinInId?: TransactionObjectArgument;
		walletAddress?: SuiAddress;
		isSponsoredTx?: boolean;
		transferCoinOut?: boolean;
	}): Promise<{
		tx: Transaction;
		coinOut: TransactionObjectArgument;
	}> => {
		const {
			completeRoute,
			walletAddress,
			coinInId,
			isSponsoredTx,
			slippage,
			transferCoinOut,
		} = inputs;

		const externalFee = inputs.completeRoute.externalFee;
		const referrer = inputs.completeRoute.referrer;

		const initTx = inputs.tx ?? new Transaction();
		if (walletAddress) initTx.setSender(walletAddress);

		const coinTxArg =
			coinInId ??
			(walletAddress
				? await this.Provider.Coin().fetchCoinWithAmountTx({
						tx: initTx,
						coinAmount: completeRoute.coinIn.amount,
						coinType: completeRoute.coinIn.type,
						walletAddress,
						isSponsoredTx,
				  })
				: (() => {
						throw new Error("no walletAddress provided");
				  })());

		const txBytes = await initTx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});
		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		const { output_coin, tx_kind } =
			await this.Provider.indexerCaller.fetchIndexer<
				{
					output_coin: ServiceCoinData;
					tx_kind: SerializedTransaction;
				},
				{
					paths: RouterServicePaths;
					input_coin: ServiceCoinData;
					slippage: number;
					tx_kind: SerializedTransaction;
					referrer?: SuiAddress;
					router_fee_recipient?: SuiAddress;
					router_fee?: number; // u64 format (same as on-chain)
				}
			>(
				"router/tx-from-trade-route",
				{
					slippage,
					referrer,
					paths: Casting.router.routerServicePathsFromCompleteTradeRoute(
						completeRoute
					),
					input_coin:
						Helpers.transactions.serviceCoinDataFromCoinTxArg({
							coinTxArg,
						}),
					tx_kind: b64TxBytes,
					router_fee_recipient: externalFee?.recipient,
					// NOTE: is this conversion safe ?
					router_fee: externalFee
						? Number(
								Casting.numberToFixedBigInt(
									externalFee.feePercentage
								)
						  )
						: undefined,
				},
				undefined,
				undefined,
				undefined,
				true
			);

		const tx = Transaction.fromKind(tx_kind);

		TransactionsApiHelpers.transferTxMetadata({
			initTx,
			newTx: tx,
		});

		const coinOut = Helpers.transactions.coinTxArgFromServiceCoinData({
			serviceCoinData: output_coin,
		});
		if (transferCoinOut && walletAddress) {
			tx.transferObjects([coinOut], walletAddress);
		}

		return {
			tx,
			coinOut,
		};
	};

	public fetchTxForCompleteTradeRouteV0 = async (inputs: {
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
		tx?: TransactionBlock;
		coinInId?: TransactionObjectArgumentV0;
		walletAddress?: SuiAddress;
		isSponsoredTx?: boolean;
		transferCoinOut?: boolean;
	}): Promise<{
		tx: TransactionBlock;
		coinOut: TransactionObjectArgumentV0;
	}> => {
		const {
			completeRoute,
			walletAddress,
			coinInId,
			isSponsoredTx,
			slippage,
			transferCoinOut,
		} = inputs;

		const externalFee = inputs.completeRoute.externalFee;
		const referrer = inputs.completeRoute.referrer;

		const initTx = inputs.tx ?? new TransactionBlock();
		if (walletAddress) initTx.setSender(walletAddress);

		const coinTxArg =
			coinInId ??
			(walletAddress
				? await this.Provider.Coin().fetchCoinWithAmountTx({
						tx: initTx,
						coinAmount: completeRoute.coinIn.amount,
						coinType: completeRoute.coinIn.type,
						walletAddress,
						isSponsoredTx,
				  })
				: (() => {
						throw new Error("no walletAddress provided");
				  })());

		const txBytes = await initTx.build({
			client: this.Provider.providerV0,
			onlyTransactionKind: true,
		});
		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		const { output_coin, tx_kind } =
			await this.Provider.indexerCaller.fetchIndexer<
				{
					output_coin: ServiceCoinData;
					tx_kind: SerializedTransaction;
				},
				{
					paths: RouterServicePaths;
					input_coin: ServiceCoinData;
					slippage: number;
					tx_kind: SerializedTransaction;
					referrer?: SuiAddress;
					router_fee_recipient?: SuiAddress;
					router_fee?: number; // u64 format (same as on-chain)
				}
			>(
				"router/tx-from-trade-route",
				{
					slippage,
					referrer,
					paths: Casting.router.routerServicePathsFromCompleteTradeRoute(
						completeRoute
					),
					input_coin:
						Helpers.transactions.serviceCoinDataFromCoinTxArgV0({
							coinTxArg,
						}),
					tx_kind: b64TxBytes,
					router_fee_recipient: externalFee?.recipient,
					// NOTE: is this conversion safe ?
					router_fee: externalFee
						? Number(
								Casting.numberToFixedBigInt(
									externalFee.feePercentage
								)
						  )
						: undefined,
				},
				undefined,
				undefined,
				undefined,
				true
			);

		const tx = TransactionBlock.fromKind(tx_kind);

		TransactionsApiHelpers.transferTxMetadataV0({
			initTx,
			newTx: tx,
		});

		const coinOut = Helpers.transactions.coinTxArgFromServiceCoinDataV0({
			serviceCoinData: output_coin,
		});
		if (transferCoinOut && walletAddress) {
			tx.transferObjects([coinOut], walletAddress);
		}

		return {
			tx,
			coinOut,
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches trade events for a given user.
	 * @param inputs - The inputs for fetching trade events.
	 * @returns A Promise that resolves with the fetched trade events.
	 */
	public async fetchTradeEvents(inputs: UserEventsInputs) {
		return this.Provider.Events().fetchCastEventsWithCursor<
			RouterTradeEventOnChain,
			RouterTradeEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.routerTrade,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: RouterApiCasting.routerTradeEventFromOnChain,
		});
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private async fetchAddNetTradeFeePercentageToCompleteTradeRoute(inputs: {
		completeRoute: Omit<RouterCompleteTradeRoute, "netTradeFeePercentage">;
	}): Promise<RouterCompleteTradeRoute> {
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

		const netTradeFeePercentage =
			coinOutAmountUsd <= 0 ? 0 : netFeeUsd / coinOutAmountUsd;
		return {
			...completeRoute,
			netTradeFeePercentage,
		};
	}

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private routerTradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.utils,
			RouterApi.constants.moduleNames.events,
			RouterApi.constants.eventNames.routerTrade
		);
}
