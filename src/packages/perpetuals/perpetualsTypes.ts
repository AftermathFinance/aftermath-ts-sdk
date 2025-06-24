import { BcsType, bcs } from "@mysten/sui/bcs";
import {
	AnyObjectType,
	ApiDataWithCursorBody,
	ApiIndexerEventsBody,
	Balance,
	Byte,
	Event,
	IFixed,
	Object,
	ObjectDigest,
	ObjectId,
	ObjectVersion,
	PackageId,
	Percentage,
	SerializedTransaction,
	SuiAddress,
	SuiCheckpoint,
	Timestamp,
	TransactionDigest,
} from "../../general/types/generalTypes";
import {
	CoinDecimal,
	CoinSymbol,
	CoinType,
	ServiceCoinData,
} from "../coin/coinTypes";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";

// =========================================================================
//  Name Only
// =========================================================================

export type PerpetualsMarketId = ObjectId;
export type PerpetualsAccountId = bigint;
export type PerpetualsOrderId = bigint;
export type PerpetualsOrderIdAsString = string;
export type PerpetualsOrderPrice = bigint;

// =========================================================================
//  Enums
// =========================================================================

export enum PerpetualsOrderSide {
	Ask = 1, // true
	Bid = 0, // false
}

export enum PerpetualsOrderType {
	Standard = 0,
	FillOrKill = 1,
	PostOnly = 2,
	ImmediateOrCancel = 3,
}

export enum PerpetualsStopOrderType {
	/// Stop Loss / Take Profit stop order. Can to be placed to close (fully or partially)
	/// the position.
	SlTp = 0,
	/// Stop order that can be both reduce or increase the position's size. May require
	/// some collateral to be allocated to be able to be placed.
	Standalone = 1,
}

// =========================================================================
//  Market
// =========================================================================

export interface PerpetualsMarketData {
	packageId: PackageId;
	objectId: ObjectId;
	initialSharedVersion: ObjectVersion;
	collateralCoinType: CoinType;
	marketParams: PerpetualsMarketParams;
	marketState: PerpetualsMarketState;
	collateralPrice: number;
	indexPrice: number;
}

export interface PerpetualsAccountCap {
	objectId: ObjectId;
	walletAddress: SuiAddress;
	accountId: PerpetualsAccountId;
	collateralCoinType: CoinType;
	collateral: IFixed;
	collateralDecimals: CoinDecimal;
	objectVersion: ObjectVersion;
	objectDigest: ObjectDigest;
	subAccount: PerpetualsSubAccount;
}

export interface PerpetualsPosition {
	collateral: IFixed;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
	collateralCoinType: CoinType;
	marketId: PerpetualsMarketId;
	pendingOrders: {
		orderId: PerpetualsOrderId;
		side: PerpetualsOrderSide;
		size: bigint;
	}[];
	makerFee: IFixed;
	takerFee: IFixed;
	leverage: number;
}

export interface PerpetualsSubAccount {
	accountId: PerpetualsAccountId;
	collateralCoinType: CoinType;
	collateral: IFixed;
	users: SuiAddress[];
	objectVersion: ObjectVersion;
	// objectDigest: ObjectDigest;
	objectId: ObjectId;
}

// =========================================================================
//  Market
// =========================================================================

export interface PerpetualsMarketParams {
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
	baseAssetSymbol: CoinSymbol;
	basePriceFeedId: ObjectId;
	collateralPriceFeedId: ObjectId;
	fundingFrequencyMs: bigint;
	fundingPeriodMs: bigint;
	premiumTwapFrequencyMs: bigint;
	premiumTwapPeriodMs: bigint;
	spreadTwapFrequencyMs: bigint;
	spreadTwapPeriodMs: bigint;
	makerFee: IFixed;
	takerFee: IFixed;
	liquidationFee: IFixed;
	forceCancelFee: IFixed;
	insuranceFundFee: IFixed;
	minOrderUsdValue: IFixed;
	lotSize: bigint;
	tickSize: bigint;
	liquidationTolerance: bigint;
	maxPendingOrders: bigint;
	baseOracleTolerance: bigint;
	collateralOracleTolerance: bigint;
	maxOpenInterest: IFixed;
	maxOpenInterestThreshold: IFixed;
	maxOpenInterestPositionPercent: IFixed;
}

