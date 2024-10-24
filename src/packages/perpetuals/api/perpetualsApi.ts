import {
	TransactionArgument,
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { SuiEvent, Unsubscribe } from "@mysten/sui/client";
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
	Byte,
	StringByte,
	ObjectVersion,
	TransactionDigest,
	ApiDataWithCursorBody,
	BigIntAsString,
	NumberAsString,
	PackageId,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import {
	perpetualsRegistry,
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
	CollateralEvent,
	PerpetualsOrderEvent,
	PerpetualsOrderInfo,
	PerpetualsOrderPrice,
	FilledMakerOrderEvent,
	FilledTakerOrderEvent,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	ApiPerpetualsCancelOrdersBody,
	PerpetualsMarketCandleDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsAccountCap,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsLimitOrderBody,
	PerpetualsPosition,
	PerpetualsMarketData,
	PerpetualsRawAccountCap,
	PostedOrderReceiptEvent,
	ApiPerpetualsCancelOrderBody,
	PerpetualsFilledOrderData,
	ApiPerpetualsMaxOrderSizeBody,
	ApiPerpetualsAccountOrderDatasBody,
	ApiPerpetualsMarket24hrVolumeResponse,
	PerpetualsTradeHistoryWithCursor,
	PerpetualsAccountTradesWithCursor,
	PerpetualsAccountCollateralChangesWithCursor,
	ApiPerpetualsSetPositionLeverageBody,
	ApiPerpetualsAccountOrderHistoryBody,
	ApiPerpetualsAccountCollateralHistoryBody,
	ApiPerpetualsPreviewCancelOrdersBody,
	ApiPerpetualsPreviewCancelOrdersResponse,
	ApiPerpetualsPreviewReduceOrdersBody,
	ApiPerpetualsPreviewReduceOrdersResponse,
} from "../perpetualsTypes";
import { PerpetualsApiCasting } from "./perpetualsApiCasting";
import { Perpetuals } from "../perpetuals";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import {
	EventOnChain,
	SuiAddressWithout0x,
} from "../../../general/types/castingTypes";
import {
	AllocatedCollateralEventOnChain,
	CanceledOrderEventOnChain,
	DeallocatedCollateralEventOnChain,
	DepositedCollateralEventOnChain,
	FilledMakerOrderEventOnChain,
	FilledTakerOrderEventOnChain,
	LiquidatedEventOnChain,
	PerpetualsAccountPositionsIndexerResponse,
	PerpetualsMarketIndexerResponse,
	PerpetualsMarketsIndexerResponse,
	PerpetualsPreviewCancelOrdersIndexerResponse,
	PerpetualsPreviewOrderIndexerResponse,
	PerpetualsPreviewReduceOrdersIndexerResponse,
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
import { bcs } from "@mysten/sui/bcs";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";

export class PerpetualsApi implements MoveErrorsInterface {
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
		defaultLimitStepSize: 256,
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
		updatedFunding: AnyObjectType;
		updatedMarketVersion: AnyObjectType;
		filledTakerOrderLiquidator: AnyObjectType;
	};
	public readonly moveErrors: MoveErrors;

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
			liquidated: this.eventType("LiquidatedPosition"),
			filledTakerOrderLiquidator: this.eventType(
				"FilledTakerOrderLiquidator"
			),
			// Account
			createdAccount: this.eventType("CreatedAccount"),
			// Order
			canceledOrder: this.eventType("CanceledOrder"),
			postedOrder: this.eventType("PostedOrder"),
			filledMakerOrder: this.eventType("FilledMakerOrder"),
			filledTakerOrder: this.eventType("FilledTakerOrder"),
			// Order Receipts
			postedOrderReceipt: this.eventType("OrderbookPostReceipt"),
			// Twap
			updatedPremiumTwap: this.eventType("UpdatedPremiumTwap"),
			updatedSpreadTwap: this.eventType("UpdatedSpreadTwap"),
			// Funding
			updatedFunding: this.eventType("UpdatedFunding"),
			// Version
			updatedMarketVersion: this.eventType("UpdatedClearingHouseVersion"),
		};
		this.moveErrors = {
			[this.addresses.perpetuals.packages.perpetuals]: {
				// Clearing House

				// Cannot deposit/withdraw zero coins to/from the account's collateral.
				0: "Deposit Or Withdraw Amount Zero",
				// Orderbook size or price are invalid values
				1: "Invalid Size Or Price",
				// When trying to access a particular insurance fund, but it does not exist.
				2: "Invalid Insurance Fund Id",
				// Index price returned from oracle is 0 or invalid value
				3: "Bad Index Price",
				// Registry already contains the specified collateral type
				4: "Invalid Collateral Type",
				// Order value in USD is too low
				5: "Order Usd Value Too Low",
				// Wrong number of sizes passed to liquidation.
				// It must match the number of liqee's positions.
				6: "Invalid Number Of Sizes",

				// MarketManager

				// Tried to create a new market with invalid parameters.
				1000: "Invalid Market Parameters",
				// Tried to call `update_funding` before enough time has passed since the
				// last update.
				1001: "Updating Funding Too Early",
				// Margin ratio update proposal already exists for market
				1002: "Proposal Already Exists",
				// Margin ratio update proposal cannot be commited too early
				1003: "Premature Proposal",
				// Margin ratio update proposal delay is outside the valid range
				1004: "Invalid Proposal Delay",
				// Market does not exist
				1005: "Market Does Not Exist",
				// Tried to update a config with a value outside of the allowed range
				1006: "Value Out Of Range",
				// Margin ratio update proposal does not exist for market
				1007: "Proposal Does Not Exist",
				// Exchange has no available fees to withdraw
				1008: "No Fees Accrued",
				// Tried to withdraw more insurance funds than the allowed amount
				1009: "Insufficient Insurance Surplus",
				// Cannot create a market for which a price feed does not exist
				1010: "No Price Feed For Market",

				// Account Manager

				// Tried accessing a nonexistent account.
				2000: "Account Not Found",
				// Tried accessing a nonexistent account position.
				2001: "Position Not Found",
				// Tried creating a new position when the account already has the maximum
				// allowed number of open positions.
				2002: "Max Positions Exceeded",
				// An operation brought an account below initial margin requirements.
				// 2003: "Initial Margin Requirement Violated",
				2003: "Margin Requirements Violated, Try Lowering Size",
				// Account is above MMR, so can't be liquidated.
				2004: "Account Above MMR",
				// Cannot realize bad debt via means other than calling 'liquidate'.
				2005: "Account Bad Debt",
				// Cannot withdraw more than the account's free collateral.
				2006: "Insufficient Free Collateral",
				// Cannot delete a position that is not worthless
				2007: "Position Not Null",
				// Tried placing a new pending order when the position already has the maximum
				// allowed number of pending orders.
				2008: "Max Pending Orders Exceeded",
				// Used for checking both liqee and liqor positions during liquidation
				2009: "Account Below IMR",
				// When leaving liqee's account with a margin ratio above tolerance,
				// meaning that liqor has overbought position
				2010: "Account Above Tolerance",

				// Orderbook & OrderedMap

				// While searching for a key, but it doesn't exist.
				3000: "Key Does Not Exist",
				// While inserting already existing key.
				3001: "Key Already Exists",
				// When attempting to destroy a non-empty map
				3002: "Destroying Not Empty Map",
				// Invalid user tries to modify an order
				3003: "Invalid User For Order",
				// Orderbook flag requirements violated
				3004: "Flag Requirements Violated",
				// Minimum size matched not reached
				3005: "Not Enough Liquidity",
			},
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
				const accCapObj = perpetualsRegistry.Account.fromBase64(
					Casting.bcsBytesFromSuiObjectResponse(accCap)
				);
				return PerpetualsApiCasting.rawAccountCapFromRaw(
					accCapObj,
					collateralCoinType,
					Number(accCap.data?.version!),
					accCap.data?.digest!
				);
			}
		);

		return accCaps;
	};

	public fetchAccount = async (inputs: {
		accountId: PerpetualsAccountId;
		collateralCoinType: CoinType;
	}): Promise<PerpetualsAccountObject> => {
		const { accountId } = inputs;
		const response: PerpetualsAccountPositionsIndexerResponse =
			await this.Provider.indexerCaller.fetchIndexer(
				`perpetuals/accounts/${accountId}/positions`,
				undefined,
				undefined,
				undefined,
				undefined,
				true
			);
		return Casting.perpetuals.accountObjectFromIndexerResponse(
			response,
			inputs.collateralCoinType
		);
	};

	public fetchAccountOrderDatas = async (
		inputs: ApiPerpetualsAccountOrderDatasBody & {
			accountId: PerpetualsAccountId;
		}
	): Promise<PerpetualsOrderData[]> => {
		const { accountId, orderDatas } = inputs;

		const orders = await this.Provider.indexerCaller.fetchIndexer<
			{
				timestamp: Timestamp;
				tx_digest: TransactionDigest;
				ch_id: PerpetualsMarketId;
				order_id: string;
				initial_size: number;
			}[],
			{
				account_id: number;
				order_ids: string[];
			}
		>(
			`perpetuals/accounts/orders`,
			{
				account_id: Number(accountId),
				order_ids: orderDatas.map((orderData) =>
					String(orderData.orderId).replaceAll("n", "")
				),
			},
			undefined,
			undefined,
			undefined,
			true
		);
		if (orders.length !== orderDatas.length)
			throw new Error("unable to find all orders");

		return orders.map((order) => {
			const orderId = BigInt(order.order_id);
			const initialSize = BigInt(order.initial_size);

			const orderData = orderDatas.find(
				(orderData) => orderData.orderId === orderId
			);
			if (!orderData) throw new Error("unable to find all orders");

			return {
				marketId: Helpers.addLeadingZeroesToType(order.ch_id),
				side: Perpetuals.orderIdToSide(orderId),
				filledSize: initialSize - orderData.currentSize,
				initialSize,
				orderId,
			};
		});
	};

	// public fetchMarket = async (inputs: {
	// 	marketId: PerpetualsMarketId;
	// 	collateralCoinType: CoinType;
	// }): Promise<PerpetualsMarketData> => {
	// 	const { collateralCoinType } = inputs;
	// 	return this.Provider.Objects().fetchCastObject({
	// 		objectId: inputs.marketId,
	// 		objectFromSuiObjectResponse: (data) =>
	// 			Casting.perpetuals.clearingHouseFromOnChain(
	// 				data,
	// 				collateralCoinType
	// 			),
	// 	});
	// };

	// =========================================================================
	//  Events
	// =========================================================================

	public async fetchAccountCollateralHistory(
		inputs: ApiPerpetualsAccountCollateralHistoryBody & {
			accountId: PerpetualsAccountId;
		}
	): Promise<PerpetualsAccountCollateralChangesWithCursor> {
		const { accountId, cursor, limit } = inputs;

		const response = await this.Provider.indexerCaller.fetchIndexer<
			{
				timestamp: Timestamp; // u64
				tx_digest: TransactionDigest;
				ch_id: ObjectId | "";
				event_type: AnyObjectType;
				collateral_change: number; // f64
				collateral_change_usd: number; // f64
			}[],
			{
				account_id: number;
				timestamp_before_ms: Timestamp; // u64
				limit: number; // u64
			}
		>(
			`perpetuals/accounts/collateral-history`,
			{
				account_id: Number(accountId),
				timestamp_before_ms: cursor ?? new Date().valueOf(),
				limit: limit ?? PerpetualsApi.constants.defaultLimitStepSize,
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const collateralChanges = response.map((data) => ({
			eventType: data.event_type,
			timestamp: data.timestamp,
			txDigest: data.tx_digest,
			// marketId: Helpers.addLeadingZeroesToType(data.ch_id),
			collateralChange: data.collateral_change,
			collateralChangeUsd: data.collateral_change_usd,
		}));
		return {
			collateralChanges,
			// TODO: move `nextCursor` finding pattern to helper ?
			nextCursor:
				collateralChanges.length > 0
					? collateralChanges[collateralChanges.length - 1].timestamp
					: undefined,
		};
	}

	public async fetchAccountOrderHistory(
		inputs: ApiPerpetualsAccountOrderHistoryBody & {
			accountId: PerpetualsAccountId;
		}
	): Promise<PerpetualsAccountTradesWithCursor> {
		const { accountId, cursor, limit } = inputs;

		const response = await this.Provider.indexerCaller.fetchIndexer<
			{
				timestamp: Timestamp;
				tx_digest: TransactionDigest;
				ch_id: ObjectId;
				event_type: AnyObjectType;
				is_ask: boolean;
				// size: NumberAsString | BigIntAsString;
				// price: NumberAsString | BigIntAsString;
				size: NumberAsString;
				price: NumberAsString;
			}[],
			{
				account_id: number;
				timestamp_before_ms: Timestamp; // u64
				limit: number; // u64
			}
		>(
			`perpetuals/accounts/trade-history`,
			{
				account_id: Number(accountId),
				timestamp_before_ms: cursor ?? new Date().valueOf(),
				limit: limit ?? PerpetualsApi.constants.defaultLimitStepSize,
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const trades = response.map((data) => ({
			eventType: data.event_type,
			timestamp: data.timestamp,
			txDigest: data.tx_digest,
			marketId: Helpers.addLeadingZeroesToType(data.ch_id),
			side: data.is_ask
				? PerpetualsOrderSide.Ask
				: PerpetualsOrderSide.Bid,
			size: Number(data.size),
			price: Number(data.price),
		}));
		return {
			trades,
			// TODO: move `nextCursor` finding pattern to helper ?
			nextCursor:
				trades.length > 0
					? trades[trades.length - 1].timestamp
					: undefined,
		};
	}

	public async fetchMarketTradeHistory(
		inputs: ApiDataWithCursorBody<Timestamp> & {
			marketId: PerpetualsMarketId;
		}
	): Promise<PerpetualsTradeHistoryWithCursor> {
		const { marketId, cursor, limit } = inputs;
		const response = await this.Provider.indexerCaller.fetchIndexer<
			{
				timestamp: Timestamp; // u64
				tx_digest: TransactionDigest;
				is_ask: boolean;
				size_filled: number; // f64
				order_price: number; // f64
			}[],
			{
				ch_id: ObjectId;
				timestamp_before_ms: Timestamp; // u64
				limit: number; // u64
			}
		>(
			`perpetuals/markets/trade-history`,
			{
				ch_id: Helpers.addLeadingZeroesToType(marketId),
				timestamp_before_ms: cursor ?? new Date().valueOf(),
				limit: limit ?? PerpetualsApi.constants.defaultLimitStepSize,
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const trades = response.map((data) => ({
			timestamp: data.timestamp,
			txDigest: data.tx_digest,
			side: data.is_ask
				? PerpetualsOrderSide.Ask
				: PerpetualsOrderSide.Bid,
			sizeFilled: data.size_filled,
			orderPrice: data.order_price,
		}));
		return {
			trades,
			nextCursor:
				trades.length > 0
					? trades[trades.length - 1].timestamp
					: undefined,
		};
	}

	// =========================================================================
	//  Indexer Data
	// =========================================================================

	public async fetchMarket24hrVolume(inputs: {
		marketId: PerpetualsMarketId;
	}): Promise<ApiPerpetualsMarket24hrVolumeResponse> {
		const { marketId } = inputs;

		const response = await this.Provider.indexerCaller.fetchIndexer<{
			market_volume: number; // f64
			market_volume_usd: number; // f64
		}>(
			`perpetuals/markets/${marketId}/24hr-volume`,
			undefined,
			undefined,
			undefined,
			undefined,
			true
		);

		return {
			volumeBaseAssetAmount: response.market_volume,
			volumeUsd: response.market_volume_usd,
		};
	}

	public fetchHistoricalMarketData = async (inputs: {
		marketId: PerpetualsMarketId;
		fromTimestamp: Timestamp;
		toTimestamp: Timestamp;
		intervalMs: number;
	}): Promise<ApiPerpetualsHistoricalMarketDataResponse> => {
		const { marketId, fromTimestamp, toTimestamp, intervalMs } = inputs;

		const response = await this.Provider.indexerCaller.fetchIndexer<
			{
				timestamp_ms: number; // u64,
				open: number; // f64,
				close: number; // f64,
				high: number; // f64,
				low: number; // f64,
				volume: number; // f64,
			}[],
			{
				ch_id: string;
				timestamp_ms_from: Timestamp; // u64,
				timestamp_ms_to: Timestamp; // u64,
				resolution_ms: number; // u64,
			}
		>(
			`perpetuals/markets/candle-history`,
			{
				ch_id: Helpers.addLeadingZeroesToType(marketId),
				timestamp_ms_from: fromTimestamp,
				timestamp_ms_to: toTimestamp,
				resolution_ms: intervalMs,
			},
			undefined,
			undefined,
			undefined,
			true
		);

		return response.map((data) => ({
			time: data.timestamp_ms,
			open: data.open,
			close: data.close,
			high: data.high,
			low: data.low,
			volume: data.volume,
		}));
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

	public setPositionLeverage = async (
		inputs: ApiPerpetualsSetPositionLeverageBody
	): Promise<boolean> => {
		return this.Provider.indexerCaller.fetchIndexer<
			boolean,
			{
				wallet_address: string;
				signature: string;
				bytes: string;
			}
		>(
			`perpetuals/account/set-position-leverage`,
			{
				wallet_address: Helpers.addLeadingZeroesToType(
					inputs.walletAddress
				),
				signature: inputs.signature,
				bytes: inputs.bytes,
			},
			undefined,
			undefined,
			undefined,
			true
		);
	};

	public fetchAllPositionLeverages = async (inputs: {
		accountId: PerpetualsAccountId;
	}): Promise<
		{
			marketId: PerpetualsMarketId;
			leverage: number;
		}[]
	> => {
		return (
			await this.Provider.indexerCaller.fetchIndexer<
				{
					market_id: PerpetualsMarketId;
					leverage: number;
				}[]
			>(
				`perpetuals/accounts/${inputs.accountId}/position-leverages`,
				undefined,
				undefined,
				undefined,
				undefined,
				true
			)
		).map((data) => ({
			marketId: data.market_id,
			leverage: data.leverage,
		}));
	};

	public fetchPositionLeverages = async (inputs: {
		accountId: PerpetualsAccountId;
		marketIds: PerpetualsMarketId[];
	}): Promise<number[]> => {
		const marketIds = inputs.marketIds.map((objectId) =>
			Helpers.addLeadingZeroesToType(objectId)
		);
		const leverages = await this.Provider.indexerCaller.fetchIndexer<
			{
				market_id: PerpetualsMarketId;
				leverage: number;
			}[]
		>(
			`perpetuals/accounts/${inputs.accountId}/position-leverages`,
			undefined,
			{
				market_ids: marketIds,
			},
			undefined,
			undefined,
			true
		);
		return marketIds.map(
			(objectId) =>
				(
					leverages.find(
						(leverage) => leverage.market_id === objectId
					) ?? {
						leverage: 1,
					}
				).leverage
		);
	};

	public fetchPreviewOrder = async (
		inputs: ApiPerpetualsPreviewOrderBody
	): Promise<ApiPerpetualsPreviewOrderResponse> => {
		const { marketId, side, leverage, accountId } = inputs;

		const response = await this.Provider.indexerCaller.fetchIndexer<
			PerpetualsPreviewOrderIndexerResponse,
			{
				ch_id: PerpetualsMarketId;
				account_id: number;
				side: boolean;
				size: number;
				leverage: number;
			} & (
				| {
						// limit order
						price: number;
						order_type: number;
				  }
				| {
						// market order
				  }
			)
		>(
			`perpetuals/previews/${
				"price" in inputs ? "limit" : "market"
			}-order`,
			{
				leverage,
				ch_id: marketId,
				account_id: Number(accountId),
				side: Boolean(side),
				size: Number(inputs.size),
				...("price" in inputs
					? {
							// limit order
							price: Number(inputs.price),
							order_type: inputs.orderType,
					  }
					: {
							// market order
					  }),
			},
			undefined,
			undefined,
			undefined,
			true
		);
		if ("error" in response) return response;

		const executionPrice = Casting.IFixed.numberFromIFixed(
			Casting.IFixed.iFixedFromStringBytes(response.execution_price)
		);
		const filledSize = Casting.IFixed.numberFromIFixed(
			Casting.IFixed.iFixedFromStringBytes(response.size_filled)
		);
		const filledSizeUsd = filledSize * executionPrice;
		const postedSize = response.size_posted
			? Casting.IFixed.numberFromIFixed(
					Casting.IFixed.iFixedFromStringBytes(response.size_posted)
			  )
			: 0;
		const postedSizeUsd =
			"price" in inputs
				? // limit order
				  postedSize *
				  Perpetuals.orderPriceToPrice({
						orderPrice: inputs.price,
						lotSize: inputs.lotSize,
						tickSize: inputs.tickSize,
				  })
				: // market order
				  0;

		const positionAfterOrder =
			Casting.perpetuals.positionFromIndexerReponse({
				position: response.position,
				collateralCoinType: inputs.collateralCoinType,
				marketId: inputs.marketId,
				leverage,
			});

		return {
			postedSize,
			postedSizeUsd,
			filledSize,
			filledSizeUsd,
			// NOTE: is this not needed ?
			executionPrice,
			positionAfterOrder,
			priceSlippage: Casting.IFixed.numberFromIFixed(
				Casting.IFixed.iFixedFromStringBytes(response.price_slippage)
			),
			percentSlippage: Casting.IFixed.numberFromIFixed(
				Casting.IFixed.iFixedFromStringBytes(response.percent_slippage)
			),
			collateralChange: Casting.IFixed.numberFromIFixed(
				Casting.IFixed.iFixedFromStringBytes(response.collateral_change)
			),
		};
	};

	public fetchPreviewCancelOrders = async (
		inputs: ApiPerpetualsPreviewCancelOrdersBody
	): Promise<ApiPerpetualsPreviewCancelOrdersResponse> => {
		const { accountId, collateralCoinType, marketIdsToData } = inputs;

		const responses = await Promise.all(
			Object.entries(marketIdsToData).map(
				async ([marketId, { leverage, orderIds }]) => {
					const response =
						await this.Provider.indexerCaller.fetchIndexer<
							PerpetualsPreviewCancelOrdersIndexerResponse,
							{
								ch_id: PerpetualsMarketId;
								account_id: number;
								leverage: number;
								order_ids: string[];
							}
						>(
							`perpetuals/previews/cancel-orders`,
							{
								leverage,
								ch_id: marketId,
								account_id: Number(accountId),
								order_ids: orderIds.map((orderId) =>
									orderId.toString().replaceAll("n", "")
								),
							},
							undefined,
							undefined,
							undefined,
							true
						);
					if ("error" in response) return response;

					const positionAfterCancelOrders =
						Casting.perpetuals.positionFromIndexerReponse({
							marketId,
							leverage,
							collateralCoinType,
							position: response.position,
						});
					return {
						marketId,
						positionAfterCancelOrders,
						collateralChange: Casting.IFixed.numberFromIFixed(
							Casting.IFixed.iFixedFromStringBytes(
								response.collateral_change
							)
						),
					};
				}
			)
		);
		const errorResponse = responses.find((response) => "error" in response);
		if (errorResponse && "error" in errorResponse) return errorResponse;

		return responses.reduce(
			(acc, response) => {
				if ("error" in response) return acc;

				const {
					marketId,
					positionAfterCancelOrders,
					collateralChange,
				} = response;
				return {
					marketIdsToPositionAfterCancelOrders: {
						...acc.marketIdsToPositionAfterCancelOrders,
						[marketId]: positionAfterCancelOrders,
					},
					collateralChange: acc.collateralChange + collateralChange,
				};
			},
			{
				marketIdsToPositionAfterCancelOrders: {},
				collateralChange: 0,
			}
		);
	};

	public fetchPreviewReduceOrders = async (
		inputs: ApiPerpetualsPreviewReduceOrdersBody
	): Promise<ApiPerpetualsPreviewReduceOrdersResponse> => {
		const {
			accountId,
			leverage,
			marketId,
			orderIds,
			sizesToSubtract,
			collateralCoinType,
		} = inputs;

		const response = await this.Provider.indexerCaller.fetchIndexer<
			PerpetualsPreviewReduceOrdersIndexerResponse,
			{
				ch_id: PerpetualsMarketId;
				account_id: number;
				leverage: number;
				order_ids: string[];
				sizes_to_sub: number[]; // Vec<u64>
			}
		>(
			`perpetuals/previews/reduce-orders`,
			{
				leverage,
				ch_id: marketId,
				account_id: Number(accountId),
				order_ids: orderIds.map((orderId) =>
					orderId.toString().replaceAll("n", "")
				),
				sizes_to_sub: sizesToSubtract.map((size) => Number(size)),
			},
			undefined,
			undefined,
			undefined,
			true
		);
		if ("error" in response) return response;

		const positionAfterReduceOrders =
			Casting.perpetuals.positionFromIndexerReponse({
				marketId,
				leverage,
				collateralCoinType,
				position: response.position,
			});
		return {
			positionAfterReduceOrders,
			collateralChange: Casting.IFixed.numberFromIFixed(
				Casting.IFixed.iFixedFromStringBytes(response.collateral_change)
			),
		};
	};

	// public fetchOrderbookPrice = async (inputs: {
	// 	collateralCoinType: ObjectId;
	// 	marketId: PerpetualsMarketId;
	// 	// marketInitialSharedVersion: ObjectVersion;
	// }): Promise<number> => {
	// 	const {
	// 		collateralCoinType,
	// 		marketId,
	// 		// marketInitialSharedVersion
	// 	} = inputs;

	// 	const tx = new Transaction();

	// 	this.getBookPriceTx({
	// 		tx,
	// 		marketId,
	// 		collateralCoinType,
	// 		// marketInitialSharedVersion,
	// 	});

	// 	const bytes =
	// 		await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
	// 			tx,
	// 		});

	// 	return PerpetualsApiCasting.orderbookPriceFromBytes(bytes);
	// };

	public fetchAllMarkets = async (inputs: {
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarketData[]> => {
		const { collateralCoinType } = inputs;

		const response =
			await this.Provider.indexerCaller.fetchIndexer<PerpetualsMarketsIndexerResponse>(
				`perpetuals/markets/${Helpers.stripLeadingZeroesFromType(
					collateralCoinType
				)}`,
				undefined,
				undefined,
				undefined,
				undefined,
				true
			);
		const markets = Object.values(response);
		return markets.map((market) =>
			Casting.perpetuals.marketDataFromIndexerResponse(
				market[0],
				Helpers.addLeadingZeroesToType(collateralCoinType),
				market[1]
			)
		);
	};

	public fetchMarketWithOrderbook = async (inputs: {
		marketId: PerpetualsMarketId;
		collateralCoinType: CoinType;
	}): Promise<{
		market: PerpetualsMarketData;
		orderbook: PerpetualsOrderbook;
	}> => {
		const { marketId, collateralCoinType } = inputs;

		const response =
			await this.Provider.indexerCaller.fetchIndexer<PerpetualsMarketIndexerResponse>(
				`perpetuals/market/${marketId}`,
				undefined,
				undefined,
				undefined,
				undefined,
				true
			);
		const market = Casting.perpetuals.marketDataFromIndexerResponse(
			response.ch[0],
			Helpers.addLeadingZeroesToType(collateralCoinType),
			response.ch[1]
		);
		return {
			market,
			orderbook: Casting.perpetuals.orderbookFromIndexerResponse(
				response.orderbook,
				market.marketParams.lotSize,
				market.marketParams.tickSize
			),
		};
	};

	// public fetchAllMarketIds = async (inputs: {
	// 	collateralCoinType: CoinType;
	// }): Promise<PerpetualsMarketId[]> => {
	// 	const { collateralCoinType } = inputs;
	// 	const marketIdsData = await this.Provider.indexerCaller.fetchIndexer<
	// 		{
	// 			marketId: ObjectId;
	// 		}[]
	// 	>(
	// 		`perpetuals/markets/${Helpers.addLeadingZeroesToType(
	// 			collateralCoinType
	// 		)}`
	// 	);
	// 	return marketIdsData.map((data) =>
	// 		Helpers.addLeadingZeroesToType(data.marketId)
	// 	);
	// };

	public fetchMaxOrderSize = async (
		inputs: ApiPerpetualsMaxOrderSizeBody & {
			marketId: PerpetualsMarketId;
		}
	): Promise<bigint> => {
		const { marketId, accountId, collateral, side, price, leverage } =
			inputs;
		const maxSize = await this.Provider.indexerCaller.fetchIndexer<
			number,
			{
				ch_id: PerpetualsMarketId;
				account_id: number;
				collateral_to_allocate: number;
				side: boolean;
				leverage: number;
				price?: number;
			}
		>(
			`perpetuals/calculations/${
				inputs.price !== undefined ? "limit" : "market"
			}-order-max-size`,
			{
				leverage,
				ch_id: marketId,
				account_id: Number(accountId),
				collateral_to_allocate: Number(collateral),
				side: Boolean(side),
				...(price !== undefined ? { price: Number(price) } : {}),
			},
			undefined,
			undefined,
			undefined,
			true
		);
		return BigInt(Math.floor(maxSize));
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public depositCollateralTx = (
		inputs: {
			tx: Transaction;
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
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		amount: Balance;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, amount } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"allocate_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.pure.u64(amount),
			],
		});
	};

	public deallocateCollateralTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		accountCapId: ObjectId;
		basePriceFeedId: ObjectId;
		collateralPriceFeedId: ObjectId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		amount: Balance;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, amount } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"deallocate_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				tx.object(accountCapId),
				tx.object(inputs.basePriceFeedId),
				tx.object(inputs.collateralPriceFeedId),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure.u64(amount),
			],
		});
	};

	public createMarketPositionTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market_position"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
			],
		});
	};

	public shareClearingHouseTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId | TransactionArgument;
	}) => {
		const { tx, collateralCoinType, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"share_clearing_house"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof marketId === "string" ? tx.object(marketId) : marketId,
			],
		});
	};

	public startSessionTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		basePriceFeedId: ObjectId;
		collateralPriceFeedId: ObjectId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
	}) /* SessionHotPotato<T> */ => {
		const { tx, collateralCoinType, accountCapId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"start_session"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(inputs.basePriceFeedId),
				tx.object(inputs.collateralPriceFeedId),
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public endSessionTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
	}) /* ClearingHouse<T> */ => {
		const { tx, collateralCoinType, sessionPotatoId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"end_session"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
			],
		});
	};

	public placeMarketOrderTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
		size: bigint;
	}) => {
		const { tx, collateralCoinType, sessionPotatoId, side, size } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"place_market_order"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
				tx.pure.bool(Boolean(side)),
				tx.pure.u64(size),
			],
		});
	};

	public placeLimitOrderTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
		size: bigint;
		price: bigint;
		orderType: PerpetualsOrderType;
	}) => {
		const {
			tx,
			collateralCoinType,
			sessionPotatoId,
			side,
			size,
			price,
			orderType,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"place_limit_order"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
				tx.pure.bool(Boolean(side)),
				tx.pure.u64(size),
				tx.pure.u64(price),
				tx.pure.u64(BigInt(orderType)),
			],
		});
	};

	public cancelOrdersTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		accountCapId: ObjectId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		orderIds: PerpetualsOrderId[];
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, orderIds } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.interface,
				"cancel_orders"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				tx.object(accountCapId),
				tx.pure(bcs.vector(bcs.u128()).serialize(orderIds)),
			],
		});
	};

	public withdrawCollateralTx = (inputs: {
		tx: Transaction;
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
				tx.pure.u64(amount),
			],
		});
	};

	public createAccountTx = (inputs: {
		tx: Transaction;
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

	// public getHotPotatoFieldsTx = (
	// 	inputs: {
	// 		tx: Transaction;
	// 		collateralCoinType: CoinType;
	// 		sessionPotatoId: ObjectId | TransactionArgument;
	// 	}
	// 	/*
	// 		(
	// 			lot_size,
	// 			tick_size,
	// 			timestamp_ms,
	// 			collateral_price,
	// 			index_price,
	// 			book_price,
	// 			fills,
	// 			post
	// 		): (
	// 			u64,
	// 			u64,
	// 			u64,
	// 			u64,
	// 			u256,
	// 			u256,
	// 			u256,
	// 			&vector<FillReceipt>,
	// 			&PostReceipt
	// 		)
	// 	*/
	// ) => {
	// 	const { tx, collateralCoinType, sessionPotatoId } = inputs;
	// 	return tx.moveCall({
	// 		target: Helpers.transactions.createTxTarget(
	// 			inputs.packageId,
	// 			PerpetualsApi.constants.moduleNames.clearingHouse,
	// 			"get_hot_potato_fields"
	// 		),
	// 		typeArguments: [collateralCoinType],
	// 		arguments: [
	// 			typeof sessionPotatoId === "string"
	// 				? tx.object(sessionPotatoId)
	// 				: sessionPotatoId,
	// 		],
	// 	});
	// };

	public placeSLTPOrderTx = (
		inputs: ApiPerpetualsSLTPOrderBody & {
			tx: Transaction;
			sessionPotatoId: TransactionObjectArgument;
		}
	) => {
		throw new Error("TODO");

		// const { tx } = inputs;

		// if ("price" in inputs) {
		// 	this.placeLimitOrderTx({ ...inputs, tx });
		// } else {
		// 	this.placeMarketOrderTx({ ...inputs, tx });
		// }

		// const orderType = PerpetualsOrderType.PostOnly;
		// const side =
		// 	inputs.side === PerpetualsOrderSide.Ask
		// 		? PerpetualsOrderSide.Bid
		// 		: PerpetualsOrderSide.Ask;

		// const orderPrice =
		// 	"price" in inputs ? inputs.price : inputs.marketPrice;

		// if (
		// 	"slPrice" in inputs &&
		// 	((inputs.side === PerpetualsOrderSide.Ask &&
		// 		inputs.slPrice > orderPrice) ||
		// 		(inputs.side === PerpetualsOrderSide.Bid &&
		// 			inputs.slPrice < orderPrice))
		// ) {
		// 	this.placeLimitOrderTx({
		// 		...inputs,
		// 		tx,
		// 		orderType,
		// 		side,
		// 		price: inputs.slPrice,
		// 	});
		// }

		// if (
		// 	"tpPrice" in inputs &&
		// 	((inputs.side === PerpetualsOrderSide.Ask &&
		// 		inputs.tpPrice < orderPrice) ||
		// 		(inputs.side === PerpetualsOrderSide.Bid &&
		// 			inputs.tpPrice > orderPrice))
		// ) {
		// 	this.placeLimitOrderTx({
		// 		...inputs,
		// 		tx,
		// 		orderType,
		// 		side,
		// 		price: inputs.tpPrice,
		// 	});
		// }
	};

	public getPositionTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		accountId: PerpetualsAccountId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
	}) /* Position */ => {
		const { tx, marketId, collateralCoinType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_position"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: false,
				}),
				tx.pure.u64(inputs.accountId),
			],
		});
	};

	public getOrderbookTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}) /* Orderbook */ => {
		const { tx, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_orderbook"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(inputs.marketId)],
		});
	};

	public getBookPriceTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		marketId: PerpetualsMarketId;
		// marketInitialSharedVersion: ObjectVersion;
		collateralCoinType: CoinType;
	}) /* Option<u256> */ => {
		const { tx, marketId, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_book_price"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				// tx.sharedObjectRef({
				// 	objectId: marketId,
				// 	initialSharedVersion: inputs.marketInitialSharedVersion,
				// 	mutable: false,
				// }),
			],
		});
	};

	public getBestPriceTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		side: PerpetualsOrderSide;
		collateralCoinType: CoinType;
	}) /* Option<u256> */ => {
		const { tx, marketId, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_best_price"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: false,
				}), // ClearingHouse
				tx.pure.bool(Boolean(inputs.side)), // side
			],
		});
	};

	public inspectOrdersTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		orderbookId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
		fromPrice: IFixed;
		toPrice: IFixed;
	}) /* vector<OrderInfo> */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.orderbook,
				"inspect_orders"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook
				tx.pure.bool(Boolean(inputs.side)), // side
				tx.pure.u64(inputs.fromPrice), // price_from
				tx.pure.u64(inputs.toPrice), // price_to
			],
		});
	};

	public getOrderSizeTx = (inputs: {
		tx: Transaction;
		packageId: PackageId;
		orderbookId: ObjectId | TransactionArgument;
		orderId: PerpetualsOrderId;
	}) /* u64 */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				inputs.packageId,
				PerpetualsApi.constants.moduleNames.orderbook,
				"get_order_size"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook
				tx.pure.u128(inputs.orderId), // order_id
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildDepositCollateralTx = async (
		inputs: ApiPerpetualsDepositCollateralBody
	): Promise<Transaction> => {
		const tx = new Transaction();
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

	public fetchBuildPlaceMarketOrderTx = async (
		inputs: ApiPerpetualsMarketOrderBody
	): Promise<Transaction> => {
		const {
			walletAddress,
			marketId,
			accountObjectId,
			accountObjectVersion,
			accountObjectDigest,
			side,
			size,
			collateralChange,
			hasPosition,
		} = inputs;

		const { ptb: txKind } = await this.Provider.indexerCaller.fetchIndexer<
			{
				ptb: StringByte[];
			},
			{
				ch_id: PerpetualsMarketId;
				account_obj_id: ObjectId;
				account_obj_version: number;
				account_obj_digest: ObjectId;
				side: boolean;
				size: number;
				collateral_to_allocate: number; // Balance
				collateral_to_deallocate: number; // Balance
				position_found: boolean;
			}
		>(
			`perpetuals/transactions/market-order`,
			{
				ch_id: marketId,
				account_obj_id: accountObjectId,
				account_obj_version: accountObjectVersion,
				account_obj_digest: accountObjectDigest,
				side: Boolean(side),
				size: Number(size),
				collateral_to_allocate:
					collateralChange > BigInt(0) ? Number(collateralChange) : 0,
				collateral_to_deallocate:
					collateralChange < BigInt(0)
						? Math.abs(Number(collateralChange))
						: 0,
				position_found: hasPosition,
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const tx = Transaction.fromKind(
			new Uint8Array(txKind.map((byte) => Number(byte)))
		);
		tx.setSender(walletAddress);

		return tx;

		// const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);
		// this.placeMarketOrderTx({
		// 	...inputs,
		// 	tx,
		// 	sessionPotatoId,
		// });
		// this.endSessionAndShareMarket({
		// 	...inputs,
		// 	tx,
		// 	sessionPotatoId,
		// });
		// if (inputs.collateralChange < BigInt(0)) {
		// 	this.deallocateCollateralTx({
		// 		...inputs,
		// 		tx,
		// 		amount: Helpers.absBigInt(inputs.collateralChange),
		// 	});
		// }
		// return tx;
	};

	public fetchBuildPlaceLimitOrderTx = async (
		inputs: ApiPerpetualsLimitOrderBody
	) => {
		const {
			walletAddress,
			marketId,
			accountObjectId,
			accountObjectVersion,
			accountObjectDigest,
			side,
			size,
			orderType,
			price,
			collateralChange,
			hasPosition,
		} = inputs;

		const { ptb: txKind } = await this.Provider.indexerCaller.fetchIndexer<
			{
				ptb: StringByte[];
			},
			{
				ch_id: PerpetualsMarketId;
				account_obj_id: ObjectId;
				account_obj_version: number;
				account_obj_digest: ObjectId;
				side: boolean;
				size: number;
				price: number; // iFixed
				order_type: number;
				collateral_to_allocate: number; // Balance
				collateral_to_deallocate: number; // Balance
				position_found: boolean;
			}
		>(
			`perpetuals/transactions/limit-order`,
			{
				ch_id: marketId,
				account_obj_id: accountObjectId,
				account_obj_version: accountObjectVersion,
				account_obj_digest: accountObjectDigest,
				side: Boolean(side),
				size: Number(size),
				price: Number(price),
				order_type: orderType,
				collateral_to_allocate:
					collateralChange > BigInt(0) ? Number(collateralChange) : 0,
				collateral_to_deallocate:
					collateralChange < BigInt(0)
						? Math.abs(Number(collateralChange))
						: 0,
				position_found: hasPosition,
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const tx = Transaction.fromKind(
			new Uint8Array(txKind.map((byte) => Number(byte)))
		);
		tx.setSender(walletAddress);

		return tx;

		// const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);
		// // TODO: handle (de)allocations everywhere
		// this.placeLimitOrderTx({
		// 	...inputs,
		// 	tx,
		// 	sessionPotatoId,
		// });
		// this.endSessionAndShareMarket({
		// 	...inputs,
		// 	tx,
		// 	sessionPotatoId,
		// });
		// if (inputs.collateralChange < BigInt(0)) {
		// 	this.deallocateCollateralTx({
		// 		...inputs,
		// 		tx,
		// 		amount: Helpers.absBigInt(inputs.collateralChange),
		// 	});
		// }
		// return tx;
	};

	public buildCancelOrderTx = (
		inputs: ApiPerpetualsCancelOrderBody
	): Transaction => {
		const {
			packageId,
			orderId,
			marketId,
			marketInitialSharedVersion,
			collateralChange,
			basePriceFeedId,
			collateralPriceFeedId,
			...otherInputs
		} = inputs;

		return this.buildCancelOrdersTx({
			...otherInputs,
			orderDatas: [
				{
					packageId,
					orderId,
					marketId,
					marketInitialSharedVersion,
					collateralChange,
					basePriceFeedId,
					collateralPriceFeedId,
				},
			],
		});
	};

	public buildCancelOrdersTx = (
		inputs: ApiPerpetualsCancelOrdersBody
	): Transaction => {
		const { orderDatas, collateralCoinType, accountCapId } = inputs;

		if (orderDatas.length <= 0)
			throw new Error("cannot have order datas of length zero");

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const marketIdToOrderIds = orderDatas.reduce(
			(acc, order) => {
				if (order.marketId in acc) {
					return {
						...acc,
						[order.marketId]: [...acc[order.marketId], order],
					};
				}
				return {
					...acc,
					[order.marketId]: [order],
				};
			},
			{} as Record<
				PerpetualsMarketId,
				{
					packageId: PackageId;
					orderId: PerpetualsOrderId;
					marketId: PerpetualsMarketId;
					marketInitialSharedVersion: ObjectVersion;
					collateralChange: Balance;
					basePriceFeedId: ObjectId;
					collateralPriceFeedId: ObjectId;
				}[]
			>
		);

		for (const [marketId, orders] of Object.entries(marketIdToOrderIds)) {
			if (orders.length <= 0) continue;

			const marketInitialSharedVersion =
				orders[0].marketInitialSharedVersion;
			const packageId = orders[0].packageId;

			this.cancelOrdersTx({
				tx,
				collateralCoinType,
				accountCapId,
				marketId,
				marketInitialSharedVersion,
				packageId,
				orderIds: orders.map((order) => order.orderId),
			});

			const netCollateralChange = Helpers.sumBigInt(
				orders.map((order) => order.collateralChange)
			);
			if (netCollateralChange < BigInt(0)) {
				this.deallocateCollateralTx({
					tx,
					accountCapId,
					collateralCoinType,
					marketId,
					marketInitialSharedVersion,
					packageId,
					amount: Helpers.absBigInt(netCollateralChange),
					basePriceFeedId: orders[0].basePriceFeedId,
					collateralPriceFeedId: orders[0].collateralPriceFeedId,
				});
			} else if (netCollateralChange > BigInt(0)) {
				this.allocateCollateralTx({
					tx,
					accountCapId,
					collateralCoinType,
					marketId,
					marketInitialSharedVersion,
					packageId,
					amount: netCollateralChange,
				});
			} else {
				// no collateral change
			}
		}

		return tx;
	};

	public buildWithdrawCollateralTx = (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): Transaction => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const coin = this.withdrawCollateralTx({
			tx,
			...inputs,
		});

		tx.transferObjects([coin], inputs.walletAddress);

		return tx;
	};

	public buildCreateAccountTx = (
		inputs: ApiPerpetualsCreateAccountBody
	): Transaction => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const accountCap = this.createAccountTx({
			tx,
			...inputs,
		});
		tx.transferObjects([accountCap], inputs.walletAddress);

		return tx;
	};

	public fetchBuildPlaceSLTPOrderTx = (
		inputs: ApiPerpetualsSLTPOrderBody
	): Promise<Transaction> => {
		throw new Error("TODO");

		// const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);

		// this.placeSLTPOrderTx({
		// 	...inputs,
		// 	tx,
		// 	sessionPotatoId,
		// });

		// return tx;
	};

	public buildTransferCollateralTx = (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		fromAccountCapId: ObjectId | TransactionArgument;
		toAccountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): Transaction => {
		const {
			walletAddress,
			collateralCoinType,
			fromAccountCapId,
			toAccountCapId,
			amount,
		} = inputs;

		const tx = new Transaction();
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
		return `${this.addresses.perpetuals.packages.events}::${PerpetualsApi.constants.moduleNames.account}::Account<${inputs.collateralCoinType}>`;
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	// private fetchOrdersSizes = async (inputs: {
	// 	orderIds: PerpetualsOrderId[];
	// 	collateralCoinType: ObjectId;
	// 	marketId: PerpetualsMarketId;
	// }): Promise<bigint[]> => {
	// 	const { orderIds, marketId, collateralCoinType } = inputs;
	// 	if (orderIds.length <= 0) return [];

	// 	const tx = new Transaction();

	// 	const orderbookId = this.getOrderbookTx({
	// 		tx,
	// 		collateralCoinType,
	// 		marketId,
	// 	});

	// 	for (const orderId of orderIds) {
	// 		this.getOrderSizeTx({
	// 			tx,
	// 			orderId,
	// 			orderbookId,
	// 		});
	// 	}

	// 	const { allBytes } =
	// 		await this.Provider.Inspections().fetchAllBytesFromTx({
	// 			tx,
	// 		});

	// 	const sizes = allBytes
	// 		.slice(1)
	// 		.map((bytes) => Casting.bigIntFromBytes(bytes[0]));
	// 	return sizes;
	// };

	// private fetchOrderbookOrders = async (inputs: {
	// 	collateralCoinType: ObjectId;
	// 	marketId: PerpetualsMarketId;
	// 	side: PerpetualsOrderSide;
	// 	fromPrice: PerpetualsOrderPrice;
	// 	toPrice: PerpetualsOrderPrice;
	// }): Promise<PerpetualsOrderInfo[]> => {
	// 	const { collateralCoinType, marketId, side, fromPrice, toPrice } =
	// 		inputs;

	// 	const tx = new Transaction();

	// 	const orderbookId = this.getOrderbookTx({
	// 		tx,
	// 		collateralCoinType,
	// 		marketId,
	// 	});
	// 	this.inspectOrdersTx({ tx, orderbookId, side, fromPrice, toPrice });

	// 	const bytes =
	// 		await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
	// 			tx,
	// 		});

	// 	const orderInfos: any[] = bcs
	// 		.vector(perpetualsRegistry.OrderInfo)
	// 		.parse(new Uint8Array(bytes));

	// 	return orderInfos.map((orderInfo) =>
	// 		Casting.perpetuals.orderInfoFromRaw(orderInfo)
	// 	);
	// };

	// public fetchExecutionPrice = async (
	// 	inputs: ApiPerpetualsExecutionPriceBody & {
	// 		collateralCoinType: CoinType;
	// 		marketId: PerpetualsMarketId;
	// 	}
	// ): Promise<ApiPerpetualsExecutionPriceResponse> => {
	// 	const {
	// 		// collateral,
	// 		collateralCoinType,
	// 		marketId,
	// 		side,
	// 		size,
	// 		price,
	// 		lotSize,
	// 		basePriceFeedId,
	// 		collateralPriceFeedId,
	// 	} = inputs;
	// 	// TODO: change this
	// 	const collateral = BigInt(1000000000000000);

	// 	// const accountCapId = perpetualsBcsRegistry
	// 	// 	.ser(`Account<${collateralCoinType}>`, {
	// 	// 		id: {
	// 	// 			id: {
	// 	// 				bytes: "0x0000000000000000000000000000000000000000000000000000000000000321",
	// 	// 			},
	// 	// 		},
	// 	// 		accountId: 0,
	// 	// 		collateral,
	// 	// 	})
	// 	// 	.toBytes();

	// const depositCoinBytes = perpetualsRegistry.Coin.serialize({
	// 	id: "0x0000000000000000000000000000000000000000000000000000000000000123",
	// 	balance: {
	// 		value: BigInt(1000000000000000),
	// 	},
	// }).toBytes();

	// 	const walletAddress = InspectionsApiHelpers.constants.devInspectSigner;

	// 	const tx = new Transaction();
	// 	tx.setSender(walletAddress);

	// 	const accountCapId = this.createAccountTx({
	// 		...inputs,
	// 		tx,
	// 	});
	// 	this.depositCollateralTx({
	// 		tx,
	// 		collateralCoinType,
	// 		accountCapId,
	// 		coinBytes: depositCoinBytes,
	// 	});
	// 	const { sessionPotatoId } = this.createTxAndStartSession({
	// 		tx,
	// 		accountCapId,
	// 		collateralCoinType,
	// 		marketId,
	// 		walletAddress,
	// 		basePriceFeedId,
	// 		collateralPriceFeedId,
	// 		collateralChange: collateral,
	// 		hasPosition: false,
	// 	});
	// 	this.placeLimitOrderTx({
	// 		tx,
	// 		side,
	// 		size,
	// 		collateralCoinType,
	// 		sessionPotatoId,
	// 		orderType: PerpetualsOrderType.Standard,
	// 		price:
	// 			price ??
	// 			(side === PerpetualsOrderSide.Bid
	// 				? BigInt("0x7FFFFFFFFFFFFFFF") // 2^63 - 1
	// 				: BigInt(1)),
	// 	});
	// 	this.getHotPotatoFieldsTx({
	// 		tx,
	// 		collateralCoinType,
	// 		sessionPotatoId,
	// 	});
	// 	this.endSessionAndTransferAccount({
	// 		...inputs,
	// 		tx,
	// 		sessionPotatoId,
	// 		walletAddress,
	// 		collateralChange: BigInt(0),
	// 	});

	// 	const { events } =
	// 		await this.Provider.Inspections().fetchAllBytesFromTx({
	// 			tx,
	// 		});

	// 	const filledTakerEvent = EventsApiHelpers.findCastEventOrUndefined({
	// 		events,
	// 		eventType: this.eventTypes.filledTakerOrder,
	// 		castFunction: Casting.perpetuals.filledTakerOrderEventFromOnChain,
	// 	});

	// 	const sizeNum = lotSize * Math.abs(Number(size));

	// 	if (!filledTakerEvent) {
	// 		return {
	// 			executionPrice: 0,
	// 			sizeFilled: 0,
	// 			sizePosted: sizeNum,
	// 			fills: [],
	// 		};
	// 	}

	// 	const filledOrderEvents =
	// 		Aftermath.helpers.events.findCastEventsOrUndefined({
	// 			events,
	// 			eventType: this.eventTypes.filledTakerOrder,
	// 			castFunction:
	// 				Casting.perpetuals.filledTakerOrderEventFromOnChain,
	// 		});
	// 	const fills: PerpetualsFilledOrderData[] = filledOrderEvents.map(
	// 		(event) => {
	// 			const size = Math.abs(
	// 				Casting.IFixed.numberFromIFixed(event.baseAssetDelta)
	// 			);
	// 			const sizeUsd = Math.abs(
	// 				Casting.IFixed.numberFromIFixed(event.quoteAssetDelta)
	// 			);
	// 			const price = sizeUsd / size;
	// 			return {
	// 				size,
	// 				price,
	// 			};
	// 		}
	// 	);

	// 	const executionPrice = Perpetuals.calcEntryPrice(filledTakerEvent);
	// 	const sizeFilled = Math.abs(
	// 		Casting.IFixed.numberFromIFixed(filledTakerEvent.baseAssetDelta)
	// 	);
	// 	const sizePosted = sizeNum - sizeFilled;

	// 	return {
	// 		executionPrice,
	// 		sizeFilled,
	// 		sizePosted,
	// 		fills,
	// 	};

	// 	// const { fillReceipts, postReceipt } =
	// 	// 	await this.fetchMarketOrderReceipts(inputs);

	// 	// const sizePosted = postReceipt !== undefined ? postReceipt.size : 0;
	// 	// if (fillReceipts.length <= 0)
	// 	// 	return price !== undefined
	// 	// 		? // simulating limit order
	// 	// 		  {
	// 	// 				executionPrice: Perpetuals.orderPriceToPrice({
	// 	// 					orderPrice: price,
	// 	// 					lotSize,
	// 	// 					tickSize,
	// 	// 				}),
	// 	// 				sizeFilled: 0,
	// 	// 				sizePosted: Number(sizePosted),
	// 	// 		  }
	// 	// 		: // simulating market order
	// 	// 		  {
	// 	// 				executionPrice: 0,
	// 	// 				sizeFilled: 0,
	// 	// 				sizePosted: 0,
	// 	// 		  };

	// 	// const sizeFilled = Helpers.sumBigInt(
	// 	// 	fillReceipts.map((receipt) => receipt.size)
	// 	// );

	// 	// const executionPrice = fillReceipts.reduce((acc, receipt) => {
	// 	// 	const orderPrice = PerpetualsOrderUtils.price(
	// 	// 		receipt.orderId,
	// 	// 		inputs.side === PerpetualsOrderSide.Ask
	// 	// 			? PerpetualsOrderSide.Bid
	// 	// 			: PerpetualsOrderSide.Ask
	// 	// 	);
	// 	// 	const orderPriceNum = Perpetuals.orderPriceToPrice({
	// 	// 		orderPrice,
	// 	// 		lotSize,
	// 	// 		tickSize,
	// 	// 	});

	// 	// 	return (
	// 	// 		acc +
	// 	// 		orderPriceNum * (Number(receipt.size) / Number(sizeFilled))
	// 	// 	);
	// 	// }, 0);

	// 	// return {
	// 	// 	executionPrice,
	// 	// 	sizeFilled: Number(sizeFilled),
	// 	// 	sizePosted: Number(sizePosted),
	// 	// };
	// };

	// private createTxAndStartSession = (inputs: {
	// 	tx?: Transaction;
	// 	collateralCoinType: CoinType;
	// 	accountCapId: ObjectId | TransactionArgument;
	// 	marketId: PerpetualsMarketId;
	// 	marketInitialSharedVersion: ObjectVersion;
	// 	basePriceFeedId: ObjectId;
	// 	collateralPriceFeedId: ObjectId;
	// 	walletAddress: SuiAddress;
	// 	collateralChange: Balance;
	// 	hasPosition: boolean;
	// }) => {
	// 	const { collateralChange, walletAddress, hasPosition } = inputs;
	// 	const { tx: inputsTx, ...nonTxInputs } = inputs;

	// 	const tx = inputsTx ?? new Transaction();
	// 	tx.setSender(walletAddress);

	// 	if (!hasPosition) {
	// 		this.createMarketPositionTx({
	// 			...nonTxInputs,
	// 			tx,
	// 		});
	// 	}

	// 	if (collateralChange > BigInt(0)) {
	// 		this.allocateCollateralTx({
	// 			...nonTxInputs,
	// 			tx,
	// 			amount: collateralChange,
	// 		});
	// 	}

	// 	const sessionPotatoId = this.startSessionTx({
	// 		...nonTxInputs,
	// 		tx,
	// 	});

	// 	return { tx, sessionPotatoId };
	// };

	// private endSessionAndShareMarket = (inputs: {
	// 	tx: Transaction;
	// 	collateralCoinType: CoinType;
	// 	sessionPotatoId: ObjectId | TransactionArgument;
	// }) => {
	// 	const marketId = this.endSessionTx(inputs);
	// 	this.shareClearingHouseTx({
	// 		...inputs,
	// 		marketId,
	// 	});
	// };

	// =========================================================================
	//  Public Static Helpers
	// =========================================================================

	// public static bucketOrders = (inputs: {
	// 	orders: PerpetualsOrderInfo[];
	// 	side: PerpetualsOrderSide;
	// 	lotSize: number;
	// 	tickSize: number;
	// 	priceBucketSize: number;
	// 	initialBucketedOrders?: OrderbookDataPoint[];
	// }): OrderbookDataPoint[] => {
	// 	const {
	// 		orders,
	// 		side,
	// 		lotSize,
	// 		tickSize,
	// 		priceBucketSize,
	// 		initialBucketedOrders,
	// 	} = inputs;

	// 	let dataPoints: OrderbookDataPoint[] = initialBucketedOrders ?? [];

	// 	const roundPrice = (price: number, bucketSize: number): number => {
	// 		return Math.round(price / bucketSize) * bucketSize;
	// 	};

	// 	const comparePrices = (
	// 		price1: number,
	// 		price2: number,
	// 		bucketSize: number
	// 	): boolean => {
	// 		return Math.abs(price1 - price2) < bucketSize;
	// 	};

	// 	orders.forEach((order) => {
	// 		const actualPrice = Perpetuals.orderPriceToPrice({
	// 			lotSize,
	// 			tickSize: Math.abs(tickSize),
	// 			orderPrice: order.price,
	// 		});
	// 		const roundedPrice = roundPrice(actualPrice, priceBucketSize);
	// 		const size =
	// 			lotSize *
	// 			Math.abs(Number(order.size)) *
	// 			(tickSize < 0 ? -1 : 1);
	// 		const sizeUsd = size * actualPrice;

	// 		const placementIndex = dataPoints.findIndex(
	// 			(dataPoint: OrderbookDataPoint) =>
	// 				comparePrices(
	// 					roundedPrice,
	// 					dataPoint.price,
	// 					priceBucketSize
	// 				)
	// 		);

	// 		if (placementIndex < 0) {
	// 			if (size > 0) {
	// 				const newDataPoint: OrderbookDataPoint = {
	// 					size,
	// 					sizeUsd,
	// 					totalSize: size,
	// 					totalSizeUsd: sizeUsd,
	// 					price: roundedPrice,
	// 				};
	// 				const insertIndex = dataPoints.findIndex((dataPoint) =>
	// 					side === PerpetualsOrderSide.Ask
	// 						? roundedPrice < dataPoint.price
	// 						: roundedPrice > dataPoint.price
	// 				);
	// 				if (insertIndex < 0) {
	// 					dataPoints.push(newDataPoint);
	// 				} else {
	// 					dataPoints.splice(insertIndex, 0, newDataPoint);
	// 				}
	// 			}
	// 		} else {
	// 			dataPoints[placementIndex].size += size;
	// 			dataPoints[placementIndex].sizeUsd += sizeUsd;
	// 			dataPoints[placementIndex].totalSize += size;
	// 			dataPoints[placementIndex].totalSizeUsd += sizeUsd;
	// 		}
	// 	});

	// 	dataPoints = dataPoints.filter((data) => data.size >= lotSize);

	// 	for (let index = 0; index < dataPoints.length; index++) {
	// 		if (index > 0) {
	// 			dataPoints[index].totalSize =
	// 				dataPoints[index - 1].totalSize + dataPoints[index].size;
	// 			dataPoints[index].totalSizeUsd =
	// 				dataPoints[index - 1].totalSizeUsd +
	// 				dataPoints[index].sizeUsd;
	// 		} else {
	// 			dataPoints[index].totalSize = dataPoints[index].size;
	// 			dataPoints[index].totalSizeUsd = dataPoints[index].sizeUsd;
	// 		}
	// 	}

	// 	if (side === PerpetualsOrderSide.Ask) {
	// 		dataPoints.reverse();
	// 	}
	// 	return dataPoints;
	// };

	// =========================================================================
	//  Event Types
	// =========================================================================

	private eventType = (eventName: string) =>
		EventsApiHelpers.createEventType(
			this.addresses.perpetuals.packages.events,
			PerpetualsApi.constants.moduleNames.events,
			eventName
		);

	// =========================================================================
	//  Object Types
	// =========================================================================

	// private marketObjectType = (inputs: { collateralCoinType: CoinType }) =>
	// 	`${
	// 		inputs.packageId
	// 	}::clearing_house::ClearingHouse<${Helpers.addLeadingZeroesToType(
	// 		inputs.collateralCoinType
	// 	)}>`;
}
