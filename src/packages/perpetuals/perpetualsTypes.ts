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
import { Transaction } from "@mysten/sui/transactions";

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

// =========================================================================
//  BCS - Binary Canonical Serialization
// =========================================================================

// function Field<N extends BcsType<any>, V extends BcsType<any>>(
// 	name: N,
// 	value: V
// ) {
// 	return bcs.struct("Field", { name, value });
// }

// =========================================================================
//  Admin
// =========================================================================

export interface PerpetualsAdminCapability extends Object {}

// const AdminCapability = bcs.struct("AdminCapability", {
// 	id: bcs.Address,
// });

export interface PerpetualsRegistry extends Object {
	activeCollaterals: CoinType[];
}

// const Registry = bcs.struct("Registry", {
// 	id: bcs.Address,
// 	activeCollaterals: bcs.vector(bcs.string()),
// 	nextAccountId: bcs.u64(),
// });

// const MarketKey = bcs.struct("MarketKey", {
// 	marketId: bcs.u64(),
// });

// =========================================================================
//  Clearing House
// =========================================================================

export interface PerpetualsVault extends Object {
	balance: Balance;
	scalingFactor: bigint;
}

// const BalanceStruct = bcs.struct("Balance", { value: bcs.u64() });

// const Coin = bcs.struct("Coin", {
// 	id: bcs.Address,
// 	balance: BalanceStruct,
// });

// const Vault = bcs.struct("Vault", {
// 	id: bcs.Address,
// 	collateral_balance: BalanceStruct,
// 	insurance_fund_balance: BalanceStruct,
// 	scalingFactor: bcs.u64(),
// });

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
}

// const Account = bcs.struct("Account", {
// 	id: bcs.Address,
// 	accountId: bcs.u64(),
// 	collateral: BalanceStruct,
// });

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

// const Position = bcs.struct("Position", {
// 	collateral: bcs.u256(),
// 	baseAssetAmount: bcs.u256(),
// 	quoteAssetNotionalAmount: bcs.u256(),
// 	cumFundingRateLong: bcs.u256(),
// 	cumFundingRateShort: bcs.u256(),
// 	asksQuantity: bcs.u256(),
// 	bidsQuantity: bcs.u256(),
// 	pendingOrders: bcs.u64(),
// 	makerFee: bcs.u256(),
// 	takerFee: bcs.u256(),
// });

// const PositionKey = bcs.struct("PositionKey", {
// 	accountId: bcs.u64(),
// });

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

// export interface OrderbookDataPoint {
// 	price: number;
// 	size: number;
// 	totalSize: number;
// 	sizeUsd: number;
// 	totalSizeUsd: number;
// }

// export interface PerpetualsOrderbookState {
// 	bids: OrderbookDataPoint[];
// 	asks: OrderbookDataPoint[];
// 	minAskPrice: number;
// 	maxBidPrice: number;
// }

export interface PerpetualsOrderData {
	orderId: PerpetualsOrderId;
	initialSize: bigint;
	filledSize: bigint;
	side: PerpetualsOrderSide;
	marketId: PerpetualsMarketId;
}

export interface PerpetualsStopOrderData {
	objectId: ObjectId;
	expiryTimestamp: bigint;
	stopIndexPrice: number;
	triggerIfGeStopIndexPrice: boolean;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	reduceOnly: boolean;
	// collateralToAllocate: Balance;
	marginRatio?: number; // NOTE: should this be leverage instead ?
	limitOrder?: {
		price: PerpetualsOrderPrice;
		orderType: PerpetualsOrderType;
	};
}

export interface PerpetualsFilledOrderData {
	size: number;
	price: number;
}

// export interface PerpetualsOrderbook extends Object {
// 	asks: PerpetualsOrderedMap<PerpetualsOrder>;
// 	bids: PerpetualsOrderedMap<PerpetualsOrder>;
// 	counter: bigint;
// }

// const Order = bcs.struct("Order", {
// 	accountId: bcs.u64(),
// 	size: bcs.u64(),
// });

// const Orderbook = bcs.struct("Orderbook", {
// 	id: bcs.Address,
// 	asks: PerpetualsMap(Order),
// 	bids: PerpetualsMap(Order),
// 	counter: bcs.u64(),
// });