export interface PerpetualsMarketState {
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	fundingLastUpdateMs: Timestamp;
	premiumTwap: IFixed;
	premiumTwapLastUpdateMs: Timestamp;
	spreadTwap: IFixed;
	spreadTwapLastUpdateMs: Timestamp;
	openInterest: IFixed;
	feesAccrued: IFixed;
}

export interface PerpetualsMarketCandleDataPoint {
	time: Timestamp;
	high: number;
	low: number;
	open: number;
	close: number;
	volume: number;
}

// =========================================================================
//  Orderbook
// =========================================================================

export interface PerpetualsOrderbook {
	bids: Record<
		PerpetualsOrderIdAsString,
		{
			accountId: PerpetualsAccountId;
			size: number;
			price: number;
		}
	>;
	asks: Record<
		PerpetualsOrderIdAsString,
		{
			accountId: PerpetualsAccountId;
			size: number;
			price: number;
		}
	>;
	asksTotalSize: number;
	bidsTotalSize: number;
	bestBidPrice: number | undefined;
	bestAskPrice: number | undefined;
	midPrice: number | undefined;
	lastCheckpointUpdate: SuiCheckpoint;
}

export interface PerpetualsOrderData {
	orderId: PerpetualsOrderId;
	initialSize: bigint;
	filledSize: bigint;
	side: PerpetualsOrderSide;
	marketId: PerpetualsMarketId;
}

// reduceOnly: boolean;
// expiryTimestamp?: bigint;
// limitOrder?: {
// 	price: PerpetualsOrderPrice;
// 	orderType: PerpetualsOrderType;
// };

export interface PerpetualsStopOrderData {
	objectId: ObjectId;
	stopIndexPrice: number;
	marketId: PerpetualsMarketId;
	size: bigint;
	side: PerpetualsOrderSide;
	expiryTimestamp?: bigint;
	limitOrder?: {
		price: PerpetualsOrderPrice;
		orderType: PerpetualsOrderType;
	};
	slTp?: {
		isStopLoss: boolean;
		forPositionSide: PerpetualsOrderSide;
	};
	nonSlTp?: {
		triggerIfGeStopIndexPrice: boolean;
		reduceOnly: boolean;
	};
}

export interface PerpetualsFilledOrderData {
	size: number;
	price: number;
}

export interface PerpetualsOrderInfo {
	price: PerpetualsOrderPrice;
	size: bigint;
}
export interface PerpetualsAccountData {
	accountCap: PerpetualsAccountCap;
	account: PerpetualsAccountObject;
}

export interface PerpetualsAccountObject {
	positions: PerpetualsPosition[];
}

// =========================================================================
//  Events
// =========================================================================

// =========================================================================
//  Version
// =========================================================================

export interface UpdatedMarketVersionEvent extends Event {
	marketId: PerpetualsMarketId;
	version: bigint;
}

export const isUpdatedMarketVersion = (
	event: Event
): event is UpdatedMarketVersionEvent => {
	return event.type.toLowerCase().endsWith("::updatedclearinghouseversion");
};

// =========================================================================
//  Collateral
// =========================================================================

export interface PerpetualsAccountCollateralChangesWithCursor {
	collateralChanges: PerpetualsAccountCollateralChange[];
	nextCursor: Timestamp | undefined;
}

export type PerpetualsAccountCollateralChange = {
	timestamp: Timestamp;
	txDigest: TransactionDigest;
	marketId: PerpetualsMarketId | undefined;
	eventType: AnyObjectType;
	collateralChange: number;
	collateralChangeUsd: number;
	fees?:
		| {
				netFeesUsd: number;
				liquidationFeesUsd: number;
				forceCancelFeesUsd: number;
				insuranceFundFeesUsd: number;
		  }
		| {
				netFeesUsd: number;
				liqorFeesUsd: number;
		  }
		| {
				netFeesUsd: number;
		  };
};

export interface PerpetualsAccountTradesWithCursor {
	trades: PerpetualsAccountTrade[];
	nextCursor: Timestamp | undefined;
}

export interface PerpetualsAccountMarginData {
	timestamp: Timestamp;
	collateralUsd: number;
	unrealizedFundingUsd: number;
	unrealizedPnlUsd: number;
}

export type PerpetualsAccountTrade = {
	timestamp: Timestamp;
	txDigest: TransactionDigest;
	marketId: PerpetualsMarketId;
	eventType: AnyObjectType;
	side: PerpetualsOrderSide;
} & (
	| {
			orderPrice: bigint;
	  }
	| {
			price: number;
	  }
) &
	(
		| {
				sizeLots: bigint;
		  }
		| {
				size: number;
		  }
	);

