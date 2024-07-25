import { bcsRegistry } from "@mysten/sui.js/bcs";
import {
	AnyObjectType,
	ApiIndexerEventsBody,
	Balance,
	Event,
	IFixed,
	Object,
	ObjectDigest,
	ObjectId,
	ObjectVersion,
	Percentage,
	SuiAddress,
	Timestamp,
	TransactionDigest,
} from "../../general/types/generalTypes";
import { CoinDecimal, CoinSymbol, CoinType } from "../coin/coinTypes";

// =========================================================================
//  Name Only
// =========================================================================

export type PerpetualsMarketId = ObjectId;
export type PerpetualsAccountId = bigint;
export type PerpetualsOrderId = bigint;
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

export const perpetualsBcsRegistry: typeof bcsRegistry = bcsRegistry;

perpetualsBcsRegistry.registerStructType(["Field", "N", "V"], {
	id: "UID",
	name: "N",
	value: "V",
});

perpetualsBcsRegistry.registerAlias("UID", "address");

// =========================================================================
//  Admin
// =========================================================================

export interface PerpetualsAdminCapability extends Object {}

perpetualsBcsRegistry.registerStructType("AdminCapability", {
	id: "UID",
});

export interface PerpetualsRegistry extends Object {
	activeCollaterals: CoinType[];
}

perpetualsBcsRegistry.registerStructType("Registry", {
	id: "UID",
	activeCollaterals: ["vector", "string"],
	nextAccountId: "u64",
});

perpetualsBcsRegistry.registerStructType("MarketKey", {
	marketId: "u64",
});

// =========================================================================
//  Clearing House
// =========================================================================

export interface PerpetualsVault extends Object {
	balance: Balance;
	scalingFactor: bigint;
}

perpetualsBcsRegistry.registerStructType(["Balance", "T"], {
	value: "u64",
});

perpetualsBcsRegistry.registerStructType(["Coin", "T"], {
	id: "UID",
	balance: ["Balance", "T"],
});

perpetualsBcsRegistry.registerStructType(["Vault", "T"], {
	id: "UID",
	collateral_balance: ["Balance", "T"],
	insurance_fund_balance: ["Balance", "T"],
	scalingFactor: "u64",
});

export interface PerpetualsMarketData {
	objectId: ObjectId;
	initialSharedVersion: ObjectVersion;
	collateralCoinType: CoinType;
	marketParams: PerpetualsMarketParams;
	marketState: PerpetualsMarketState;
}

export interface PerpetualsAccountCap extends Object {
	accountId: PerpetualsAccountId;
	collateralCoinType: CoinType;
	collateral: IFixed;
	collateralDecimals: CoinDecimal;
	objectVersion: ObjectVersion;
	objectDigest: ObjectDigest;
}

export type PerpetualsRawAccountCap = Omit<
	PerpetualsAccountCap,
	"collateral" | "collateralDecimals"
> & {
	collateral: Balance;
};

perpetualsBcsRegistry.registerStructType(["Account", "T"], {
	id: "UID",
	accountId: "u64",
	collateral: ["Balance", "T"],
});

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
}

perpetualsBcsRegistry.registerStructType("Position", {
	collateral: "u256",
	baseAssetAmount: "u256",
	quoteAssetNotionalAmount: "u256",
	cumFundingRateLong: "u256",
	cumFundingRateShort: "u256",
	asksQuantity: "u256",
	bidsQuantity: "u256",
	pendingOrders: "u64",
	makerFee: "u256",
	takerFee: "u256",
});

perpetualsBcsRegistry.registerStructType("PositionKey", {
	accountId: "u64",
});

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
	oracleTolerance: bigint;
}

export interface PerpetualsMarketState {
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	fundingLastUpdMs: Timestamp;
	premiumTwap: IFixed;
	premiumTwapLastUpdMs: Timestamp;
	spreadTwap: IFixed;
	spreadTwapLastUpdMs: Timestamp;
	openInterest: IFixed;
	feesAccrued: IFixed;
}

export interface PerpetualsMarketCandleDataPoint {
	timestamp: Timestamp;
	high: number;
	low: number;
	open: number;
	close: number;
	volume: number;
}

// =========================================================================
//  Orderbook
// =========================================================================

export interface OrderbookDataPoint {
	price: number;
	size: number;
	totalSize: number;
	sizeUsd: number;
	totalSizeUsd: number;
}

export interface PerpetualsOrderbookState {
	bids: OrderbookDataPoint[];
	asks: OrderbookDataPoint[];
	minAskPrice: number;
	maxBidPrice: number;
}

export interface PerpetualsOrderData {
	orderId: PerpetualsOrderId;
	initialSize: bigint;
	filledSize: bigint;
	side: PerpetualsOrderSide;
	marketId: PerpetualsMarketId;
}

