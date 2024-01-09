import { BCS, getSuiMoveConfig } from "@mysten/bcs";
import {
	AnyObjectType,
	ApiIndexerEventsBody,
	Balance,
	Event,
	IFixed,
	Object,
	ObjectId,
	Percentage,
	SuiAddress,
	Timestamp,
} from "../../general/types/generalTypes";
import { CoinDecimal, CoinType } from "../coin/coinTypes";

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

export const bcs = new BCS(getSuiMoveConfig());

// NOTE: should this be moved elsewhere ?
bcs.registerStructType(["Option", "E"], {
	vec: ["vector", "E"],
});

bcs.registerStructType(["Field", "N", "V"], {
	id: "UID",
	name: "N",
	value: "V",
});

bcs.registerAlias("UID", BCS.ADDRESS);

// =========================================================================
//  Admin
// =========================================================================

export interface PerpetualsAdminCapability extends Object {}

bcs.registerStructType("AdminCapability", {
	id: "UID",
});

// -----------------------------------------

export interface PerpetualsRegistry extends Object {
	activeCollaterals: CoinType[];
}

bcs.registerStructType("Registry", {
	id: "UID",
	activeCollaterals: ["vector", BCS.STRING],
	nextAccountId: BCS.U64,
});

bcs.registerStructType("MarketKey", {
	marketId: BCS.U64,
});

// =========================================================================
//  Clearing House
// =========================================================================

export interface PerpetualsVault extends Object {
	balance: Balance;
	scalingFactor: bigint;
}

bcs.registerStructType(["Vault", "T"], {
	id: "UID",
	collateral_balance: ["Balance", "T"],
	insurance_fund_balance: ["Balance", "T"],
	scalingFactor: BCS.U64,
});

// -----------------------------------------

export interface PerpetualsMarketData extends Object {
	collateralCoinType: CoinType;
	marketParams: PerpetualsMarketParams;
	marketState: PerpetualsMarketState;
}

bcs.registerStructType(["ClearingHouse", "T"], {
	id: "UID",
	marketParams: "MarketParams",
	marketState: "MarketState",
});

// -----------------------------------------

export interface PerpetualsAccountCap extends Object {
	accountId: PerpetualsAccountId;
	collateralCoinType: CoinType;
	collateral: number;
}

export type PerpetualsRawAccountCap = Omit<
	PerpetualsAccountCap,
	"collateral"
> & {
	collateral: Balance;
};

bcs.registerStructType(["Account", "T"], {
	id: "UID",
	accountId: BCS.U64,
	collateral: ["Balance", "T"],
});

// -----------------------------------------

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
}

bcs.registerStructType("Position", {
	collateral: BCS.U256,
	baseAssetAmount: BCS.U256,
	quoteAssetNotionalAmount: BCS.U256,
	cumFundingRateLong: BCS.U256,
	cumFundingRateShort: BCS.U256,
	asksQuantity: BCS.U256,
	bidsQuantity: BCS.U256,
});

bcs.registerStructType("PositionKey", {
	accountId: BCS.U64,
});

// =========================================================================
//  Market
// =========================================================================

export interface PerpetualsMarketParams {
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
	baseAssetSymbol: string;
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
	maxPendingOrdersPerPosition: bigint;
}

bcs.registerStructType("MarketParams", {
	marginRatioInitial: BCS.U256,
	marginRatioMaintenance: BCS.U256,
	baseAssetSymbol: BCS.STRING,
	fundingFrequencyMs: BCS.U64,
	fundingPeriodMs: BCS.U64,
	premiumTwapFrequencyMs: BCS.U64,
	premiumTwapPeriodMs: BCS.U64,
	spreadTwapFrequencyMs: BCS.U64,
	spreadTwapPeriodMs: BCS.U64,
	makerFee: BCS.U256,
	takerFee: BCS.U256,
	liquidationFee: BCS.U256,
	forceCancelFee: BCS.U256,
	insuranceFundFee: BCS.U256,
	minOrderUsdValue: BCS.U256,
	lotSize: BCS.U64,
	tickSize: BCS.U64,
	liquidationTolerance: BCS.U64,
	maxPendingOrdersPerPosition: BCS.U64,
});

// -----------------------------------------

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

bcs.registerStructType("MarketState", {
	cumFundingRateLong: BCS.U256,
	cumFundingRateShort: BCS.U256,
	fundingLastUpdMs: BCS.U64,
	premiumTwap: BCS.U256,
	premiumTwapLastUpdMs: BCS.U64,
	spreadTwap: BCS.U256,
	spreadTwapLastUpdMs: BCS.U64,
	openInterest: BCS.U256,
	feesAccrued: BCS.U256,
});