export interface DepositedCollateralEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

export interface AllocatedCollateralEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

export interface DeallocatedCollateralEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

export interface WithdrewCollateralEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

export interface SettledFundingEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: IFixed;
	marketId: PerpetualsMarketId;
	marketFundingRateLong: IFixed;
	marketFundingRateShort: IFixed;
}

export type CollateralEvent =
	| WithdrewCollateralEvent
	| DepositedCollateralEvent
	| SettledFundingEvent
	| LiquidatedEvent
	| FilledTakerOrderEvent
	| FilledMakerOrdersEvent
	| AllocatedCollateralEvent
	| DeallocatedCollateralEvent;
// | AddedStopOrderTicketCollateralEvent
// | RemovedStopOrderTicketCollateralEvent;

// TODO: make all these checks use string value from perps api

export const isWithdrewCollateralEvent = (
	event: Event
): event is WithdrewCollateralEvent => {
	return event.type.toLowerCase().includes("::withdrewcollateral");
};

export const isDepositedCollateralEvent = (
	event: Event
): event is DepositedCollateralEvent => {
	return event.type.toLowerCase().includes("::depositedcollateral");
};

export const isDeallocatedCollateralEvent = (
	event: Event
): event is DeallocatedCollateralEvent => {
	return event.type.toLowerCase().endsWith("::deallocatedcollateral");
};

export const isAllocatedCollateralEvent = (
	event: Event
): event is AllocatedCollateralEvent => {
	return event.type.toLowerCase().endsWith("::allocatedcollateral");
};

export const isSettledFundingEvent = (
	event: Event
): event is SettledFundingEvent => {
	return event.type.toLowerCase().endsWith("::settledfunding");
};

// =========================================================================
//  Liquidation
// =========================================================================

export interface LiquidatedEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: IFixed;
	liqorAccountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	baseLiquidated: IFixed;
	quoteLiquidated: IFixed;
	liqeePnlUsd: IFixed;
	liquidationFeesUsd: IFixed;
	forceCancelFeesUsd: IFixed;
	insuranceFundFeesUsd: IFixed;
}

export const isLiquidatedEvent = (event: Event): event is LiquidatedEvent => {
	return event.type.toLowerCase().endsWith("::liquidatedposition");
};

// =========================================================================
//  Account
// =========================================================================

export interface CreatedAccountEvent extends Event {
	user: SuiAddress;
	accountId: PerpetualsAccountId;
}

export interface CreatedSubAccountEvent extends Event {
	users: SuiAddress[];
	accountId: PerpetualsAccountId;
	subAccountId: ObjectId;
}

export interface SetSubAccountUsersEvent extends Event {
	users: SuiAddress[];
	accountId: PerpetualsAccountId;
	subAccountId: ObjectId;
}

export interface SetPositionInitialMarginRatioEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	// NOTE: should this be made into string ?
	initialMarginRatio: IFixed;
}

// =========================================================================
//  Order
// =========================================================================

export interface PerpetualsTradeHistoryData {
	timestamp: Timestamp;
	txDigest: TransactionDigest;
	side: PerpetualsOrderSide;
	sizeFilled: number;
	orderPrice: number;
}

export interface PerpetualsTradeHistoryWithCursor {
	trades: PerpetualsTradeHistoryData[];
	// TODO: move `nextCursor` pattern to general types ?
	nextCursor: Timestamp | undefined;
}

export interface OrderbookPostReceiptEvent extends Event {
	accountId: PerpetualsAccountId;
	orderId: PerpetualsOrderId;
	size: bigint;
}

export interface OrderbookFillReceiptEvent extends Event {
	accountId: PerpetualsAccountId;
	orderId: PerpetualsOrderId;
	size: bigint;
	dropped: boolean;
}

export interface CanceledOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	orderId: PerpetualsOrderId;
}

export interface PostedOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

export interface FilledMakerOrdersEvent extends Event {
	events: FilledMakerOrderEventFields[];
}

export interface FilledMakerOrderEventFields {
	accountId: PerpetualsAccountId;
	takerAccountId: PerpetualsAccountId;
	collateralDeltaUsd: IFixed;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	sizeRemaining: bigint;
	orderId: PerpetualsOrderId;
	dropped: boolean;
	pnlUsd: IFixed;
	feesUsd: IFixed;
}