export interface PerpetualsFilledOrderData {
	size: number;
	price: number;
}

export interface PerpetualsOrderbook extends Object {
	asks: PerpetualsOrderedMap<PerpetualsOrder>;
	bids: PerpetualsOrderedMap<PerpetualsOrder>;
	counter: bigint;
}

perpetualsBcsRegistry.registerStructType("Orderbook", {
	id: "UID",
	asks: ["Map", "Order"],
	bids: ["Map", "Order"],
	counter: "u64",
});

export interface PerpetualsOrder {
	accountId: PerpetualsAccountId;
	size: bigint;
}

perpetualsBcsRegistry.registerStructType("Order", {
	accountId: "u64",
	size: "u64",
});

export interface PerpetualsOrderInfo {
	price: PerpetualsOrderPrice;
	size: bigint;
}

perpetualsBcsRegistry.registerStructType("OrderInfo", {
	price: "u64",
	size: "u64",
});

export interface PerpetualsOrderedMap<T> extends Object {
	size: bigint;
	counter: bigint;
	root: bigint;
	first: bigint;
	branchMin: bigint;
	branchMax: bigint;
	leafMin: bigint;
	leafMax: bigint;
	branchesMergeMax: bigint;
	leavesMergeMax: bigint;
}

perpetualsBcsRegistry.registerStructType(["Map", "V"], {
	id: "UID",
	size: "u64",
	counter: "u64",
	root: "u64",
	first: "u64",
	branchMin: "u64",
	branchMax: "u64",
	leafMin: "u64",
	leafMax: "u64",
	branchesMergeMax: "u64",
	leavesMergeMax: "u64",
});

export interface PerpetualsBranch {
	keys: bigint[];
	kids: bigint[];
}

perpetualsBcsRegistry.registerStructType("Branch", {
	keys: ["vector", "u128"],
	kids: ["vector", "u64"],
});

export interface PerpetualsLeaf<V> {
	keys: bigint[];
	vals: V[];
	next: bigint;
}

perpetualsBcsRegistry.registerStructType(["Leaf", "V"], {
	keys: ["vector", "u128"],
	vals: ["vector", "V"],
	next: "u64",
});

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
//  Collateral
// =========================================================================

export interface PerpetualsAccountCollateralChangesWithCursor {
	collateralChanges: PerpetualsAccountCollateralChange[];
	nextCursor: Timestamp | undefined;
}

export interface PerpetualsAccountCollateralChange {
	timestamp: Timestamp;
	txDigest: TransactionDigest;
	marketId: PerpetualsMarketId;
	eventType: AnyObjectType;
	collateralChange: number;
	collateralChangeUsd: number;
}

export interface DepositedCollateralEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

export interface AllocatedCollateralEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
	positionCollateralAfter: IFixed;
}

export interface DeallocatedCollateralEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
	positionCollateralAfter: IFixed;
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
	| FilledMakerOrderEvent
	| AllocatedCollateralEvent
	| DeallocatedCollateralEvent;

// TODO: make all these checks use string value from perps api

export const isWithdrewCollateralEvent = (
	event: Event
): event is WithdrewCollateralEvent => {
	return event.type.toLowerCase().endsWith("::withdrewcollateral");
};

