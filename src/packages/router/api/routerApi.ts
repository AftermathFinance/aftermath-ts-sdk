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
} from "../../../types";
import {
	TransactionObjectArgument,
	Transaction,
} from "@mysten/sui/transactions";
import { IndexerSwapVolumeResponse } from "../../../general/types/castingTypes";
import { Casting, Coin, Helpers } from "../../..";
import { RouterTradeEventOnChain } from "./routerApiCastingTypes";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { RouterApiCasting } from "./routerApiCasting";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { TransactionObjectArgument as TransactionObjectArgumentV0 } from "@mysten/sui.js/transactions";

/**
 * RouterApi class provides methods for interacting with the Aftermath Router API.
 * @class
 */
export class RouterApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		moduleNames: {
			swapCap: "swap_cap",
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
	public fetchCompleteTradeRouteGivenAmountIn = async (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
	}): Promise<RouterCompleteTradeRoute> => {
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
				}
			>(
				"router/forward-trade-route",
				{
					from_coin_type: Helpers.addLeadingZeroesToType(coinInType),
					to_coin_type: Helpers.addLeadingZeroesToType(coinOutType),
					// NOTE: is this conversion safe ?
					input_amount: Number(coinInAmount),
					referred: referrer !== undefined,
				},
				undefined,
				undefined,
				undefined,
				true
			);

		const completeRoute =
			await this.fetchAddNetTradeFeePercentageToCompleteTradeRoute({
				completeRoute:
					Casting.router.routerCompleteTradeRouteFromServicePaths({
						paths,
						outputAmount: output_amount,
					}),
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
	public fetchCompleteTradeRouteGivenAmountOut = async (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
	}): Promise<RouterCompleteTradeRoute> => {
		const {
			coinInType,
			coinOutType,
			coinOutAmount,
			referrer,
			externalFee,
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
			}
		>(
			"router/backward-trade-route",
			{
				from_coin_type: Helpers.addLeadingZeroesToType(coinInType),
				to_coin_type: Helpers.addLeadingZeroesToType(coinOutType),
				// NOTE: is this conversion safe ?
				output_amount: Number(coinOutAmount),
				referred: referrer !== undefined,
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const completeRoute =
			await this.fetchAddNetTradeFeePercentageToCompleteTradeRoute({
				completeRoute:
					Casting.router.routerCompleteTradeRouteFromServicePaths({
						paths,
						outputAmount: Number(coinOutAmount),
					}),
			});
		return {
			...completeRoute,
			// NOTE: should these be here ?
			referrer,
			externalFee,
		};
	};

	public fetchCompleteTradeRouteAndTxGivenAmountIn = async (inputs: {
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
	}): Promise<{
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
				},
				undefined,
				undefined,
				undefined,
				true
			);

		const tx = Transaction.fromKind(tx_kind);
		RouterApi.transferTxMetadata({
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
					Casting.router.routerCompleteTradeRouteFromServicePaths({
						paths,
						outputAmount: output_amount,
					}),
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
			coinIn: coinTxArg,
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
		coinIn?: TransactionObjectArgument;
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
			coinIn,
			isSponsoredTx,
			slippage,
			transferCoinOut,
		} = inputs;

		const externalFee = inputs.completeRoute.externalFee;
		const referrer = inputs.completeRoute.referrer;

		const initTx = inputs.tx ?? new Transaction();
		if (walletAddress) initTx.setSender(walletAddress);

		const coinTxArg =
			coinIn ??
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

		RouterApi.transferTxMetadata({
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
		coinIn?: TransactionObjectArgumentV0;
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
			coinIn,
			isSponsoredTx,
			slippage,
			transferCoinOut,
		} = inputs;

		const externalFee = inputs.completeRoute.externalFee;
		const referrer = inputs.completeRoute.referrer;

		const initTx = inputs.tx ?? new TransactionBlock();
		if (walletAddress) initTx.setSender(walletAddress);

		const coinTxArg =
			coinIn ??
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

		RouterApi.transferTxMetadataV0({
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
	//  Private Static Helpers
	// =========================================================================

	private static transferTxMetadata = (inputs: {
		initTx: Transaction;
		newTx: Transaction;
	}) => {
		const { initTx, newTx } = inputs;

		const sender = initTx.getData().sender;
		if (sender) newTx.setSender(sender);

		const expiration = initTx.getData().expiration;
		if (expiration) newTx.setExpiration(expiration);

		const gasData = initTx.getData().gasData;

		if (gasData.budget && typeof gasData.budget !== "string")
			newTx.setGasBudget(gasData.budget);

		if (gasData.owner) newTx.setGasOwner(gasData.owner);

		if (gasData.payment) newTx.setGasPayment(gasData.payment);

		if (gasData.price && typeof gasData.price !== "string")
			newTx.setGasPrice(gasData.price);
	};

	private static transferTxMetadataV0 = (inputs: {
		initTx: TransactionBlock;
		newTx: TransactionBlock;
	}) => {
		const { initTx, newTx } = inputs;

		const sender = initTx.blockData.sender;
		if (sender) newTx.setSender(sender);

		const expiration = initTx.blockData.expiration;
		if (expiration && !("None" in expiration && expiration.None === null))
			// @ts-ignore
			newTx.setExpiration(expiration);

		const gasData = initTx.blockData.gasConfig;

		if (gasData.budget && typeof gasData.budget !== "string")
			newTx.setGasBudget(gasData.budget);

		if (gasData.owner) newTx.setGasOwner(gasData.owner);

		if (gasData.payment)
			newTx.setGasPayment(
				gasData.payment.map((payment) => ({
					...payment,
					version:
						typeof payment.version === "bigint"
							? Number(payment.version)
							: payment.version,
				}))
			);

		if (gasData.price && typeof gasData.price !== "string")
			newTx.setGasPrice(gasData.price);
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private routerTradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.utils,
			RouterApi.constants.moduleNames.swapCap,
			RouterApi.constants.eventNames.routerTrade
		);
}
