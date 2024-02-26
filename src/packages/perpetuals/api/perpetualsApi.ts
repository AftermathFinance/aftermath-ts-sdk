import {
	TransactionArgument,
	TransactionBlock,
	TransactionObjectArgument,
} from "@mysten/sui.js/transactions";
import { SuiEvent, Unsubscribe } from "@mysten/sui.js/client";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	CoinType,
	PerpetualsAccountObject,
	PerpetualsAddresses,
	ObjectId,
	SuiAddress,
	OracleAddresses,
	AnyObjectType,
	IndexerEventsWithCursor,
	IFixed,
	Balance,
	Timestamp,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import {
	perpetualsBcsRegistry,
	PerpetualsMarketParams,
	PerpetualsMarketState,
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsCreateAccountBody,
	PerpetualsMarketId,
	PerpetualsAccountId,
	PerpetualsOrderId,
	ApiPerpetualsSLTPOrderBody,
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsOrderbook,
	ApiPerpetualsPreviewOrderBody,
	ApiPerpetualsPreviewOrderResponse,
	ApiPerpetualsAccountsBody,
	PerpetualsOrderData,
	ApiPerpetualsAccountEventsBody,
	CollateralEvent,
	PerpetualsOrderEvent,
	PerpetualsOrderInfo,
	PerpetualsOrderbookState,
	OrderbookDataPoint,
	ApiPerpetualsOrderbookStateBody,
	PerpetualsOrderPrice,
	ApiPerpetualsMarketEventsBody,
	FilledMakerOrderEvent,
	FilledTakerOrderEvent,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	ApiPerpetualsCancelOrdersBody,
	PerpetualsMarketPriceDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsMarketVolumeDataPoint,
	PerpetualsAccountCap,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsLimitOrderBody,
	PerpetualsPosition,
	PerpetualsMarketData,
	PerpetualsRawAccountCap,
	PostedOrderReceiptEvent,
	ApiPerpetualsCancelOrderBody,
} from "../perpetualsTypes";
import { PerpetualsApiCasting } from "./perpetualsApiCasting";
import { Perpetuals } from "../perpetuals";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { EventOnChain } from "../../../general/types/castingTypes";
import {
	AllocatedCollateralEventOnChain,
	CanceledOrderEventOnChain,
	DeallocatedCollateralEventOnChain,
	DepositedCollateralEventOnChain,
	FilledMakerOrderEventOnChain,
	FilledTakerOrderEventOnChain,
	LiquidatedEventOnChain,
	PostedOrderEventOnChain,
	PostedOrderReceiptEventOnChain,
	SettledFundingEventOnChain,
	WithdrewCollateralEventOnChain,
} from "../perpetualsCastingTypes";
import { Aftermath } from "../../..";
import { PerpetualsOrderUtils } from "../utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { InspectionsApiHelpers } from "../../../general/apiHelpers/inspectionsApiHelpers";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";