// export interface PerpetualsOrder {
// 	accountId: PerpetualsAccountId;
// 	size: bigint;
// }

export interface PerpetualsOrderInfo {
	price: PerpetualsOrderPrice;
	size: bigint;
}

// const OrderInfo = bcs.struct("OrderInfo", {
// 	price: bcs.u64(),
// 	size: bcs.u64(),
// });

// export interface PerpetualsOrderedMap<T> extends Object {
// 	size: bigint;
// 	counter: bigint;
// 	root: bigint;
// 	first: bigint;
// 	branchMin: bigint;
// 	branchMax: bigint;
// 	leafMin: bigint;
// 	leafMax: bigint;
// 	branchesMergeMax: bigint;
// 	leavesMergeMax: bigint;
// }

// function PerpetualsMap<T extends BcsType<any>>(T: T) {
// 	return bcs.struct("Map", {
// 		id: bcs.Address,
// 		size: bcs.u64(),
// 		counter: bcs.u64(),
// 		root: bcs.u64(),
// 		first: bcs.u64(),
// 		branchMin: bcs.u64(),
// 		branchMax: bcs.u64(),
// 		leafMin: bcs.u64(),
// 		leafMax: bcs.u64(),
// 		branchesMergeMax: bcs.u64(),
// 		leavesMergeMax: bcs.u64(),
// 	});
// }

// export interface PerpetualsBranch {
// 	keys: bigint[];
// 	kids: bigint[];
// }

// export const Branch = bcs.struct("Branch", {
// 	keys: bcs.vector(bcs.u128()),
// 	kids: bcs.vector(bcs.u64()),
// });

// export interface PerpetualsLeaf<V> {
// 	keys: bigint[];
// 	vals: V[];
// 	next: bigint;
// }

// export function Leaf<V extends BcsType<any>>(V: V) {
// 	return bcs.struct("Leaf", {
// 		keys: bcs.vector(bcs.u128()),
// 		vals: bcs.vector(V),
// 		next: bcs.u64(),
// 	});
// }

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
	collateralChange: Balance;
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
	executor: SuiAddress;
	gas: Balance;
	collateralToAllocate: Balance;
	encryptedDetails: Byte[];
}

export interface ExecutedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
}

export interface DeletedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subaccountId?: ObjectId;
}

export interface EditedStopOrderTicketDetailsEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subaccountId?: ObjectId;
	encryptedDetails: Byte[];
}

export interface EditedStopOrderTicketExecutorEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subaccountId?: ObjectId;
	executor: SuiAddress;
}

export interface AddedStopOrderTicketCollateralEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subaccountId?: ObjectId;
	collateralToAllocate: Balance;
}

export interface RemovedStopOrderTicketCollateralEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subaccountId?: ObjectId;
	collateralToRemove: Balance;
}

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

export type ApiPerpetualsAccountOrderHistoryBody =
	ApiDataWithCursorBody<Timestamp> & {
		accountId: PerpetualsAccountId;
	};

export type ApiPerpetualsAccountCollateralHistoryBody =
	ApiDataWithCursorBody<Timestamp> & {
		accountId: PerpetualsAccountId;
		collateralCoinType: CoinType;
	};

export interface ApiPerpetualsSetPositionLeverageBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

export interface ApiPerpetualsSetPositionLeverageFromTxBody {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	leverage: number;
	txDigest: TransactionDigest;
}

export type ApiPerpetualsPreviewOrderBody = (
	| Omit<
			ApiPerpetualsLimitOrderBody,
			| "collateralChange"
			| "walletAddress"
			| "accountObjectId"
			| "hasPosition"
			| "stopLoss"
			| "takeProfit"
			| "txKind"
	  >
	| Omit<
			ApiPerpetualsMarketOrderBody,
			| "collateralChange"
			| "walletAddress"
			| "accountObjectId"
			| "hasPosition"
			| "stopLoss"
			| "takeProfit"
			| "txKind"
	  >
) & {
	collateral: Balance;
	// TODO: remove eventually ?
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	lotSize: number;
	tickSize: number;
	leverage: number;
	// NOTE: do we need this ?
	// isClose?: boolean;
};

export interface ApiPerpetualsPreviewCancelOrdersBody {
	collateral: Balance;
	accountId: PerpetualsAccountId;
	// TODO: remove eventually ?
	collateralCoinType: CoinType;
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
			leverage: number;
		}
	>;
}