export interface FilledTakerOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: IFixed;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	baseAssetDelta: IFixed;
	quoteAssetDelta: IFixed;
	takerPnlUsd: IFixed;
	takerFeesUsd: IFixed;
}

export type PerpetualsOrderEvent =
	| CanceledOrderEvent
	// | PostedOrderEvent
	| PostedOrderReceiptEvent
	| FilledMakerOrdersEvent
	| FilledTakerOrderEvent
	| LiquidatedEvent
	| ReducedOrderEvent;

export interface PostedOrderReceiptEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	orderId: PerpetualsOrderId;
	size: bigint;
	side: PerpetualsOrderSide;
}

export interface ReducedOrderEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	sizeChange: bigint;
	orderId: PerpetualsOrderId;
}

// TODO: make all these checks use string value from perps api

export const isCanceledOrderEvent = (
	event: Event
): event is CanceledOrderEvent => {
	return event.type.toLowerCase().endsWith("::canceledorder");
};

export const isPostedOrderEvent = (event: Event): event is PostedOrderEvent => {
	return event.type.toLowerCase().endsWith("::postedorder");
};

export const isPostedOrderReceiptEvent = (
	event: Event
): event is PostedOrderReceiptEvent => {
	return event.type.toLowerCase().endsWith("::orderbookpostreceipt");
};

export const isFilledMakerOrdersEvent = (
	event: Event
): event is FilledMakerOrdersEvent => {
	return event.type.toLowerCase().endsWith("::filledmakerorders");
};

export const isFilledTakerOrderEvent = (
	event: Event
): event is FilledTakerOrderEvent => {
	return event.type.toLowerCase().endsWith("::filledtakerorder");
};

export const isReducedOrderEvent = (
	event: Event
): event is ReducedOrderEvent => {
	return event.type.toLowerCase().endsWith("::reducedorder");
};

// =========================================================================
//  Stop Orders
// =========================================================================

export interface CreatedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	objectId: ObjectId;
	accountId: PerpetualsAccountId;
	subAccountId?: ObjectId;
	executors: SuiAddress[];
	gas: Balance;
	stopOrderType: PerpetualsStopOrderType;
	encryptedDetails: Byte[];
}

export interface ExecutedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	executor: SuiAddress;
}

export interface DeletedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subAccountId?: ObjectId;
	executor: SuiAddress;
}

export interface EditedStopOrderTicketDetailsEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subAccountId?: ObjectId;
	encryptedDetails: Byte[];
	executor: SuiAddress;
}

export interface EditedStopOrderTicketExecutorEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subAccountId?: ObjectId;
	executors: SuiAddress[];
}

// export interface AddedStopOrderTicketCollateralEvent extends Event {
// 	ticketId: ObjectId;
// 	accountId: PerpetualsAccountId;
// 	subAccountId?: ObjectId;
// 	collateralToAllocate: Balance;
// }

// export interface RemovedStopOrderTicketCollateralEvent extends Event {
// 	ticketId: ObjectId;
// 	accountId: PerpetualsAccountId;
// 	subAccountId?: ObjectId;
// 	collateralToRemove: Balance;
// }

export interface TransferredDeallocatedCollateralEvent extends Event {
	chId: ObjectId;
	objectId: ObjectId; // Account or SubAccount object id
	accountId: PerpetualsAccountId;
	collateral: Balance;
}

export interface ReceivedCollateralEvent extends Event {
	objectId: ObjectId; // Account or SubAccount object id
	accountId: PerpetualsAccountId;
	collateral: Balance;
}

// =========================================================================
//  Twap
// =========================================================================

export interface UpdatedPremiumTwapEvent extends Event {
	marketId: PerpetualsMarketId;
	bookPrice: IFixed;
	indexPrice: IFixed;
	premiumTwap: IFixed;
	premiumTwapLastUpdateMs: number;
}

export interface UpdatedSpreadTwapEvent extends Event {
	marketId: PerpetualsMarketId;
	bookPrice: IFixed;
	indexPrice: IFixed;
	spreadTwap: IFixed;
	spreadTwapLastUpdateMs: number;
}

export type PerpetualsTwapEvent =
	| UpdatedPremiumTwapEvent
	| UpdatedSpreadTwapEvent;

export const isUpdatedPremiumTwapEvent = (
	event: Event
): event is UpdatedPremiumTwapEvent => {
	return event.type.toLowerCase().endsWith("::updatedpremiumtwap");
};