// -----------------------------------------

export interface PerpetualsMarketPriceDataPoint {
	timestamp: Timestamp;
	high: number;
	low: number;
	open: number;
	close: number;
}
export interface PerpetualsMarketVolumeDataPoint {
	timestamp: Timestamp;
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
	size: bigint;
	side: PerpetualsOrderSide;
	marketId: PerpetualsMarketId;
}

export interface PerpetualsOrderbook extends Object {
	asks: PerpetualsOrderedMap<PerpetualsOrder>;
	bids: PerpetualsOrderedMap<PerpetualsOrder>;
	counter: bigint;
}

bcs.registerStructType("Orderbook", {
	id: "UID",
	asks: ["Map", "Order"],
	bids: ["Map", "Order"],
	counter: BCS.U64,
});

export interface PerpetualsOrder {
	accountId: PerpetualsAccountId;
	size: bigint;
}

bcs.registerStructType("Order", {
	accountId: BCS.U64,
	size: BCS.U64,
});

export interface PerpetualsOrderInfo {
	price: PerpetualsOrderPrice;
	size: bigint;
}

bcs.registerStructType("OrderInfo", {
	price: BCS.U64,
	size: BCS.U64,
});

export interface PerpetualsFillReceipt {
	accountId: PerpetualsAccountId;
	baseAsk: bigint;
	quoteAsk: bigint;
	baseBid: bigint;
	quoteBid: bigint;
	pendingOrders: bigint;
}

bcs.registerStructType("FillReceipt", {
	accountId: BCS.U64,
	baseAsk: BCS.U64,
	quoteAsk: BCS.U128,
	baseBid: BCS.U64,
	quoteBid: BCS.U128,
	pendingOrders: BCS.U64,
});

export interface PerpetualsPostReceipt {
	baseAsk: bigint;
	baseBid: bigint;
	pendingOrders: bigint;
}

bcs.registerStructType("PostReceipt", {
	baseAsk: BCS.U64,
	baseBid: BCS.U64,
	pending_orders: BCS.U64,
});

// -----------------------------------------

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

bcs.registerStructType(["Map", "V"], {
	id: "UID",
	size: BCS.U64,
	counter: BCS.U64,
	root: BCS.U64,
	first: BCS.U64,
	branchMin: BCS.U64,
	branchMax: BCS.U64,
	leafMin: BCS.U64,
	leafMax: BCS.U64,
	branchesMergeMax: BCS.U64,
	leavesMergeMax: BCS.U64,
});

export interface PerpetualsBranch {
	keys: bigint[];
	kids: bigint[];
}

bcs.registerStructType("Branch", {
	keys: ["vector", BCS.U128],
	kids: ["vector", BCS.U64],
});

export interface PerpetualsLeaf<V> {
	keys: bigint[];
	vals: V[];
	next: bigint;
}

bcs.registerStructType(["Leaf", "V"], {
	keys: ["vector", BCS.U128],
	vals: ["vector", "V"],
	next: BCS.U64,
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

export interface DepositedCollateralEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
}

export interface AllocatedCollateralEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
	vaultBalance: Balance;
}

export interface DeallocatedCollateralEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
}

export interface WithdrewCollateralEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
}

export interface SettledFundingEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
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
	| FilledMakerOrderEvent;

// TODO: make all these checks use string value from perps api

export const isWithdrewCollateralEvent = (
	event: Event
): event is WithdrewCollateralEvent => {
	return event.type.toLowerCase().includes("withdrewcollateral");
};

export const isDepositedCollateralEvent = (
	event: Event
): event is DepositedCollateralEvent => {
	return event.type.toLowerCase().includes("depositedcollateral");
};

export const isDeallocatedCollateralEvent = (
	event: Event
): event is DeallocatedCollateralEvent => {
	return event.type.toLowerCase().includes("deallocatedcollateral");
};

export const isAllocatedCollateralEvent = (
	event: Event
): event is AllocatedCollateralEvent => {
	return event.type.toLowerCase().includes("allocatedcollateral");
};

export const isSettledFundingEvent = (
	event: Event
): event is SettledFundingEvent => {
	return event.type.toLowerCase().includes("settledfunding");
};

// =========================================================================
//  Liquidation
// =========================================================================

export interface LiquidatedEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
	liqorAccountId: PerpetualsAccountId;
}