export interface ApiPerpetualsPreviewReduceOrderBody {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	leverage: number;
	orderId: PerpetualsOrderId;
	sizeToSubtract: bigint;
	collateral: Balance;
	// TODO: remove eventually ?
	collateralCoinType: CoinType;
}

export interface ApiPerpetualsPreviewSetLeverageBody {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	collateral: Balance;
	leverage: number;
	collateralCoinType: CoinType;
}

export type ApiPerpetualsPreviewReduceOrderResponse =
	| {
			error: string;
	  }
	| {
			positionAfterReduceOrder: PerpetualsPosition;
			collateralChange: Balance;
	  };

export type ApiPerpetualsPreviewSetLeverageResponse =
	| {
			error: string;
	  }
	| {
			positionAfterSetLeverage: PerpetualsPosition;
			collateralChange: Balance;
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
			collateralChange: Balance;
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
			collateralChange: Balance;
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
	accountId: PerpetualsAccountId;
	collateral: Balance;
	side: PerpetualsOrderSide;
	leverage: number;
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
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

// =========================================================================
//  Transactions
// =========================================================================

export interface ApiPerpetualsCreateAccountBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
}

export interface ApiPerpetualsDepositCollateralBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	amount: Balance;
	isSponsoredTx?: boolean;
}

export interface ApiPerpetualsWithdrawCollateralBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	amount: Balance;
}

export interface ApiPerpetualsTransferCollateralBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	fromAccountCapId: ObjectId;
	toAccountCapId: ObjectId;
	amount: Balance;
}

export interface ApiPerpetualsAllocateCollateralBody {
	walletAddress: SuiAddress;
	packageId: PackageId;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	marketInitialSharedVersion: ObjectVersion;
	amount: Balance;
}

export interface ApiPerpetualsDeallocateCollateralBody {
	walletAddress: SuiAddress;
	packageId: PackageId;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	basePriceFeedId: ObjectId;
	collateralPriceFeedId: ObjectId;
	marketId: PerpetualsMarketId;
	marketInitialSharedVersion: ObjectVersion;
	amount: Balance;
}

export interface PerpetualsSlTpOrderDetails {
	// expiryTimestamp: bigint;
	stopIndexPrice: number;
	// triggerIfGeStopIndexPrice: boolean;
	// side: PerpetualsOrderSide;
	size: bigint;
	// reduceOnly: boolean;
	gasCoin: ServiceCoinData;
	// TODO: add back once ready on be
	// collateralToAllocate: Balance;
	marginRatio?: number;
	// limitOrder?: {
	// 	price: PerpetualsOrderPrice;
	// 	orderType: PerpetualsOrderType;
	// };
}

export interface ApiPerpetualsPlaceStopOrdersBody {
	accountObjectId: ObjectId;
	stopOrders: {
		expiryTimestamp: bigint;
		stopIndexPrice: number;
		triggerIfGeStopIndexPrice: boolean;
		side: PerpetualsOrderSide;
		size: bigint;
		reduceOnly: boolean;
		gasCoin: ServiceCoinData;
		collateralToAllocate: Balance;
		marginRatio?: number;
		limitOrder?: {
			price: PerpetualsOrderPrice;
			orderType: PerpetualsOrderType;
		};
	}[];
	txKind?: SerializedTransaction;
}

export interface SdkPerpetualsStopOrdersInputs {
	stopOrders: {
		expiryTimestamp: bigint;
		stopIndexPrice: number;
		triggerIfGeStopIndexPrice: boolean;
		side: PerpetualsOrderSide;
		size: bigint;
		reduceOnly: boolean;
		// gasCoin: ServiceCoinData;
		collateralToAllocate: Balance;
		marginRatio?: number;
		limitOrder?: {
			price: PerpetualsOrderPrice;
			orderType: PerpetualsOrderType;
		};
	}[];
	tx?: Transaction;
	isSponsoredTx?: boolean;
}