export const isUpdatedSpreadTwapEvent = (
	event: Event
): event is UpdatedSpreadTwapEvent => {
	return event.type.toLowerCase().endsWith("::updatedspreadtwap");
};

// =========================================================================
//  Funding
// =========================================================================

export interface UpdatedFundingEvent extends Event {
	marketId: PerpetualsMarketId;
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	fundingLastUpdateMs: Timestamp;
}

export const isUpdatedFundingEvent = (
	event: Event
): event is UpdatedFundingEvent => {
	return event.type.toLowerCase().endsWith("::updatedfunding");
};

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Objects
// =========================================================================

export interface ApiPerpetualsOwnedAccountCapsBody {
	walletAddress: SuiAddress;
}

export interface ApiPerpetualsAccountCapsBody {
	accountCapIds: ObjectId[];
}

// =========================================================================
//  Interactions
// =========================================================================

export interface ApiPerpetualsAccountMarginHistoryBody {
	accountId: PerpetualsAccountId;
	collateralCoinType: CoinType;
}

export type ApiPerpetualsAccountOrderHistoryBody =
	ApiDataWithCursorBody<Timestamp> & {
		accountId: PerpetualsAccountId;
	};

export type ApiPerpetualsAccountCollateralHistoryBody =
	ApiDataWithCursorBody<Timestamp> & {
		accountId: PerpetualsAccountId;
		collateralCoinType: CoinType;
	};

export type ApiPerpetualsPreviewOrderBody = (
	| Omit<
			ApiPerpetualsLimitOrderBody,
			| "collateralChange"
			| "walletAddress"
			| "hasPosition"
			| "txKind"
			| "accountObjectId"
			| "slTp"
	  >
	| Omit<
			ApiPerpetualsMarketOrderBody,
			| "collateralChange"
			| "walletAddress"
			| "hasPosition"
			| "txKind"
			| "accountObjectId"
			| "slTp"
	  >
) & {
	// TODO: remove eventually ?
	accountObjectId: ObjectId | undefined;
	collateralCoinType: CoinType;
	lotSize: number;
	tickSize: number;
	leverage?: number;
	// NOTE: do we need this ?
	// isClose?: boolean;
};

export interface ApiPerpetualsPreviewCancelOrdersBody {
	accountObjectId: ObjectId;
	// TODO: remove eventually ?
	collateralCoinType: CoinType;
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
		}
	>;
}

export interface ApiPerpetualsPreviewReduceOrderBody {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	leverage?: number;
	orderId: PerpetualsOrderId;
	sizeToSubtract: bigint;
	// TODO: remove eventually ?
	collateralCoinType: CoinType;
}

export interface ApiPerpetualsPreviewSetLeverageBody {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	leverage: number;
	collateralCoinType: CoinType;
}

export type ApiPerpetualsPreviewReduceOrderResponse =
	| {
			error: string;
	  }
	| {
			positionAfterReduceOrder: PerpetualsPosition;
			collateralChange: number;
	  };

export type ApiPerpetualsPreviewSetLeverageResponse =
	| {
			error: string;
	  }
	| {
			positionAfterSetLeverage: PerpetualsPosition;
			collateralChange: number;
	  };

export type ApiPerpetualsPreviewOrderResponse =
	| {
			error: string;
	  }
	| {
			positionAfterOrder: PerpetualsPosition;
			priceSlippage: number;
			percentSlippage: Percentage;
			filledSize: number;
			filledSizeUsd: number;
			postedSize: number;
			postedSizeUsd: number;
			collateralChange: number;
			executionPrice: number;
	  };

export type ApiPerpetualsPreviewCancelOrdersResponse =
	| {
			error: string;
	  }
	| {
			marketIdsToPositionAfterCancelOrders: Record<
				PerpetualsMarketId,
				PerpetualsPosition
			>;
			collateralChange: number;
	  };

// export interface ApiPerpetualsOrderbookStateBody {
// 	orderbookPrice: number;
// 	lotSize: number;
// 	tickSize: number;
// 	priceBucketSize: number;
// }

export interface ApiPerpetualsExecutionPriceBody {
	side: PerpetualsOrderSide;
	size: bigint;
	lotSize: number;
	collateral: Balance;
	basePriceFeedId: ObjectId;
	collateralPriceFeedId: ObjectId;
	price?: PerpetualsOrderPrice;
}
export interface ApiPerpetualsExecutionPriceResponse {
	executionPrice: number;
	sizeFilled: number;
	sizePosted: number;
	fills: PerpetualsFilledOrderData[];
}