export class PerpetualsApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			orderbook: "orderbook",
			events: "events",
			clearingHouse: "clearing_house",
			account: "account",
		},
	};

	public readonly addresses: {
		perpetuals: PerpetualsAddresses;
		oracle: OracleAddresses;
	};

	public readonly eventTypes: {
		withdrewCollateral: AnyObjectType;
		depositedCollateral: AnyObjectType;
		settledFunding: AnyObjectType;
		allocatedCollateral: AnyObjectType;
		deallocatedCollateral: AnyObjectType;
		liquidated: AnyObjectType;
		createdAccount: AnyObjectType;
		canceledOrder: AnyObjectType;
		postedOrder: AnyObjectType;
		postedOrderReceipt: AnyObjectType;
		filledMakerOrder: AnyObjectType;
		filledTakerOrder: AnyObjectType;
		updatedPremiumTwap: AnyObjectType;
		updatedSpreadTwap: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const perpetuals = this.Provider.addresses.perpetuals;
		const oracle = this.Provider.addresses.oracle;
		if (!perpetuals || !oracle)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			perpetuals,
			oracle,
		};
		this.eventTypes = {
			// Collateral
			withdrewCollateral: this.eventType("WithdrewCollateral"),
			depositedCollateral: this.eventType("DepositedCollateral"),
			settledFunding: this.eventType("SettledFunding"),
			allocatedCollateral: this.eventType("AllocatedCollateral"),
			deallocatedCollateral: this.eventType("DeallocatedCollateral"),
			// Liquidation
			liquidated: this.eventType("Liquidated"),
			// Account
			createdAccount: this.eventType("CreatedAccount"),
			// Order
			canceledOrder: this.eventType("OrderbookCanceledOrder"),
			postedOrder: this.eventType("PostedOrder"),
			filledMakerOrder: this.eventType("FilledMakerOrder"),
			filledTakerOrder: this.eventType("FilledTakerOrder"),
			// Order Receipts
			postedOrderReceipt: this.eventType("OrderbookPostReceipt"),
			// Twap
			updatedPremiumTwap: this.eventType("UpdatedPremiumTwap"),
			updatedSpreadTwap: this.eventType("UpdatedSpreadTwap"),
		};
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchOwnedRawAccountCapsOfType = async (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
	}): Promise<PerpetualsRawAccountCap[]> => {
		const { walletAddress, collateralCoinType } = inputs;
		const objectType = this.getAccountCapType({ collateralCoinType });

		const objectResponse =
			await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress({
				objectType,
				walletAddress,
				options: {
					showBcs: true,
					showType: true,
				},
			});

		const accCaps: PerpetualsRawAccountCap[] = objectResponse.map(
			(accCap) => {
				const accCapObj = perpetualsBcsRegistry.de(
					["Account", collateralCoinType],
					Casting.bcsBytesFromSuiObjectResponse(accCap),
					"base64"
				);
				return PerpetualsApiCasting.rawAccountCapFromRaw(
					accCapObj,
					collateralCoinType
				);
			}
		);

		return accCaps;
	};

	public fetchAccount = async (inputs: {
		accountId: PerpetualsAccountId;
	}): Promise<PerpetualsAccountObject> => {
		const { accountId } = inputs;

		const positionDatas: {
			marketId: PerpetualsMarketId;
			collateralCoinType: CoinType;
		}[] = await this.Provider.indexerCaller.fetchIndexer(
			`perpetuals/accounts/${accountId}/positions`
		);
		if (positionDatas.length <= 0) return { positions: [] };

		const tx = new TransactionBlock();

		for (const { marketId, collateralCoinType } of positionDatas) {
			this.getPositionTx({
				tx,
				accountId,
				marketId,
				collateralCoinType,
			});
		}

		const { allBytes } =
			await this.Provider.Inspections().fetchAllBytesFromTx({
				tx,
			});

		const partialPositions = allBytes.map((outputBytes) =>
			PerpetualsApiCasting.partialPositionFromRaw(
				perpetualsBcsRegistry.de(
					"Position",
					new Uint8Array(outputBytes[0])
				)
			)
		);
		const positions = partialPositions.map((position, index) => ({
			...position,
			collateralCoinType: Helpers.addLeadingZeroesToType(
				positionDatas[index].collateralCoinType
			),
			marketId: positionDatas[index].marketId,
		}));

		return { positions };
	};

	public fetchAccountOrderDatas = async (inputs: {
		accountId: PerpetualsAccountId;
		collateralCoinType: CoinType;
	}): Promise<PerpetualsOrderData[]> => {
		const { accountId, collateralCoinType } = inputs;
		const orders: PostedOrderReceiptEventOnChain[] =
			await this.Provider.indexerCaller.fetchIndexer(
				`perpetuals/accounts/${accountId}/orders`
			);
		if (orders.length <= 0) return [];

		const marketIdsToOrderEvents: Record<
			PerpetualsMarketId,
			PostedOrderReceiptEvent[]
		> = orders
			.map((order) =>
				Casting.perpetuals.postedOrderReceiptEventFromOnChain(order)
			)
			.reduce((acc, event) => {
				if (event.marketId in acc) {
					return {
						...acc,
						[event.marketId]: [...acc[event.marketId], event],
					};
				}

				return {
					...acc,
					[event.marketId]: [event],
				};
			}, {} as Record<PerpetualsMarketId, PostedOrderReceiptEvent[]>);

		return (
			await Promise.all(
				Object.entries(marketIdsToOrderEvents).map(
					async ([marketId, orderEvents]) => {
						const currentOrderSizes = await this.fetchOrdersSizes({
							marketId,
							collateralCoinType,
							orderIds: orderEvents.map((event) => event.orderId),
						});
						return orders.map((order, index) => {
							const { size: initialSize, ...event } =
								Casting.perpetuals.postedOrderReceiptEventFromOnChain(
									order
								);
							return {
								...event,
								side: Perpetuals.orderIdToSide(event.orderId),
								filledSize:
									initialSize - currentOrderSizes[index],
								initialSize,
							};
						});
					}
				)
			)
		).reduce((acc, orderDatas) => [...acc, ...orderDatas], []);
	};

	public fetchMarket = async (inputs: {
		marketId: PerpetualsMarketId;
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarketData> => {
		const { collateralCoinType } = inputs;
		return this.Provider.Objects().fetchCastObjectBcs({
			objectId: inputs.marketId,
			bcs: perpetualsBcsRegistry,
			fromDeserialized: (data) =>
				PerpetualsApiCasting.clearingHouseFromRaw(
					data,
					collateralCoinType
				),
			typeName: ["ClearingHouse", collateralCoinType],
		});
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public async fetchAccountCollateralEvents(
		inputs: ApiPerpetualsAccountEventsBody
	): Promise<IndexerEventsWithCursor<CollateralEvent>> {
		const { accountId, cursor, limit } = inputs;

		return this.Provider.indexerCaller.fetchIndexerEvents(
			`perpetuals/accounts/${accountId}/events/collateral`,
			{
				cursor,
				limit,
			},
			(event) => {
				const eventType = (event as EventOnChain<any>).type;
				return eventType.includes(this.eventTypes.withdrewCollateral)
					? Casting.perpetuals.withdrewCollateralEventFromOnChain(
							event as WithdrewCollateralEventOnChain
					  )
					: eventType.includes(this.eventTypes.depositedCollateral)
					? Casting.perpetuals.depositedCollateralEventFromOnChain(
							event as DepositedCollateralEventOnChain
					  )
					: eventType.includes(this.eventTypes.settledFunding)
					? Casting.perpetuals.settledFundingEventFromOnChain(
							event as SettledFundingEventOnChain
					  )
					: eventType.includes(this.eventTypes.allocatedCollateral)
					? Casting.perpetuals.allocatedCollateralEventFromOnChain(
							event as AllocatedCollateralEventOnChain
					  )
					: eventType.includes(this.eventTypes.deallocatedCollateral)
					? Casting.perpetuals.deallocatedCollateralEventFromOnChain(
							event as DeallocatedCollateralEventOnChain
					  )
					: eventType.includes(this.eventTypes.liquidated)
					? Casting.perpetuals.liquidatedEventFromOnChain(
							event as LiquidatedEventOnChain
					  )
					: eventType.includes(this.eventTypes.filledMakerOrder)
					? Casting.perpetuals.filledMakerOrderEventFromOnChain(
							event as FilledMakerOrderEventOnChain
					  )
					: Casting.perpetuals.filledTakerOrderEventFromOnChain(
							event as FilledTakerOrderEventOnChain
					  );
			}
		);

		// // set collateral delta based off of previous event
		// for (const [index, event] of eventsData.events.entries()) {
		// 	if (index >= eventsData.events.length - 1) {
		// 		eventsData.events[index].collateralDelta = event.collateral;
		// 		continue;
		// 	}

		// 	const previousEvent = eventsData.events[index + 1];
		// 	eventsData.events[index].collateralDelta =
		// 		Casting.IFixed.iFixedFromNumber(
		// 			Math.abs(
		// 				Casting.IFixed.numberFromIFixed(event.collateral)
		// 			) -
		// 				Math.abs(
		// 					Casting.IFixed.numberFromIFixed(
		// 						previousEvent.collateral
		// 					)
		// 				)
		// 		);
		// }

		// // if more events exist then remove last event since unable to calculate collateral delta
		// if (cursor !== undefined) {
		// 	eventsData.events = eventsData.events.slice(0, -1);
		// }

		// return eventsData;
	}

	public async fetchAccountOrderEvents(
		inputs: ApiPerpetualsAccountEventsBody
	): Promise<IndexerEventsWithCursor<PerpetualsOrderEvent>> {
		const { accountId, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`perpetuals/accounts/${accountId}/events/order`,
			{
				cursor,
				limit,
			},
			(event) => {
				const eventType = (event as EventOnChain<any>).type;
				return eventType.includes(this.eventTypes.canceledOrder)
					? Casting.perpetuals.canceledOrderEventFromOnChain(
							event as CanceledOrderEventOnChain
					  )
					: eventType.includes(this.eventTypes.postedOrderReceipt)
					? Casting.perpetuals.postedOrderReceiptEventFromOnChain(
							event as PostedOrderReceiptEventOnChain
					  )
					: eventType.includes(this.eventTypes.liquidated)
					? Casting.perpetuals.liquidatedEventFromOnChain(
							event as LiquidatedEventOnChain
					  )
					: eventType.includes(this.eventTypes.filledMakerOrder)
					? Casting.perpetuals.filledMakerOrderEventFromOnChain(
							event as FilledMakerOrderEventOnChain
					  )
					: Casting.perpetuals.filledTakerOrderEventFromOnChain(
							event as FilledTakerOrderEventOnChain
					  );
			}
		);
	}

	public async fetchMarketFilledOrderEvents(
		inputs: ApiPerpetualsMarketEventsBody
	): Promise<IndexerEventsWithCursor<FilledTakerOrderEvent>> {
		const { marketId, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`perpetuals/markets/${marketId}/events/filled-order`,
			{
				cursor,
				limit,
			},
			(event) =>
				Casting.perpetuals.filledTakerOrderEventFromOnChain(
					event as FilledTakerOrderEventOnChain
				)
		);
	}

	public fetchSubscribeToAllEvents = async (inputs: {
		onEvent: (event: SuiEvent) => void;
	}): Promise<Unsubscribe> => {
		const { onEvent } = inputs;

		const unsubscribe = await this.Provider.provider.subscribeEvent({
			// filter: {
			// 	MoveModule: {
			// 		module: PerpetualsApi.constants.moduleNames.events,
			// 		package: this.addresses.perpetuals.packages.perpetuals,
			// 	},
			// },
			// filter: {
			// 	MoveEventModule: {
			// 		module: PerpetualsApi.constants.moduleNames.events,
			// 		package: this.addresses.perpetuals.packages.events,
			// 	},
			// },
			filter: {
				MoveEventModule: {
					module: "interface",
					package: this.addresses.perpetuals.packages.events,
				},
			},
			onMessage: onEvent,
		});
		return unsubscribe;
	};

	// =========================================================================
	//  Indexer Data
	// =========================================================================

	public async fetchMarket24hrVolume(inputs: {
		marketId: PerpetualsMarketId;
	}): Promise<number> {
		const { marketId } = inputs;

		const response: [{ volume: number }] | [] =
			await this.Provider.indexerCaller.fetchIndexer(
				`perpetuals/markets/${marketId}/24hr-volume`
			);
		if (response.length === 0) return 0;

		return response[0].volume;
	}

	public fetchHistoricalMarketData = async (inputs: {
		marketId: PerpetualsMarketId;
		fromTimestamp: Timestamp;
		toTimestamp: Timestamp;
		intervalMs: number;
	}): Promise<ApiPerpetualsHistoricalMarketDataResponse> => {
		const { marketId, fromTimestamp, toTimestamp, intervalMs } = inputs;
		const [prices, volumes] = (await Promise.all([
			this.Provider.indexerCaller.fetchIndexer(
				`perpetuals/markets/${marketId}/historical-price`,
				undefined,
				{
					from: fromTimestamp,
					to: toTimestamp,
					interval: intervalMs,
				}
			),
			this.Provider.indexerCaller.fetchIndexer(
				`perpetuals/markets/${marketId}/historical-volume`,
				undefined,
				{
					from: fromTimestamp,
					to: toTimestamp,
					interval: intervalMs,
				}
			),
		])) as [
			prices: PerpetualsMarketPriceDataPoint[],
			volumes: PerpetualsMarketVolumeDataPoint[]
		];
		return { prices, volumes };
	};

	public async fetchMarketPrice24hrsAgo(inputs: {
		marketId: PerpetualsMarketId;
	}): Promise<number> {
		const { marketId } = inputs;

		dayjs.extend(duration);
		const timestamp =
			dayjs().valueOf() - dayjs.duration(24, "hours").asMilliseconds();

		const response: [{ timestamp: Timestamp; bookPrice: number }] | [] =
			await this.Provider.indexerCaller.fetchIndexer(
				`perpetuals/markets/${marketId}/first-historical-price`,
				undefined,
				{
					timestamp,
				}
			);
		if (response.length === 0) return 0;

		return response[0].bookPrice;
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchPreviewOrder = async (
		inputs: ApiPerpetualsPreviewOrderBody
	): Promise<ApiPerpetualsPreviewOrderResponse> => {
		const { collateralCoinType, marketId, side, lotSize, tickSize } =
			inputs;

		const bestPriceSide =
			side === PerpetualsOrderSide.Ask
				? PerpetualsOrderSide.Bid
				: PerpetualsOrderSide.Ask;

		// init tx and start session
		const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);

		// get orderbook best price before order
		this.bestPriceTx({
			tx,
			marketId,
			collateralCoinType,
			side: bestPriceSide,
		});

		// place order
		if ("slPrice" in inputs || "tpPrice" in inputs) {
			this.placeSLTPOrderTx({
				...inputs,
				tx,
				sessionPotatoId,
			});
		} else if ("price" in inputs) {
			this.placeLimitOrderTx({
				...inputs,
				tx,
				sessionPotatoId,
			});
		} else {
			this.placeMarketOrderTx({
				...inputs,
				tx,
				sessionPotatoId,
			});
		}

		// get position state after order
		this.getPositionTx({ ...inputs, tx });

		// get orderbook best price after order
		this.bestPriceTx({
			tx,
			marketId,
			collateralCoinType,
			side: bestPriceSide,
		});

		// end session
		this.endSessionAndTransferAccount({
			...inputs,
			tx,
			sessionPotatoId,
		});

		try {
			// inspect tx
			const { allBytes, events } =
				await this.Provider.Inspections().fetchAllBytesFromTx({
					tx,
					sender: inputs.walletAddress,
				});

			const bytesIndexOffet = inputs.hasPosition ? 0 : 1;

			// deserialize position
			const positionAfterOrder: PerpetualsPosition = {
				...PerpetualsApiCasting.partialPositionFromRaw(
					perpetualsBcsRegistry.de(
						"Position",
						new Uint8Array(allBytes[4 + bytesIndexOffet][0])
					)
				),
				collateralCoinType,
				marketId,
			};

			// deserialize orderbook prices
			const bestOrderbookPriceBeforeOrder =
				PerpetualsApiCasting.orderbookPriceFromBytes(
					allBytes[2 + bytesIndexOffet][0]
				);
			const bestOrderbookPriceAfterOrder =
				PerpetualsApiCasting.orderbookPriceFromBytes(
					allBytes[5 + bytesIndexOffet][0]
				);

			// try find relevant events
			const filledOrderEvents =
				Aftermath.helpers.events.findCastEventsOrUndefined({
					events,
					eventType: this.eventTypes.filledTakerOrder,
					castFunction:
						Casting.perpetuals.filledTakerOrderEventFromOnChain,
				});
			const postedOrderReceiptEvents =
				Aftermath.helpers.events.findCastEventsOrUndefined({
					events,
					eventType: this.eventTypes.postedOrderReceipt,
					castFunction:
						Casting.perpetuals.postedOrderReceiptEventFromOnChain,
				});

			const [filledSize, filledSizeUsd] = filledOrderEvents.reduce(
				(acc, event) => {
					const filledSize = Math.abs(
						Casting.IFixed.numberFromIFixed(event.baseAssetDelta)
					);
					const filledSizeUsd = Math.abs(
						Casting.IFixed.numberFromIFixed(event.quoteAssetDelta)
					);
					return [acc[0] + filledSize, acc[1] + filledSizeUsd];
				},
				[0, 0]
			);

			const [postedSize, postedSizeUsd] = postedOrderReceiptEvents.reduce(
				(acc, event) => {
					const postedSize = Number(event.size) * lotSize;
					const postedSizeUsd =
						postedSize *
						Perpetuals.orderPriceToPrice({
							orderPrice: Perpetuals.OrderUtils.price(
								event.orderId
							),
							lotSize,
							tickSize,
						});
					return [acc[0] + postedSize, acc[1] + postedSizeUsd];
				},
				[0, 0]
			);

			// calc slippages
			// const avgEntryPrice = !filledSize
			// 	? bestOrderbookPriceBeforeOrder
			// 	: filledSizeUsd / filledSize;
			// const priceSlippage = !bestOrderbookPriceBeforeOrder
			// 	? 0
			// 	: Math.abs(bestOrderbookPriceBeforeOrder - avgEntryPrice);
			// const percentSlippage = !bestOrderbookPriceBeforeOrder
			// 	? 0
			// 	: priceSlippage / bestOrderbookPriceBeforeOrder;

			// calc slippages
			const priceSlippage = !bestOrderbookPriceBeforeOrder
				? 0
				: Math.abs(
						bestOrderbookPriceBeforeOrder -
							bestOrderbookPriceAfterOrder
				  );
			const percentSlippage = !bestOrderbookPriceBeforeOrder
				? 0
				: priceSlippage / bestOrderbookPriceBeforeOrder;

			return {
				positionAfterOrder,
				priceSlippage,
				percentSlippage,
				filledSize,
				filledSizeUsd,
				postedSize,
				postedSizeUsd,
			};
		} catch (error) {
			if (!(error instanceof Error))
				throw new Error("invalid error thrown on preview order");

			return { error: error.message };
		}
	};

	public fetchOrderbookPrice = async (inputs: {
		collateralCoinType: ObjectId;
		marketId: PerpetualsMarketId;
	}): Promise<number> => {
		const { collateralCoinType, marketId } = inputs;

		const tx = new TransactionBlock();

		const orderbookId = this.getOrderbookTx({
			tx,
			collateralCoinType,
			marketId,
		});
		this.bookPriceTx({ tx, orderbookId });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		return PerpetualsApiCasting.orderbookPriceFromBytes(bytes);
	};

	public fetchAllMarketIds = async (inputs: {
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarketId[]> => {
		const { collateralCoinType } = inputs;
		return this.Provider.indexerCaller.fetchIndexer(
			`perpetuals/markets/${Helpers.addLeadingZeroesToType(
				collateralCoinType
			)}`
		);
	};

	public fetchOrderbookState = async (
		inputs: ApiPerpetualsOrderbookStateBody & {
			collateralCoinType: ObjectId;
			marketId: PerpetualsMarketId;
		}
	): Promise<PerpetualsOrderbookState> => {
		const { orderbookPrice, lotSize, tickSize } = inputs;

		const PRICE_SCALE_BOUND = 10;

		const midPrice = Perpetuals.priceToOrderPrice({
			...inputs,
			price: orderbookPrice,
		});
		const lowPrice = Perpetuals.priceToOrderPrice({
			...inputs,
			price: orderbookPrice / PRICE_SCALE_BOUND,
		});
		const highPrice = Perpetuals.priceToOrderPrice({
			...inputs,
			price: orderbookPrice * PRICE_SCALE_BOUND,
		});
		const [bids, asks] = await Promise.all([
			this.fetchOrderbookOrders({
				...inputs,
				side: PerpetualsOrderSide.Bid,
				fromPrice: midPrice,
				toPrice: lowPrice,
			}),
			this.fetchOrderbookOrders({
				...inputs,
				side: PerpetualsOrderSide.Ask,
				fromPrice: midPrice,
				toPrice: highPrice,
			}),
		]);

		const askPrices = asks.map((ask) => ask.price);
		const bidPrices = bids.map((bid) => bid.price);
		const minAskPrice =
			askPrices.length > 0 ? Helpers.minBigInt(...askPrices) : BigInt(0);
		const maxBidPrice =
			bidPrices.length > 0 ? Helpers.maxBigInt(...bidPrices) : BigInt(0);
		return {
			bids: PerpetualsApi.bucketOrders({
				...inputs,
				side: PerpetualsOrderSide.Bid,
				orders: bids,
			}),
			asks: PerpetualsApi.bucketOrders({
				...inputs,
				side: PerpetualsOrderSide.Ask,
				orders: asks,
			}),
			minAskPrice: Perpetuals.orderPriceToPrice({
				orderPrice: minAskPrice,
				lotSize,
				tickSize,
			}),
			maxBidPrice: Perpetuals.orderPriceToPrice({
				orderPrice: maxBidPrice,
				lotSize,
				tickSize,
			}),
		};
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public depositCollateralTx = (
		inputs: {
			tx: TransactionBlock;
			collateralCoinType: CoinType;
			accountCapId: ObjectId | TransactionArgument;
		} & (
			| {
					coinId: ObjectId | TransactionArgument;
			  }
			| {
					coinBytes: Uint8Array;
			  }
		)
	) => {
		const { tx, collateralCoinType, accountCapId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"deposit_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				"coinBytes" in inputs
					? tx.pure(inputs.coinBytes)
					: typeof inputs.coinId === "string"
					? tx.object(inputs.coinId)
					: inputs.coinId,
			],
		});
	};

	public allocateCollateralTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		amount: Balance;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, amount } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"allocate_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.pure(amount, "u64"),
			],
		});
	};

	public deallocateCollateralTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		amount: Balance;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, amount } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"deallocate_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(amount, "u64"),
			],
		});
	};

	public createMarketPositionTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market_position"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
			],
		});
	};

	public startSessionTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
	}) /* SessionHotPotato<T> */ => {
		const { tx, collateralCoinType, accountCapId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"start_session"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public endSessionTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
	}) /* Account<T> */ => {
		const { tx, collateralCoinType, sessionPotatoId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"end_session"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
			],
		});
	};

	public placeMarketOrderTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		size: bigint;
	}) => {
		const {
			tx,
			collateralCoinType,
			sessionPotatoId,
			marketId,
			side,
			size,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_market_order"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
				tx.pure(Boolean(side), "bool"),
				tx.pure(size, "u64"),
			],
		});
	};

	public placeLimitOrderTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		size: bigint;
		price: bigint;
		orderType: PerpetualsOrderType;
	}) => {
		const {
			tx,
			collateralCoinType,
			sessionPotatoId,
			marketId,
			side,
			size,
			price,
			orderType,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_limit_order"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
				tx.pure(Boolean(side), "bool"),
				tx.pure(size, "u64"),
				tx.pure(price, "u64"),
				tx.pure(BigInt(orderType), "u64"),
			],
		});
	};

	public cancelOrdersTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		orderIds: PerpetualsOrderId[];
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, orderIds } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"cancel_orders"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.pure(orderIds, "vector<u128>"),
			],
		});
	};

	public withdrawCollateralTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): TransactionArgument => {
		const { tx, collateralCoinType, accountCapId, amount } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"withdraw_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.pure(amount, "u64"),
			],
		});
	};

	public createAccountTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
	}) /* Account<T> */ => {
		const { tx, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_account"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(this.addresses.perpetuals.objects.registry)],
		});
	};

	public getHotPotatoFieldsTx = (
		inputs: {
			tx: TransactionBlock;
			collateralCoinType: CoinType;
			sessionPotatoId: ObjectId | TransactionArgument;
		}
		/*
			(
				lot_size,
				tick_size,
				timestamp_ms,
				collateral_price,
				index_price,
				book_price,
				fills, 
				post
			): (
				u64,
				u64,
				u64,
				u64,
				u256,
				u256,
				u256,
				&vector<FillReceipt>,
				&PostReceipt
			)
		*/
	) => {
		const { tx, collateralCoinType, sessionPotatoId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_hot_potato_fields"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
			],
		});
	};

	public placeSLTPOrderTx = (
		inputs: ApiPerpetualsSLTPOrderBody & {
			tx: TransactionBlock;
			sessionPotatoId: TransactionObjectArgument;
		}
	) => {
		const { tx } = inputs;

		if ("price" in inputs) {
			this.placeLimitOrderTx({ ...inputs, tx });
		} else {
			this.placeMarketOrderTx({ ...inputs, tx });
		}

		const orderType = PerpetualsOrderType.PostOnly;
		const side =
			inputs.side === PerpetualsOrderSide.Ask
				? PerpetualsOrderSide.Bid
				: PerpetualsOrderSide.Ask;

		const orderPrice =
			"price" in inputs ? inputs.price : inputs.marketPrice;

		if (
			"slPrice" in inputs &&
			((inputs.side === PerpetualsOrderSide.Ask &&
				inputs.slPrice > orderPrice) ||
				(inputs.side === PerpetualsOrderSide.Bid &&
					inputs.slPrice < orderPrice))
		) {
			this.placeLimitOrderTx({
				...inputs,
				tx,
				orderType,
				side,
				price: inputs.slPrice,
			});
		}

		if (
			"tpPrice" in inputs &&
			((inputs.side === PerpetualsOrderSide.Ask &&
				inputs.tpPrice < orderPrice) ||
				(inputs.side === PerpetualsOrderSide.Bid &&
					inputs.tpPrice > orderPrice))
		) {
			this.placeLimitOrderTx({
				...inputs,
				tx,
				orderType,
				side,
				price: inputs.tpPrice,
			});
		}
	};

	public getPositionTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountId: PerpetualsAccountId;
		marketId: PerpetualsMarketId;
	}) /* Position */ => {
		const { tx, marketId, collateralCoinType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_position"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(marketId), tx.pure(inputs.accountId, "u64")],
		});
	};

	public getOrderbookTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}) /* Orderbook */ => {
		const { tx, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_orderbook"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(inputs.marketId)],
		});
	};

	public bookPriceTx = (inputs: {
		tx: TransactionBlock;
		orderbookId: ObjectId | TransactionArgument;
	}) /* Option<u256> */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.orderbook,
				"book_price"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook
			],
		});
	};

	public bestPriceTx = (inputs: {
		tx: TransactionBlock;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		collateralCoinType: CoinType;
	}) /* Option<u256> */ => {
		const { tx, marketId, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_best_price"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId), // ClearingHouse
				tx.pure(Boolean(inputs.side), "bool"), // side
			],
		});
	};

	public inspectOrdersTx = (inputs: {
		tx: TransactionBlock;
		orderbookId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
		fromPrice: IFixed;
		toPrice: IFixed;
	}) /* vector<OrderInfo> */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.orderbook,
				"inspect_orders"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook

				tx.pure(Boolean(inputs.side), "bool"), // side
				tx.pure(inputs.fromPrice, "u64"), // price_from
				tx.pure(inputs.toPrice, "u64"), // price_to
			],
		});
	};

	public getOrderSizeTx = (inputs: {
		tx: TransactionBlock;
		orderbookId: ObjectId | TransactionArgument;
		orderId: PerpetualsOrderId;
	}) /* u64 */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.orderbook,
				"get_order_size"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook
				tx.pure(inputs.orderId, "u128"), // order_id
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildDepositCollateralTx = async (
		inputs: ApiPerpetualsDepositCollateralBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { walletAddress, collateralCoinType, amount } = inputs;
		const coinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: collateralCoinType,
			coinAmount: amount,
		});
		this.depositCollateralTx({
			tx,
			coinId,
			...inputs,
		});

		return tx;
	};

	public buildPlaceMarketOrderTx = (inputs: ApiPerpetualsMarketOrderBody) => {
		const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);
		this.placeMarketOrderTx({
			...inputs,
			tx,
			sessionPotatoId,
		});
		this.endSessionAndTransferAccount({
			...inputs,
			tx,
			sessionPotatoId,
		});
		return tx;
	};

	public buildPlaceLimitOrderTx = (inputs: ApiPerpetualsLimitOrderBody) => {
		const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);
		// TODO: handle (de)allocations everywhere
		this.placeLimitOrderTx({
			...inputs,
			tx,
			sessionPotatoId,
		});
		this.endSessionAndTransferAccount({
			...inputs,
			tx,
			sessionPotatoId,
		});
		return tx;
	};

	public buildCancelOrderTx = (
		inputs: ApiPerpetualsCancelOrderBody
	): TransactionBlock => {
		const { orderId, marketId, ...otherInputs } = inputs;

		return this.buildCancelOrdersTx({
			...otherInputs,
			orderDatas: [{ orderId, marketId }],
		});
	};

	public buildCancelOrdersTx = (
		inputs: ApiPerpetualsCancelOrdersBody
	): TransactionBlock => {
		const { orderDatas, collateralCoinType, accountCapId } = inputs;

		if (orderDatas.length <= 0)
			throw new Error("cannot have order datas of length zero");

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const marketIdToOrderIds = orderDatas.reduce((acc, order) => {
			if (order.marketId in acc) {
				return {
					...acc,
					[order.marketId]: [...acc[order.marketId], order.orderId],
				};
			}
			return {
				...acc,
				[order.marketId]: [order.orderId],
			};
		}, {} as Record<PerpetualsMarketId, PerpetualsOrderId[]>);

		for (const [marketId, orderIds] of Object.entries(marketIdToOrderIds)) {
			this.cancelOrdersTx({
				tx,
				collateralCoinType,
				accountCapId,
				marketId,
				orderIds,
			});
		}

		return tx;
	};

	public buildWithdrawCollateralTx = (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): TransactionBlock => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const coin = this.withdrawCollateralTx({
			tx,
			...inputs,
		});

		tx.transferObjects([coin], tx.pure(inputs.walletAddress));

		return tx;
	};

	public buildCreateAccountTx = (
		inputs: ApiPerpetualsCreateAccountBody
	): TransactionBlock => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const accountCap = this.createAccountTx({
			tx,
			...inputs,
		});
		tx.transferObjects([accountCap], tx.pure(inputs.walletAddress));

		return tx;
	};

	public buildPlaceSLTPOrderTx = (
		inputs: ApiPerpetualsSLTPOrderBody
	): TransactionBlock => {
		const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);

		this.placeSLTPOrderTx({
			...inputs,
			tx,
			sessionPotatoId,
		});

		return tx;
	};

	public buildTransferCollateralTx = (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		fromAccountCapId: ObjectId | TransactionArgument;
		toAccountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): TransactionBlock => {
		const {
			walletAddress,
			collateralCoinType,
			fromAccountCapId,
			toAccountCapId,
			amount,
		} = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const coinId = this.withdrawCollateralTx({
			tx,
			collateralCoinType,
			amount,
			accountCapId: fromAccountCapId,
		});
		this.depositCollateralTx({
			tx,
			collateralCoinType,
			coinId,
			accountCapId: toAccountCapId,
		});

		return tx;
	};

	// TODO: add to sdk
	public buildAllocateCollateralTx = TransactionsApiHelpers.createBuildTxFunc(
		this.allocateCollateralTx
	);

	// TODO: add to sdk
	public buildDeallocateCollateralTx =
		TransactionsApiHelpers.createBuildTxFunc(this.deallocateCollateralTx);

	// =========================================================================
	//  Helpers
	// =========================================================================

	public getAccountCapType = (inputs: {
		collateralCoinType: CoinType;
	}): string => {
		return `${this.addresses.perpetuals.packages.perpetuals}::${PerpetualsApi.constants.moduleNames.account}::Account<${inputs.collateralCoinType}>`;
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private fetchOrdersSizes = async (inputs: {
		orderIds: PerpetualsOrderId[];
		collateralCoinType: ObjectId;
		marketId: PerpetualsMarketId;
	}): Promise<bigint[]> => {
		const { orderIds, marketId, collateralCoinType } = inputs;
		if (orderIds.length <= 0) return [];

		const tx = new TransactionBlock();

		const orderbookId = this.getOrderbookTx({
			tx,
			collateralCoinType,
			marketId,
		});

		for (const orderId of orderIds) {
			this.getOrderSizeTx({
				tx,
				orderId,
				orderbookId,
			});
		}

		const { allBytes } =
			await this.Provider.Inspections().fetchAllBytesFromTx({
				tx,
			});

		const sizes = allBytes
			.slice(1)
			.map((bytes) => Casting.bigIntFromBytes(bytes[0]));
		return sizes;
	};

	private fetchOrderbookOrders = async (inputs: {
		collateralCoinType: ObjectId;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		fromPrice: PerpetualsOrderPrice;
		toPrice: PerpetualsOrderPrice;
	}): Promise<PerpetualsOrderInfo[]> => {
		const { collateralCoinType, marketId, side, fromPrice, toPrice } =
			inputs;

		const tx = new TransactionBlock();

		const orderbookId = this.getOrderbookTx({
			tx,
			collateralCoinType,
			marketId,
		});
		this.inspectOrdersTx({ tx, orderbookId, side, fromPrice, toPrice });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const orderInfos: any[] = perpetualsBcsRegistry.de(
			"vector<OrderInfo>",
			new Uint8Array(bytes)
		);

		return orderInfos.map((orderInfo) =>
			Casting.perpetuals.orderInfoFromRaw(orderInfo)
		);
	};

	public fetchExecutionPrice = async (
		inputs: ApiPerpetualsExecutionPriceBody & {
			collateralCoinType: CoinType;
			marketId: PerpetualsMarketId;
		}
	): Promise<ApiPerpetualsExecutionPriceResponse> => {
		const {
			collateral,
			collateralCoinType,
			marketId,
			side,
			size,
			price,
			lotSize,
		} = inputs;

		// const accountCapId = perpetualsBcsRegistry
		// 	.ser(`Account<${collateralCoinType}>`, {
		// 		id: {
		// 			id: {
		// 				bytes: "0x0000000000000000000000000000000000000000000000000000000000000321",
		// 			},
		// 		},
		// 		accountId: 0,
		// 		collateral,
		// 	})
		// 	.toBytes();

		const depositCoinBytes = perpetualsBcsRegistry
			.ser(["Coin", collateralCoinType], {
				id: "0x0000000000000000000000000000000000000000000000000000000000000123",
				balance: {
					value: BigInt(1000000000000000),
				},
			})
			.toBytes();

		const walletAddress = InspectionsApiHelpers.constants.devInspectSigner;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const accountCapId = this.createAccountTx({
			...inputs,
			tx,
		});
		this.depositCollateralTx({
			tx,
			collateralCoinType,
			accountCapId,
			coinBytes: depositCoinBytes,
		});
		const { sessionPotatoId } = this.createTxAndStartSession({
			tx,
			accountCapId,
			collateralCoinType,
			marketId,
			walletAddress,
			collateralChange: BigInt(1000000000000000),
			hasPosition: false,
		});
		this.placeLimitOrderTx({
			tx,
			side,
			size,
			collateralCoinType,
			marketId,
			sessionPotatoId,
			orderType: PerpetualsOrderType.Standard,
			price:
				price ??
				(side === PerpetualsOrderSide.Bid
					? BigInt("0x7FFFFFFFFFFFFFFF") // 2^63 - 1
					: BigInt(0)),
		});
		this.getHotPotatoFieldsTx({
			tx,
			collateralCoinType,
			sessionPotatoId,
		});
		this.endSessionAndTransferAccount({
			...inputs,
			tx,
			sessionPotatoId,
			walletAddress,
		});

		const { events } =
			await this.Provider.Inspections().fetchAllBytesFromTx({
				tx,
			});

		const filledTakerEvent = EventsApiHelpers.findCastEventOrUndefined({
			events,
			eventType: this.eventTypes.filledTakerOrder,
			castFunction: Casting.perpetuals.filledTakerOrderEventFromOnChain,
		});

		const sizeNum = lotSize * Number(size);

		if (!filledTakerEvent) {
			return {
				executionPrice: 0,
				sizeFilled: 0,
				sizePosted: sizeNum,
			};
		}

		const executionPrice = Perpetuals.calcEntryPrice(filledTakerEvent);
		const sizeFilled = Math.abs(
			Casting.IFixed.numberFromIFixed(filledTakerEvent.baseAssetDelta)
		);
		const sizePosted = sizeNum - sizeFilled;

		return {
			executionPrice,
			sizeFilled,
			sizePosted,
		};

		// const { fillReceipts, postReceipt } =
		// 	await this.fetchMarketOrderReceipts(inputs);

		// const sizePosted = postReceipt !== undefined ? postReceipt.size : 0;
		// if (fillReceipts.length <= 0)
		// 	return price !== undefined
		// 		? // simulating limit order
		// 		  {
		// 				executionPrice: Perpetuals.orderPriceToPrice({
		// 					orderPrice: price,
		// 					lotSize,
		// 					tickSize,
		// 				}),
		// 				sizeFilled: 0,
		// 				sizePosted: Number(sizePosted),
		// 		  }
		// 		: // simulating market order
		// 		  {
		// 				executionPrice: 0,
		// 				sizeFilled: 0,
		// 				sizePosted: 0,
		// 		  };

		// const sizeFilled = Helpers.sumBigInt(
		// 	fillReceipts.map((receipt) => receipt.size)
		// );

		// const executionPrice = fillReceipts.reduce((acc, receipt) => {
		// 	const orderPrice = PerpetualsOrderUtils.price(
		// 		receipt.orderId,
		// 		inputs.side === PerpetualsOrderSide.Ask
		// 			? PerpetualsOrderSide.Bid
		// 			: PerpetualsOrderSide.Ask
		// 	);
		// 	const orderPriceNum = Perpetuals.orderPriceToPrice({
		// 		orderPrice,
		// 		lotSize,
		// 		tickSize,
		// 	});

		// 	return (
		// 		acc +
		// 		orderPriceNum * (Number(receipt.size) / Number(sizeFilled))
		// 	);
		// }, 0);

		// return {
		// 	executionPrice,
		// 	sizeFilled: Number(sizeFilled),
		// 	sizePosted: Number(sizePosted),
		// };
	};

	private createTxAndStartSession = (inputs: {
		tx?: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		walletAddress: SuiAddress;
		collateralChange: Balance;
		hasPosition: boolean;
	}) => {
		const { collateralChange, walletAddress, hasPosition } = inputs;
		const { tx: inputsTx, ...nonTxInputs } = inputs;

		const tx = inputsTx ?? new TransactionBlock();
		tx.setSender(walletAddress);

		if (!hasPosition) {
			this.createMarketPositionTx({
				...nonTxInputs,
				tx,
			});
		}

		if (collateralChange > BigInt(0)) {
			this.allocateCollateralTx({
				...nonTxInputs,
				tx,
				amount: collateralChange,
			});
		} else if (collateralChange < BigInt(0)) {
			this.deallocateCollateralTx({
				...nonTxInputs,
				tx,
				amount: collateralChange,
			});
		}

		const sessionPotatoId = this.startSessionTx({
			...nonTxInputs,
			tx,
		});

		return { tx, sessionPotatoId };
	};

	private endSessionAndTransferAccount = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		walletAddress: SuiAddress;
	}) => {
		const { tx, walletAddress } = inputs;

		const accountId = this.endSessionTx(inputs);
		tx.transferObjects([accountId], tx.pure(walletAddress));
	};

	// =========================================================================
	//  Public Static Helpers
	// =========================================================================

	public static bucketOrders = (inputs: {
		orders: PerpetualsOrderInfo[];
		side: PerpetualsOrderSide;
		lotSize: number;
		tickSize: number;
		priceBucketSize: number;
		initialBucketedOrders?: OrderbookDataPoint[];
	}): OrderbookDataPoint[] => {
		const {
			orders,
			side,
			lotSize,
			tickSize,
			priceBucketSize,
			initialBucketedOrders,
		} = inputs;

		let dataPoints: OrderbookDataPoint[] = orders.reduce((acc, order) => {
			const actualPrice = Perpetuals.orderPriceToPrice({
				lotSize,
				tickSize: Math.abs(tickSize),
				orderPrice: order.price,
			});
			const roundedPrice =
				Math.round(actualPrice / priceBucketSize) * priceBucketSize;
			// negative tick size means order filled
			const size = lotSize * Number(order.size) * (tickSize < 0 ? -1 : 1);
			const sizeUsd = size * actualPrice;

			const placementIndex = acc.findIndex(
				(dataPoint: OrderbookDataPoint) =>
					side === PerpetualsOrderSide.Ask
						? roundedPrice <= dataPoint.price &&
						  roundedPrice > dataPoint.price - priceBucketSize
						: roundedPrice >= dataPoint.price &&
						  roundedPrice < dataPoint.price + priceBucketSize
			);
			if (placementIndex < 0) {
				// no bucket exists; create bucket
				const insertIndex = acc.findIndex((dataPoint) =>
					side === PerpetualsOrderSide.Ask
						? roundedPrice <= dataPoint.price
						: roundedPrice >= dataPoint.price
				);

				const newDataPoint = {
					size,
					sizeUsd,
					totalSize: 0,
					totalSizeUsd: 0,
					price: roundedPrice,
				};
				if (insertIndex === 0) {
					return [newDataPoint, ...acc];
				} else if (insertIndex < 0) {
					return [...acc, newDataPoint];
				} else {
					return [
						...acc.slice(0, insertIndex),
						newDataPoint,
						...acc.slice(insertIndex + 1),
					];
				}
			} else {
				// bucket found
				const newAcc = Array.from(acc);
				newAcc[placementIndex] = {
					...newAcc[placementIndex],
					size: newAcc[placementIndex].size + size,
					totalSize: newAcc[placementIndex].totalSize + size,
					sizeUsd: newAcc[placementIndex].sizeUsd + sizeUsd,
					totalSizeUsd: newAcc[placementIndex].totalSizeUsd + sizeUsd,
				};
				return newAcc;
			}
		}, initialBucketedOrders ?? ([] as OrderbookDataPoint[]));

		// remove 0 size buckets
		dataPoints = dataPoints.filter(
			(data) => data.size > 0 && data.sizeUsd > 0
		);

		// compute total sizes
		for (const [index, data] of dataPoints.entries()) {
			dataPoints[index] = {
				...data,
				totalSize:
					index > 0
						? dataPoints[index - 1].totalSize + data.size
						: data.size,
				totalSizeUsd:
					index > 0
						? dataPoints[index - 1].totalSizeUsd + data.sizeUsd
						: data.sizeUsd,
			};
		}

		if (side === PerpetualsOrderSide.Ask) {
			dataPoints.reverse();
		}
		return dataPoints;
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private eventType = (eventName: string) =>
		EventsApiHelpers.createEventType(
			this.addresses.perpetuals.packages.events,
			PerpetualsApi.constants.moduleNames.events,
			eventName
		);
}