export interface ApiPerpetualsPlaceStopOrdersBody {
	accountObjectId: ObjectId;
	stopOrders: {
		expiryTimestamp: bigint;
		stopIndexPrice: number;
		triggerIfGeStopIndexPrice: boolean;
		side: PerpetualsOrderSide;
		size: bigint;
		reduceOnly: boolean;
		gasCoin: ServiceCoinData;
		collateralToAllocate: Balance;
		marginRatio?: number;
		limitOrder?: {
			price: PerpetualsOrderPrice;
			orderType: PerpetualsOrderType;
		};
	}[];
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsEditStopOrdersBody {
	accountObjectId: ObjectId;
	stopOrders: {
		expiryTimestamp: bigint;
		stopIndexPrice: number;
		triggerIfGeStopIndexPrice: boolean;
		side: PerpetualsOrderSide;
		size: bigint;
		reduceOnly: boolean;
		collateralToAllocate: Balance;
		marginRatio?: number;
		limitOrder?: {
			price: PerpetualsOrderPrice;
			orderType: PerpetualsOrderType;
		};
	}[];
	txKind?: SerializedTransaction;
}

export type ApiPerpetualsMarketOrderBody = {
	accountId: PerpetualsAccountId;
	walletAddress: SuiAddress;
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	side: PerpetualsOrderSide;
	size: bigint;
	collateralChange: Balance;
	hasPosition: boolean;
	leverage: number;
	stopLoss?: PerpetualsSlTpOrderDetails;
	takeProfit?: PerpetualsSlTpOrderDetails;
	txKind?: SerializedTransaction;
};

export type ApiPerpetualsLimitOrderBody = {
	accountId: PerpetualsAccountId;
	walletAddress: SuiAddress;
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	side: PerpetualsOrderSide;
	size: bigint;
	price: PerpetualsOrderPrice;
	orderType: PerpetualsOrderType;
	collateralChange: Balance;
	hasPosition: boolean;
	leverage: number;
	stopLoss?: PerpetualsSlTpOrderDetails;
	takeProfit?: PerpetualsSlTpOrderDetails;
	txKind?: SerializedTransaction;
};

export interface ApiPerpetualsCancelOrdersBody {
	accountObjectId: ObjectId;
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
			collateralChange: Balance;
			leverage: number;
		}
	>;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsCancelStopOrdersBody {
	accountObjectId: ObjectId;
	marketIdsToStopOrderIds: Record<PerpetualsMarketId, ObjectId[]>;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsReduceOrderBody {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	collateralChange: Balance;
	leverage: number;
	orderId: PerpetualsOrderId;
	sizeToSubtract: bigint;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsSetLeverageBody {
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	collateralChange: Balance;
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
// 	collateralChange: Balance;
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

export type SdkPerpetualsMarketOrderInputs = Omit<
	ApiPerpetualsMarketOrderBody,
	"accountObjectId" | "hasPosition" | "txKind" | "stopLoss" | "takeProfit"
> & {
	tx?: Transaction;
	stopLoss?: Omit<PerpetualsSlTpOrderDetails, "gasCoin">;
	takeProfit?: Omit<PerpetualsSlTpOrderDetails, "gasCoin">;
	isSponsoredTx?: boolean;
};

export type SdkPerpetualsLimitOrderInputs = Omit<
	ApiPerpetualsLimitOrderBody,
	"accountObjectId" | "hasPosition" | "txKind" | "stopLoss" | "takeProfit"
> & {
	tx?: Transaction;
	stopLoss?: Omit<PerpetualsSlTpOrderDetails, "gasCoin">;
	takeProfit?: Omit<PerpetualsSlTpOrderDetails, "gasCoin">;
	isSponsoredTx?: boolean;
};

export type SdkPerpetualsPlaceOrderPreviewInputs = Omit<
	ApiPerpetualsPreviewOrderBody,
	"accountId" | "collateralCoinType" | "collateral"
>;

export type SdkPerpetualsCancelOrdersPreviewInputs = Omit<
	ApiPerpetualsPreviewCancelOrdersBody,
	"accountId" | "collateralCoinType" | "collateral"
>;

// export const perpetualsRegistry = {
// 	Account,
// 	AdminCapability,
// 	BalanceStruct,
// 	// Branch,
// 	Coin,
// 	Field,
// 	// Leaf,
// 	MarketKey,
// 	// Order,
// 	// Orderbook,
// 	OrderInfo,
// 	// PerpetualsMap,
// 	Position,
// 	PositionKey,
// 	Registry,
// 	Vault,
// };