export type ApiPerpetualsHistoricalMarketDataResponse =
	PerpetualsMarketCandleDataPoint[];

export interface ApiPerpetualsMaxOrderSizeBody {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	side: PerpetualsOrderSide;
	leverage?: number;
	price?: PerpetualsOrderPrice;
}

export interface ApiPerpetualsAccountOrderDatasBody {
	accountId: PerpetualsAccountId;
	orderDatas: {
		orderId: PerpetualsOrderId;
		currentSize: bigint;
	}[];
}

export interface ApiPerpetualsAccountOrderDatasBody {
	accountId: PerpetualsAccountId;
	orderDatas: {
		orderId: PerpetualsOrderId;
		currentSize: bigint;
	}[];
}

export interface ApiPerpetualsAccountStopOrderDatasBody {
	accountId: PerpetualsAccountId;
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
	marketIds: PerpetualsMarketId[];
}

// =========================================================================
//  Transactions
// =========================================================================

export interface ApiPerpetualsCreateAccountBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	txKind?: SerializedTransaction;
}

export type ApiPerpetualsDepositCollateralBody = {
	walletAddress: SuiAddress;
	accountObjectId: ObjectId;
	collateralCoinType: CoinType;
	txKind?: SerializedTransaction;
	isSponsoredTx?: boolean;
} & (
	| {
			depositAmount: Balance;
	  }
	| {
			coinInArg: TransactionObjectArgument;
	  }
);

