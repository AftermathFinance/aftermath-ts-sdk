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
	ExchangeAddresses,
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
	bcs,
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
	ApiPerpetualsPositionOrderDatasBody,
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
	PerpetualsFillReceipt,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	ApiPerpetualsCancelOrdersBody,
	PerpetualsPostReceipt,
	PerpetualsMarketPriceDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsMarketVolumeDataPoint,
	PerpetualsAccountCap,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsLimitOrderBody,
} from "../perpetualsTypes";
import { PerpetualsApiCasting } from "./perpetualsApiCasting";
import { Perpetuals } from "../perpetuals";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { EventOnChain } from "../../../general/types/castingTypes";
import {
	CanceledOrderEventOnChain,
	DepositedCollateralEventOnChain,
	FilledMakerOrderEventOnChain,
	FilledTakerOrderEventOnChain,
	LiquidatedEventOnChain,
	PostedOrderEventOnChain,
	SettledFundingEventOnChain,
	WithdrewCollateralEventOnChain,
} from "../perpetualsCastingTypes";
import { Aftermath } from "../../..";
import { PerpetualsOrderUtils } from "../utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

export class PerpetualsApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			accountManager: "account_manager",
			marketManager: "market_manager",
			orderbook: "orderbook",
			events: "events",
			clearingHouse: "clearing_house",
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
		liquidated: AnyObjectType;
		createdAccount: AnyObjectType;
		canceledOrder: AnyObjectType;
		postedOrder: AnyObjectType;
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
			// Liquidation
			liquidated: this.eventType("Liquidated"),
			// Account
			createdAccount: this.eventType("CreatedAccount"),
			// Order
			canceledOrder: this.eventType("CanceledOrder"),
			postedOrder: this.eventType("PostedOrder"),
			filledMakerOrder: this.eventType("FilledMakerOrder"),
			filledTakerOrder: this.eventType("FilledTakerOrder"),
			// Twap
			updatedPremiumTwap: this.eventType("UpdatedPremiumTwap"),
			updatedSpreadTwap: this.eventType("UpdatedSpreadTwap"),
		};
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchOwnedAccountCapsOfType = async (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
	}): Promise<PerpetualsAccountCap[]> => {
		const { walletAddress, collateralCoinType } = inputs;
		const objectType = this.getAccountCapType({ collateralCoinType });

		let objectResponse =
			await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress({
				objectType,
				walletAddress,
				options: {
					showBcs: true,
					showType: true,
				},
			});

		let accCaps: PerpetualsAccountCap[] = objectResponse.map((accCap) => {
			const accCapObj = bcs.de(
				"AccountCap",
				Casting.bcsBytesFromSuiObjectResponse(accCap),
				"base64"
			);
			return PerpetualsApiCasting.accountCapWithTypeFromRaw(
				accCapObj,
				collateralCoinType
			);
		});

		return accCaps;
	};

	public fetchAccount = async (inputs: {
		collateralCoinType: CoinType;
		accountId: PerpetualsAccountId;
	}): Promise<PerpetualsAccountObject> => {
		const accountDfInfos =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType({
				parentObjectId:
					this.addresses.perpetuals.objects.exchanges[
						inputs.collateralCoinType
					]?.accountManager!,
			});

		const accountDfInfo = accountDfInfos.find((info) => {
			return (
				BigInt((info.name.value as any).account_id) === inputs.accountId
			);
		})!;

		const objectResponse = await this.Provider.provider.getObject({
			id: accountDfInfo.objectId,
			options: { showBcs: true },
		});
		const accountField = bcs.de(
			"Field<u64, Account>",
			Casting.bcsBytesFromSuiObjectResponse(objectResponse),
			"base64"
		);

		return PerpetualsApiCasting.accountFromRaw(accountField.value);
	};

	// public fetchAllAccountDatas = async (
	// 	inputs: ApiPerpetualsAccountsBody & {
	// 		collateralCoinType: CoinType;
	// 	}
	// ): Promise<PerpetualsAccountData[]> => {
	// 	const accountCaps = await this.fetchOwnedAccountCapsOfType(inputs);
	// 	const accounts = await Promise.all(
	// 		accountCaps.map((cap) => this.fetchAccount(cap))
	// 	);
	// 	return accounts.map((account, index) => ({
	// 		account,
	// 		accountCap: accountCaps[index],
	// 	}));
	// };

	public fetchPositionOrderDatas = async (
		inputs: ApiPerpetualsPositionOrderDatasBody & {
			marketId: PerpetualsMarketId;
			accountId: PerpetualsAccountId;
		}
	): Promise<PerpetualsOrderData[]> => {
		const { accountId, marketId, openOrders } = inputs;

		// TODO
	};

	public fetchPositionOrderIds = async (inputs: {
		positionAsksId: ObjectId;
		positionBidsId: ObjectId;
	}): Promise<{
		askOrderIds: PerpetualsOrderId[];
		bidOrderIds: PerpetualsOrderId[];
	}> => {
		const { positionAsksId, positionBidsId } = inputs;

		const [askOrderIds, bidOrderIds] = await Promise.all([
			this.fetchOrderedVecSet({
				objectId: positionAsksId,
			}),
			this.fetchOrderedVecSet({
				objectId: positionBidsId,
			}),
		]);

		return {
			askOrderIds,
			bidOrderIds,
		};
	};

	public fetchMarketState = async (inputs: {
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarketState> => {
		const pkg = this.addresses.perpetuals.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::State>`,
					value: { market_id: String(inputs.marketId) },
				},
			});
		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const mktStateField = bcs.de(
			"Field<MarketKey, MarketState>",
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);
		return PerpetualsApiCasting.marketStateFromRaw(mktStateField.value);
	};

	public fetchMarketParams = async (inputs: {
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarketParams> => {
		const pkg = this.addresses.perpetuals.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::Params>`,
					value: { market_id: String(inputs.marketId) },
				},
			});
		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const mktParamsField = bcs.de(
			"Field<MarketKey, MarketParams>",
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);
		return PerpetualsApiCasting.marketParamsFromRaw(mktParamsField.value);
	};

	public fetchOrderbook = async (inputs: {
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsOrderbook> => {
		const pkg = this.addresses.perpetuals.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::Orderbook>`,
					value: { market_id: String(inputs.marketId) },
				},
			});
		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const orderbook = bcs.de(
			"Orderbook",
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);

		return PerpetualsApiCasting.orderbookFromRaw(orderbook);
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public async fetchAccountCollateralEvents(
		inputs: ApiPerpetualsAccountEventsBody
	): Promise<IndexerEventsWithCursor<CollateralEvent>> {
		const { accountId, cursor, limit } = inputs;

		const eventsData: IndexerEventsWithCursor<CollateralEvent> =
			await this.Provider.indexerCaller.fetchIndexerEvents(
				`perpetuals/accounts/${accountId}/events/collateral`,
				{
					cursor,
					limit,
				},
				(event) => {
					const eventType = (event as EventOnChain<any>).type;
					return eventType.includes(
						this.eventTypes.withdrewCollateral
					)
						? Casting.perpetuals.withdrewCollateralEventFromOnChain(
								event as WithdrewCollateralEventOnChain
						  )
						: eventType.includes(
								this.eventTypes.depositedCollateral
						  )
						? Casting.perpetuals.depositedCollateralEventFromOnChain(
								event as DepositedCollateralEventOnChain
						  )
						: eventType.includes(this.eventTypes.settledFunding)
						? Casting.perpetuals.settledFundingEventFromOnChain(
								event as SettledFundingEventOnChain
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

		// set collateral delta based off of previous event
		for (const [index, event] of eventsData.events.entries()) {
			if (index >= eventsData.events.length - 1) {
				eventsData.events[index].collateralDelta = event.collateral;
				continue;
			}

			const previousEvent = eventsData.events[index + 1];
			eventsData.events[index].collateralDelta =
				Casting.IFixed.iFixedFromNumber(
					Math.abs(
						Casting.IFixed.numberFromIFixed(event.collateral)
					) -
						Math.abs(
							Casting.IFixed.numberFromIFixed(
								previousEvent.collateral
							)
						)
				);
		}

		// if more events exist then remove last event since unable to calculate collateral delta
		if (cursor !== undefined) {
			eventsData.events = eventsData.events.slice(0, -1);
		}

		return eventsData;
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
					: eventType.includes(this.eventTypes.postedOrder)
					? Casting.perpetuals.postedOrderEventFromOnChain(
							event as PostedOrderEventOnChain
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

		// get orderbook object
		const orderbookId = this.getOrderbookTx({
			tx,
			collateralCoinType,
			marketId,
		});

		// get orderbook best price before order
		this.bestPriceTx({ tx, orderbookId, side: bestPriceSide });

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

		// get account state after order
		this.getPositionTx({ ...inputs, tx });

		// get orderbook best price after order
		this.bestPriceTx({ tx, orderbookId, side: bestPriceSide });

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

			// deserialize account
			const accountAfterOrder = PerpetualsApiCasting.accountFromRaw(
				bcs.de("Account", new Uint8Array(allBytes[3][0]))
			);

			// deserialize orderbook prices
			const bestOrderbookPriceBeforeOrder =
				PerpetualsApiCasting.orderbookPriceFromBytes(allBytes[1][0]);
			const bestOrderbookPriceAfterOrder =
				PerpetualsApiCasting.orderbookPriceFromBytes(allBytes[4][0]);

			// try find relevant events
			const filledOrderEvents =
				Aftermath.helpers.events.findCastEventsOrUndefined({
					events,
					eventType: this.eventTypes.filledTakerOrder,
					castFunction:
						Casting.perpetuals.filledTakerOrderEventFromOnChain,
				});
			const postedOrderEvents =
				Aftermath.helpers.events.findCastEventsOrUndefined({
					events,
					eventType: this.eventTypes.postedOrder,
					castFunction:
						Casting.perpetuals.postedOrderEventFromOnChain,
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

			const [postedSize, postedSizeUsd] = postedOrderEvents.reduce(
				(acc, event) => {
					const postedSize = Number(event.size) * lotSize;
					const postedSizeUsd =
						postedSize *
						Perpetuals.orderPriceToPrice({
							orderPrice: Perpetuals.OrderUtils.price(
								event.orderId,
								event.side
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
				accountAfterOrder,
				priceSlippage,
				percentSlippage,
				filledSize,
				filledSizeUsd,
				postedSize,
				postedSizeUsd,
			};
		} catch (error) {
			if (!(error instanceof Error))
				throw new Error("Invalid error thrown on preview order");

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
		collateralCoinType: ObjectId;
	}): Promise<PerpetualsMarketId[]> => {
		const tx = new TransactionBlock();

		this.getMarketIdsTx({ ...inputs, tx });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const marketIds: any[] = bcs.de("vector<u64>", new Uint8Array(bytes));
		return marketIds.map((marketId) => BigInt(marketId));
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

	public initializeForCollateralTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
	}) => {
		const { tx, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"initialize_for_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
				tx.object(this.addresses.perpetuals.objects.registry),
			],
		});
	};

	public transferAdminCapTx = (inputs: {
		tx: TransactionBlock;
		targetAddress: SuiAddress;
	}) => {
		const { tx, targetAddress } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"transfer_admin_cap"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
				tx.pure(targetAddress),
			],
		});
	};

	public addInsuranceFundTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
	}) => {
		const { tx, collateralCoinType } = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[collateralCoinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"add_insurance_fund"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
				tx.object(exchangeCfg.insuranceFunds),
			],
		});
	};

	public createMarketTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
		marginRatioInitial: bigint;
		marginRatioMaintenance: bigint;
		baseAssetSymbol: string;
		fundingFrequencyMs: bigint;
		fundingPeriodMs: bigint;
		premiumTwapFrequencyMs: bigint;
		premiumTwapPeriodMs: bigint;
		spreadTwapFrequencyMs: bigint;
		spreadTwapPeriodMs: bigint;
		makerFee: bigint;
		takerFee: bigint;
		liquidationFee: bigint;
		forceCancelFee: bigint;
		insuranceFundFee: bigint;
		insuranceFundId: bigint;
		lotSize: bigint;
		tickSize: bigint;
		branchMin: bigint;
		branchMax: bigint;
		leafMin: bigint;
		leafMax: bigint;
		branchesMergeMax: bigint;
		leavesMergeMax: bigint;
	}) => {
		const {
			tx,
			collateralCoinType,
			marketId,
			marginRatioInitial,
			marginRatioMaintenance,
			baseAssetSymbol,
			fundingFrequencyMs,
			fundingPeriodMs,
			premiumTwapFrequencyMs,
			premiumTwapPeriodMs,
			spreadTwapFrequencyMs,
			spreadTwapPeriodMs,
			makerFee,
			takerFee,
			liquidationFee,
			forceCancelFee,
			insuranceFundFee,
			insuranceFundId,
			lotSize,
			tickSize,
			branchMin,
			branchMax,
			leafMin,
			leafMax,
			branchesMergeMax,
			leavesMergeMax,
		} = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[collateralCoinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
				tx.object(exchangeCfg.marketManager),
				tx.object(exchangeCfg.insuranceFunds),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
				tx.object(marketId),
				tx.pure(marginRatioInitial),
				tx.pure(marginRatioMaintenance),
				tx.pure(baseAssetSymbol),
				tx.pure(fundingFrequencyMs),
				tx.pure(fundingPeriodMs),
				tx.pure(premiumTwapFrequencyMs),
				tx.pure(premiumTwapPeriodMs),
				tx.pure(spreadTwapFrequencyMs),
				tx.pure(spreadTwapPeriodMs),
				tx.pure(makerFee),
				tx.pure(takerFee),
				tx.pure(liquidationFee),
				tx.pure(forceCancelFee),
				tx.pure(insuranceFundFee),
				tx.pure(insuranceFundId),
				tx.pure(lotSize),
				tx.pure(tickSize),
				tx.pure(branchMin),
				tx.pure(branchMax),
				tx.pure(leafMin),
				tx.pure(leafMax),
				tx.pure(branchesMergeMax),
				tx.pure(leavesMergeMax),
			],
		});
	};

	public depositCollateralTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		coinId: ObjectId | TransactionArgument;
	}) => {
		const { tx, collateralCoinType, accountCapId, coinId } = inputs;
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
				typeof coinId === "string" ? tx.object(coinId) : coinId,
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
				tx.pure(Boolean(side)),
				tx.pure(size),
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
				tx.pure(Boolean(side)),
				tx.pure(size),
				tx.pure(price),
				tx.pure(BigInt(orderType)),
			],
		});
	};

	public cancelOrderTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		orderId: PerpetualsOrderId;
	}) => {
		const {
			tx,
			collateralCoinType,
			accountCapId,
			marketId,
			side,
			orderId,
		} = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[collateralCoinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"cancel_order"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.marketManager),
				tx.object(marketId),
				tx.pure(Boolean(side)),
				tx.pure(orderId),
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

	public liquidateTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		liqeeAccountId: PerpetualsAccountId;
		sizes: bigint[];
	}) => {
		const { tx, collateralCoinType, accountCapId, liqeeAccountId, sizes } =
			inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[collateralCoinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"liquidate"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.marketManager),
				tx.object(exchangeCfg.vault),
				tx.object(exchangeCfg.insuranceFunds),
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(liqeeAccountId),
				tx.pure(sizes),
			],
		});
	};

	public updateFundingTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}) => {
		const { tx, collateralCoinType, marketId } = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[collateralCoinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"update_funding"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(exchangeCfg.marketManager),
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(marketId),
			],
		});
	};

	public createAccountTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
	}) => {
		const { tx, collateralCoinType } = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[collateralCoinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_account"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(exchangeCfg.accountManager)],
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
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.marketManager,
				"get_orderbook"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(mktMngId), tx.pure(inputs.marketId, "u64")],
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
		orderbookId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
	}) /* Option<u256> */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.orderbook,
				"best_price"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook
				tx.pure(Boolean(inputs.side), "bool"), // side
			],
		});
	};

	public getMarketIdsTx = (inputs: {
		tx: TransactionBlock;
		collateralCoinType: CoinType;
	}) /* &vector<u64> */ => {
		const { tx, collateralCoinType } = inputs;
		const mktMngId = this.getExchangeConfig({
			collateralCoinType,
		}).marketManager;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.marketManager,
				"get_market_ids"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(mktMngId)],
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

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public buildInitializeForCollateralTx =
		Helpers.transactions.createBuildTxFunc(this.initializeForCollateralTx);

	public buildTransferAdminCapTx = Helpers.transactions.createBuildTxFunc(
		this.transferAdminCapTx
	);

	public buildAddInsuranceFundTx = Helpers.transactions.createBuildTxFunc(
		this.addInsuranceFundTx
	);

	public buildCreateMarketTx = Helpers.transactions.createBuildTxFunc(
		this.createMarketTx
	);

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

	public buildCancelOrderTx = Helpers.transactions.createBuildTxFunc(
		this.cancelOrderTx
	);

	public buildCancelOrdersTx = (
		inputs: ApiPerpetualsCancelOrdersBody
	): TransactionBlock => {
		const { orderDatas, collateralCoinType, accountCapId } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		for (const orderData of orderDatas) {
			this.cancelOrderTx({
				tx,
				collateralCoinType,
				accountCapId,
				...orderData,
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

	public buildLiquidateTx = Helpers.transactions.createBuildTxFunc(
		this.liquidateTx
	);

	public buildUpdateFundingTx = Helpers.transactions.createBuildTxFunc(
		this.updateFundingTx
	);

	public buildCreateAccountTx = (
		inputs: ApiPerpetualsCreateAccountBody
	): TransactionBlock => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const accCap = this.createAccountTx({
			tx,
			...inputs,
		});

		tx.transferObjects([accCap], tx.pure(inputs.walletAddress));

		return tx;
	};

	public buildPlaceSLTPOrderTx = Helpers.transactions.createBuildTxFunc(
		this.placeSLTPOrderTx
	);

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

	// =========================================================================
	//  Helpers
	// =========================================================================

	public getExchangeConfig = (inputs: {
		collateralCoinType: CoinType;
	}): ExchangeAddresses => {
		return this.addresses.perpetuals.objects.exchanges[
			inputs.collateralCoinType
		]!;
	};

	public getAccountCapType = (inputs: {
		collateralCoinType: CoinType;
	}): string => {
		return `${this.addresses.perpetuals.packages.perpetuals}::${PerpetualsApi.constants.moduleNames.accountManager}::AccountCap<${inputs.collateralCoinType}>`;
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private fetchOrderedVecSet = async (inputs: {
		objectId: ObjectId;
	}): Promise<bigint[]> => {
		const keyType = `${this.addresses.perpetuals.packages.perpetuals}::ordered_vec_set::Contents`;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: inputs.objectId,
				name: {
					type: keyType,
					value: { dummy_field: Boolean() },
				},
			});

		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const orderKeys = bcs.de(
			`Field<Contents, vector<u128>>`,
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);

		const res = orderKeys.value.map((value: string) => {
			return BigInt(value);
		});
		return res;
	};

	private fetchOrdersSizes = async (inputs: {
		orderIds: PerpetualsOrderId[];
		side: PerpetualsOrderSide;
		collateralCoinType: ObjectId;
		marketId: PerpetualsMarketId;
	}): Promise<bigint[]> => {
		const { orderIds, marketId, side, collateralCoinType } = inputs;

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
				side,
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

		const orderInfos: any[] = bcs.de(
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
		const { lotSize, tickSize, price } = inputs;

		const { fillReceipts, postReceipt } =
			await this.fetchMarketOrderReceipts(inputs);

		const sizePosted = postReceipt !== undefined ? postReceipt.size : 0;
		if (fillReceipts.length <= 0)
			return price !== undefined
				? // simulating limit order
				  {
						executionPrice: Perpetuals.orderPriceToPrice({
							orderPrice: price,
							lotSize,
							tickSize,
						}),
						sizeFilled: 0,
						sizePosted: Number(sizePosted),
				  }
				: // simulating market order
				  {
						executionPrice: 0,
						sizeFilled: 0,
						sizePosted: 0,
				  };

		const sizeFilled = Helpers.sumBigInt(
			fillReceipts.map((receipt) => receipt.size)
		);

		const executionPrice = fillReceipts.reduce((acc, receipt) => {
			const orderPrice = PerpetualsOrderUtils.price(
				receipt.orderId,
				inputs.side === PerpetualsOrderSide.Ask
					? PerpetualsOrderSide.Bid
					: PerpetualsOrderSide.Ask
			);
			const orderPriceNum = Perpetuals.orderPriceToPrice({
				orderPrice,
				lotSize,
				tickSize,
			});

			return (
				acc +
				orderPriceNum * (Number(receipt.size) / Number(sizeFilled))
			);
		}, 0);

		return {
			executionPrice,
			sizeFilled: Number(sizeFilled),
			sizePosted: Number(sizePosted),
		};

		// // simulating market order
		// if (price === undefined) return executionPrice;
		// // simulating limit order
		// return (
		// 	Perpetuals.orderPriceToPrice({
		// 		orderPrice: price,
		// 		lotSize,
		// 		tickSize,
		// 	}) *
		// 		(Number(size - sizeFilled) / Number(size)) +
		// 	executionPrice * (Number(sizeFilled) / Number(size))
		// );
	};

	private createTxAndStartSession = (inputs: {
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const sessionPotatoId = this.startSessionTx({
			...inputs,
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
		const { tx, sessionPotatoId, walletAddress } = inputs;

		const account = this.endSessionTx({
			...inputs,
			tx,
			sessionPotatoId,
		});
		tx.transferObjects([account], tx.pure(walletAddress));
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
	//  Private Helpers
	// =========================================================================

	private fetchMarketOrderReceipts = async (inputs: {
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		size: bigint;
		price?: PerpetualsOrderPrice;
	}): Promise<{
		fillReceipts: PerpetualsFillReceipt[];
		postReceipt: PerpetualsPostReceipt | undefined;
	}> => {
		const { collateralCoinType, marketId, side, size, price } = inputs;

		const tx = new TransactionBlock();

		this.inspectPlaceLimitOrderTx({
			tx,
			orderbookId,
			side,
			size,
			accountId: BigInt(0),
			orderType: PerpetualsOrderType.Standard,
			price:
				price ??
				(side === PerpetualsOrderSide.Bid
					? BigInt("0x7FFFFFFFFFFFFFFF") // 2^63 - 1
					: BigInt(0)),
		});

		const sessionPotatoId = this.startSessionTx(inputs);
		this.placeLimitOrderTx({
			...inputs,
			sessionPotatoId,
		});
		this.getHotPotatoFieldsTx({
			...inputs,
			sessionPotatoId,
		});

		const allBytes =
			await this.Provider.Inspections().fetchAllBytesFromTxOutput({
				tx,
			});

		const fillReceipts: any[] = bcs.de(
			"vector<FillReceipt>",
			new Uint8Array(allBytes[0])
		);

		const postReceipt: PerpetualsPostReceipt | undefined =
			Casting.unwrapDeserializedOption(
				bcs.de("Option<PostReceipt>", new Uint8Array(allBytes[1]))
			);

		return {
			fillReceipts: fillReceipts.map((receipt) =>
				Casting.perpetuals.fillReceiptFromRaw(receipt)
			),
			postReceipt:
				postReceipt !== undefined
					? Casting.perpetuals.postReceiptFromRaw(postReceipt)
					: undefined,
		};
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