export const isDepositedCollateralEvent = (
	event: Event
): event is DepositedCollateralEvent => {
	return event.type.toLowerCase().endsWith("::depositedcollateral");
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
	size: bigint;
	markPrice: IFixed;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
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

export interface PerpetualsAccountOrderEventsWithCursor {
	events: PerpetualsOrderEvent[];
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

export interface FilledMakerOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: IFixed;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	orderId: PerpetualsOrderId;
	dropped: boolean;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

export interface FilledTakerOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: IFixed;
	marketId: PerpetualsMarketId;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	side: PerpetualsOrderSide;
	baseAssetDelta: IFixed;
	quoteAssetDelta: IFixed;
	liquidatedVolume: IFixed;
}

export type PerpetualsOrderEvent =
	| CanceledOrderEvent
	// | PostedOrderEvent
	| PostedOrderReceiptEvent
	| FilledMakerOrderEvent
	| FilledTakerOrderEvent
	| LiquidatedEvent;

export interface PostedOrderReceiptEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	orderId: PerpetualsOrderId;
	size: bigint;
	side: PerpetualsOrderSide;
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

export const isFilledMakerOrderEvent = (
	event: Event
): event is FilledMakerOrderEvent => {
	return event.type.toLowerCase().endsWith("::filledmakerorder");
};

export const isFilledTakerOrderEvent = (
	event: Event
): event is FilledTakerOrderEvent => {
	return event.type.toLowerCase().endsWith("::filledtakerorder");
};

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

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Objects
// =========================================================================

export interface ApiPerpetualsAccountsBody {
	walletAddress: SuiAddress;
}

// =========================================================================
//  Inspections
// =========================================================================

export type ApiPerpetualsPreviewOrderBody = (
	| Omit<
			ApiPerpetualsLimitOrderBody,
			| "collateralChange"
			| "walletAddress"
			| "accountObjectId"
			| "accountObjectVersion"
			| "accountObjectDigest"
	  >
	| Omit<
			ApiPerpetualsMarketOrderBody,
			| "collateralChange"
			| "walletAddress"
			| "accountObjectId"
			| "accountObjectVersion"
			| "accountObjectDigest"
	  >
	| Omit<
			ApiPerpetualsSLTPOrderBody,
			| "collateralChange"
			| "walletAddress"
			| "accountObjectId"
			| "accountObjectVersion"
			| "accountObjectDigest"
	  >
) & {
	// TODO: remove eventually ?
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	lotSize: number;
	tickSize: number;
	leverage: number;
	// NOTE: do we need this ?
	// isClose?: boolean;
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

export interface ApiPerpetualsOrderbookStateBody {
	orderbookPrice: number;
	lotSize: number;
	tickSize: number;
	priceBucketSize: number;
}

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
	accountId: PerpetualsAccountId;
	collateral: Balance;
	side: PerpetualsOrderSide;
	leverage: number;
	price?: PerpetualsOrderPrice;
}

export interface ApiPerpetualsAccountOrderDatasBody {
	orderDatas: {
		orderId: PerpetualsOrderId;
		marketId: PerpetualsMarketId;
		currentSize: bigint;
	}[];
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

export interface ApiPerpetualsMarketOrderBody {
	walletAddress: SuiAddress;
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	accountObjectVersion: number;
	accountObjectDigest: ObjectId;
	side: PerpetualsOrderSide;
	size: bigint;
	collateralChange: Balance;
	hasPosition: boolean;
}

export interface ApiPerpetualsLimitOrderBody {
	walletAddress: SuiAddress;
	marketId: PerpetualsMarketId;
	accountObjectId: ObjectId;
	accountObjectVersion: number;
	accountObjectDigest: ObjectId;
	side: PerpetualsOrderSide;
	size: bigint;
	price: PerpetualsOrderPrice;
	orderType: PerpetualsOrderType;
	collateralChange: Balance;
	hasPosition: boolean;
}

export interface ApiPerpetualsCancelOrderBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	marketInitialSharedVersion: ObjectVersion;
	orderId: PerpetualsOrderId;
	collateral: Balance;
	basePriceFeedId: ObjectId;
	collateralPriceFeedId: ObjectId;
}

export interface ApiPerpetualsCancelOrdersBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	orderDatas: {
		orderId: PerpetualsOrderId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		collateral: Balance;
		basePriceFeedId: ObjectId;
		collateralPriceFeedId: ObjectId;
	}[];
}

export type ApiPerpetualsSLTPOrderBody = (
	| (ApiPerpetualsMarketOrderBody & {
			marketPrice: PerpetualsOrderPrice;
	  })
	| ApiPerpetualsLimitOrderBody
) &
	(
		| {
				slPrice: PerpetualsOrderPrice;
		  }
		| {
				tpPrice: PerpetualsOrderPrice;
		  }
		| {
				slPrice: PerpetualsOrderPrice;
				tpPrice: PerpetualsOrderPrice;
		  }
	);

export interface ApiPerpetualsMarket24hrVolumeResponse {
	volumeBaseAssetAmount: number;
	volumeUsd: number;
}

// =========================================================================
//  SDK
// =========================================================================

export type SdkPerpetualsMarketOrderInputs = Omit<
	ApiPerpetualsMarketOrderBody,
	"accountObjectId" | "accountObjectVersion" | "accountObjectDigest"
>;

export type SdkPerpetualsLimitOrderInputs = Omit<
	ApiPerpetualsLimitOrderBody,
	"accountObjectId" | "accountObjectVersion" | "accountObjectDigest"
>;

export type SdkPerpetualsSLTPOrderInputs = (
	| (SdkPerpetualsMarketOrderInputs & {
			marketPrice: PerpetualsOrderPrice;
	  })
	| SdkPerpetualsLimitOrderInputs
) &
	(
		| {
				slPrice: PerpetualsOrderPrice;
		  }
		| {
				tpPrice: PerpetualsOrderPrice;
		  }
		| {
				slPrice: PerpetualsOrderPrice;
				tpPrice: PerpetualsOrderPrice;
		  }
	);