export interface ApiPerpetualsWithdrawCollateralBody {
	walletAddress: SuiAddress;
	accountObjectId: ObjectId;
	collateralCoinType: CoinType;
	withdrawAmount: Balance;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsWithdrawCollateralResponse {
	txKind: SerializedTransaction;
	coinOutArg: TransactionObjectArgument | undefined;
}

export interface ApiPerpetualsTransferCollateralBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	fromAccountObjectId: ObjectId;
	toAccountObjectId: ObjectId;
	transferAmount: Balance;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsAllocateCollateralBody {
	accountObjectId: ObjectId;
	marketId: PerpetualsMarketId;
	allocateAmount: Balance;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsDeallocateCollateralBody {
	accountObjectId: ObjectId;
	marketId: PerpetualsMarketId;
	deallocateAmount: Balance;
	txKind?: SerializedTransaction;
}

export interface PerpetualsSlTpOrderDetails {
	// expiryTimestamp?: bigint;
	stopIndexPrice: number;
	// triggerIfGeStopIndexPrice: boolean;
	// side: PerpetualsOrderSide;
	size?: bigint;
	// reduceOnly: boolean;
	// TODO: add back once ready on be
	// collateralToAllocate: Balance;
	// leverage?: number;
	// limitOrder?: {
	// 	price: PerpetualsOrderPrice;
	// 	orderType: PerpetualsOrderType;
	// };
}

export interface SdkPerpetualsPlaceStopOrdersInputs {
	stopOrders: Omit<PerpetualsStopOrderData, "objectId">[];
	tx?: Transaction;
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
}

export interface ApiPerpetualsPlaceStopOrdersBody {
	accountObjectId: ObjectId;
	walletAddress: SuiAddress;
	stopOrders: Omit<PerpetualsStopOrderData, "objectId">[];
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
	txKind?: SerializedTransaction;
}

export type SdkPerpetualsPlaceSlTpOrdersInputs = {
	marketId: PerpetualsMarketId;
	tx?: Transaction;
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
} & (
	| {
			stopLoss: PerpetualsSlTpOrderDetails;
			takeProfit: PerpetualsSlTpOrderDetails;
	  }
	| {
			stopLoss: PerpetualsSlTpOrderDetails;
	  }
	| {
			takeProfit: PerpetualsSlTpOrderDetails;
	  }
);

export type ApiPerpetualsPlaceSlTpOrdersBody = {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	walletAddress: SuiAddress;
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
	positionSide: PerpetualsOrderSide;
	stopLoss?: PerpetualsSlTpOrderDetails;
	takeProfit?: PerpetualsSlTpOrderDetails;
	leverage?: number;
	txKind?: SerializedTransaction;
};
// & (
// 	| {
// 			stopLoss: PerpetualsSlTpOrderDetails;
// 			takeProfit: PerpetualsSlTpOrderDetails;
// 	  }
// 	| {
// 			stopLoss: PerpetualsSlTpOrderDetails;
// 	  }
// 	| {
// 			takeProfit: PerpetualsSlTpOrderDetails;
// 	  }
// );

export interface ApiPerpetualsEditStopOrdersBody {
	accountObjectId: ObjectId;
	stopOrders: PerpetualsStopOrderData[];
	txKind?: SerializedTransaction;
}

export type ApiPerpetualsMarketOrderBody = {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	side: PerpetualsOrderSide;
	size: bigint;
	collateralChange: number;
	hasPosition: boolean;
	leverage?: number;
	slTp?: {
		walletAddress: SuiAddress;
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		stopLoss?: PerpetualsSlTpOrderDetails;
		takeProfit?: PerpetualsSlTpOrderDetails;
	};
	// & (
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// );
	txKind?: SerializedTransaction;
};

export type ApiPerpetualsLimitOrderBody = {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	side: PerpetualsOrderSide;
	size: bigint;
	price: PerpetualsOrderPrice;
	orderType: PerpetualsOrderType;
	collateralChange: number;
	hasPosition: boolean;
	leverage?: number;
	slTp?: {
		walletAddress: SuiAddress;
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		stopLoss?: PerpetualsSlTpOrderDetails;
		takeProfit?: PerpetualsSlTpOrderDetails;
	};
	// & (
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// );
	txKind?: SerializedTransaction;
};

export interface ApiPerpetualsCancelOrdersBody {
	accountObjectId: ObjectId;
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
			collateralChange: number;
		}
	>;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsCancelStopOrdersBody {
	accountObjectId: ObjectId;
	stopOrderIds: ObjectId[];
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsReduceOrderBody {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	collateralChange: number;
	leverage?: number;
	orderId: PerpetualsOrderId;
	sizeToSubtract: bigint;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsSetLeverageTxBody {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	collateralChange: number;
	leverage: number;
	txKind?: SerializedTransaction;
}

// export interface ApiPerpetualsReduceOrderBody {
// 	walletAddress: SuiAddress;
// 	packageId: PackageId;
// 	collateralCoinType: CoinType;
// 	accountCapId: ObjectId;
// 	marketId: PerpetualsMarketId;
// 	marketInitialSharedVersion: ObjectVersion;
// 	orderIds: PerpetualsOrderId[];
// 	sizesToSubtract: bigint[];
// 	basePriceFeedId: ObjectId;
// 	collateralPriceFeedId: ObjectId;
// 	collateralChange: number;
// }

export interface PerpetualsMarket24hrStats {
	volumeUsd: number;
	volumeBaseAssetAmount: number;
	priceChange: number;
	priceChangePercentage: number;
}

export type ApiPerpetualsMarkets24hrStatsResponse = PerpetualsMarket24hrStats[];

// =========================================================================
//  SDK
// =========================================================================

export type SdkPerpetualsPlaceMarketOrderInputs = Omit<
	ApiPerpetualsMarketOrderBody,
	"accountObjectId" | "hasPosition" | "txKind" | "slTp"
> & {
	tx?: Transaction;
	slTp?: {
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		stopLoss?: PerpetualsSlTpOrderDetails;
		takeProfit?: PerpetualsSlTpOrderDetails;
	};
	// } & (
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// );
};

export type SdkPerpetualsPlaceLimitOrderInputs = Omit<
	ApiPerpetualsLimitOrderBody,
	"accountObjectId" | "hasPosition" | "txKind" | "slTp"
> & {
	tx?: Transaction;
	slTp?: {
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		stopLoss?: PerpetualsSlTpOrderDetails;
		takeProfit?: PerpetualsSlTpOrderDetails;
	};
	// } & (
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			stopLoss: PerpetualsSlTpOrderDetails;
	// 	  }
	// 	| {
	// 			takeProfit: PerpetualsSlTpOrderDetails;
	// 	  }
	// );
};

export type SdkPerpetualsPlaceOrderPreviewInputs = Omit<
	ApiPerpetualsPreviewOrderBody,
	"collateralCoinType" | "accountObjectId"
>;

export type SdkPerpetualsCancelOrdersPreviewInputs = Omit<
	ApiPerpetualsPreviewCancelOrdersBody,
	"collateralCoinType" | "accountObjectId"
>;