export const isLiquidatedEvent = (event: Event): event is LiquidatedEvent => {
	return event.type.toLowerCase().includes("liquidatedposition");
};

// =========================================================================
//  Account
// =========================================================================

export interface CreatedAccountEvent extends Event {
	collateralCoinType: CoinType;
	user: SuiAddress;
	accountId: PerpetualsAccountId;
}

// =========================================================================
//  Order
// =========================================================================

export interface OrderbookPostReceiptEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	orderId: PerpetualsOrderId;
	size: bigint;
}

export interface OrderbookFillReceiptEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	orderId: PerpetualsOrderId;
	size: bigint;
	dropped: boolean;
}

export interface CanceledOrderEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	orderId: PerpetualsOrderId;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

export interface PostedOrderEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	orderId: PerpetualsOrderId;
	side: PerpetualsOrderSide;
	size: bigint;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

export interface FilledMakerOrderEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	// NOTE: is this the same as base asset amount ?
	// size: bigint;
	// TODO: add this back ?
	// dropped: boolean;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

export interface FilledTakerOrderEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
	marketId: PerpetualsMarketId;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	side: PerpetualsOrderSide;
	baseAssetDelta: IFixed;
	quoteAssetDelta: IFixed;
}

export type PerpetualsOrderEvent =
	| CanceledOrderEvent
	| PostedOrderEvent
	| FilledMakerOrderEvent
	| FilledTakerOrderEvent
	| LiquidatedEvent;

export interface PostedOrderReceiptEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	orderId: PerpetualsOrderId;
	size: bigint;
}

// TODO: make all these checks use string value from perps api

export const isCanceledOrderEvent = (
	event: Event
): event is CanceledOrderEvent => {
	return event.type.toLowerCase().includes("canceledorder");
};

export const isPostedOrderEvent = (event: Event): event is PostedOrderEvent => {
	return event.type.toLowerCase().includes("postedorder");
};

export const isFilledMakerOrderEvent = (
	event: Event
): event is FilledMakerOrderEvent => {
	return event.type.toLowerCase().includes("filledmakerorder");
};

export const isFilledTakerOrderEvent = (
	event: Event
): event is FilledTakerOrderEvent => {
	return event.type.toLowerCase().includes("filledtakerorder");
};

// =========================================================================
//  Twap
// =========================================================================

export interface UpdatedPremiumTwapEvent extends Event {
	collateralCoinType: CoinType;
	marketId: PerpetualsMarketId;
	bookPrice: IFixed;
	indexPrice: IFixed;
	premiumTwap: IFixed;
	premiumTwapLastUpdateMs: number;
}

export interface UpdatedSpreadTwapEvent extends Event {
	collateralCoinType: CoinType;
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
	| ApiPerpetualsLimitOrderBody
	| ApiPerpetualsMarketOrderBody
	| ApiPerpetualsSLTPOrderBody
) & {
	walletAddress: SuiAddress;
	accountId: PerpetualsAccountId;
	lotSize: number;
	tickSize: number;
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
	price?: PerpetualsOrderPrice;
}
export interface ApiPerpetualsExecutionPriceResponse {
	executionPrice: number;
	sizeFilled: number;
	sizePosted: number;
}

export interface ApiPerpetualsHistoricalMarketDataResponse {
	prices: PerpetualsMarketPriceDataPoint[];
	volumes: PerpetualsMarketVolumeDataPoint[];
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
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
}

export interface ApiPerpetualsLimitOrderBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	price: PerpetualsOrderPrice;
	orderType: PerpetualsOrderType;
}

export interface ApiPerpetualsCancelOrderBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	orderId: PerpetualsOrderId;
}

export interface ApiPerpetualsCancelOrdersBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	accountCapId: ObjectId;
	orderDatas: {
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		orderId: PerpetualsOrderId;
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

export type ApiPerpetualsAccountEventsBody = ApiIndexerEventsBody & {
	accountId: PerpetualsAccountId;
};

export type ApiPerpetualsMarketEventsBody = ApiIndexerEventsBody & {
	marketId: PerpetualsMarketId;
};

// =========================================================================
//  SDK
// =========================================================================

export type SdkPerpetualsMarketOrderInputs = Omit<
	ApiPerpetualsMarketOrderBody,
	"accountCapId" | "collateralCoinType"
>;

export type SdkPerpetualsLimitOrderInputs = Omit<
	ApiPerpetualsLimitOrderBody,
	"accountCapId" | "collateralCoinType"
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
