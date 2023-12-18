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
import { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Name Only
// =========================================================================

export type PerpetualsMarketId = bigint;
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
//  Clearing House
// =========================================================================

export interface PerpetualsAdminCapability extends Object {}

bcs.registerStructType("AdminCapability", {
	id: "UID",
});

export interface PerpetualsRegistry extends Object {
	activeCollaterals: CoinType[];
}

bcs.registerStructType("Registry", {
	id: "UID",
	activeCollaterals: ["vector", BCS.STRING],
});

export interface PerpetualsVault extends Object {
	balance: Balance;
	scalingFactor: bigint;
}

bcs.registerStructType(["Vault", "T"], {
	id: "UID",
	balance: ["Balance", "T"],
	scalingFactor: BCS.U64,
});

// export interface InsuranceFunds extends Object {
// 	balances: Balance[];
// 	scaling_factor: bigint;
// }

// TODO: how to register vector<Balance<T>>?
// bcs.registerStructType(["InsuranceFunds", "T"], {
// 	id: "UID",
// 	balances: ["vector", "Balance", "T"],
// 	scalingFactor: BCS.U64,
// });

// =========================================================================
//  Account Manager
// =========================================================================

export interface PerpetualsAccountData {
	accountCap: PerpetualsAccountCap;
	account: PerpetualsAccountObject;
}

export interface PerpetualsAccountManager extends Object {
	maxPositionsPerAccount: bigint;
	maxPendingOrdersPerPosition: bigint;
	nextAccountId: PerpetualsAccountId;
}

bcs.registerStructType("AccountManager", {
	id: "UID",
	maxPositionsPerAccount: BCS.U64,
	maxPendingOrdersPerPosition: BCS.U64,
	nextAccountId: BCS.U64,
});

export interface PerpetualsAccountCap extends Object {
	accountId: PerpetualsAccountId;
	collateralCoinType: CoinType;
}

bcs.registerStructType("AccountCap", {
	id: "UID",
	accountId: BCS.U64,
});

export interface PerpetualsAccountObject {
	collateral: IFixed;
	positions: PerpetualsPosition[];
}

bcs.registerStructType("Account", {
	collateral: BCS.U256,
	marketIds: ["vector", BCS.U64],
	positions: ["vector", "Position"],
});

export interface PerpetualsPosition {
	marketId: PerpetualsMarketId;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	asks: OrderedVecSet;
	bids: OrderedVecSet;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

bcs.registerStructType("Position", {
	baseAssetAmount: BCS.U256,
	quoteAssetNotionalAmount: BCS.U256,
	cumFundingRateLong: BCS.U256,
	cumFundingRateShort: BCS.U256,
	asks: "OrderedVecSet",
	bids: "OrderedVecSet",
	asksQuantity: BCS.U256,
	bidsQuantity: BCS.U256,
});

export interface OrderedVecSet extends Object {}

bcs.registerStructType("OrderedVecSet", {
	id: "UID",
});

bcs.registerStructType("Contents", {
	dummy_field: BCS.BOOL,
});

bcs.registerStructType("AccountKey", {
	accountId: BCS.U64,
});

// =========================================================================
//  Market Manager
// =========================================================================

export interface PerpetualsMarketData {
	marketId: PerpetualsMarketId;
	marketParams: PerpetualsMarketParams;
}

export interface PerpetualsMarketManager extends Object {
	feesAccrued: IFixed;
	liquidationTolerance: bigint;
}

bcs.registerStructType("MarketManager", {
	id: "UID",
	feesAccrued: BCS.U256,
	liquidationTolerance: BCS.U64,
});

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
	insuranceFundId: bigint;
	minOrderUsdValue: IFixed;
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
	insuranceFundId: BCS.U64,
	minOrderUsdValue: BCS.U256,
});

export interface PerpetualsMarketState {
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	fundingLastUpdMs: Timestamp;
	premiumTwap: IFixed;
	premiumTwapLastUpdMs: Timestamp;
	spreadTwap: IFixed;
	spreadTwapLastUpdMs: Timestamp;
	openInterest: IFixed;
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
});

export interface PerpetualsMarginRatioProposal {
	maturity: bigint;
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
}

bcs.registerStructType("MarginRatioProposal", {
	maturity: BCS.U64,
	marginRatioInitial: BCS.U256,
	marginRatioMaintenance: BCS.U256,
});

bcs.registerStructType("MarketKey", {
	marketId: BCS.U64,
});

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
}

export interface PerpetualsOrderbook extends Object {
	lotSize: bigint;
	tickSize: bigint;
	asks: PerpetualsOrderedMap<PerpetualsOrder>;
	bids: PerpetualsOrderedMap<PerpetualsOrder>;
	counter: bigint;
}

bcs.registerStructType("Orderbook", {
	id: "UID",
	lotSize: BCS.U64,
	tickSize: BCS.U64,
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

export interface PerpetualsFillReceipt {
	accountId: PerpetualsAccountId;
	orderId: PerpetualsOrderId;
	size: bigint;
	dropped: boolean;
}

bcs.registerStructType("FillReceipt", {
	accountId: BCS.U64,
	orderId: BCS.U128,
	size: BCS.U64,
	dropped: BCS.BOOL,
});

export interface PerpetualsPostReceipt {
	accountId: PerpetualsAccountId;
	orderId: PerpetualsOrderId;
	size: bigint;
}

bcs.registerStructType("PostReceipt", {
	accountId: BCS.U64,
	orderId: BCS.U128,
	size: BCS.U64,
});

// =========================================================================
//  Events
// =========================================================================

// =========================================================================
//  Collateral
// =========================================================================

export interface WithdrewCollateralEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
}

export interface DepositedCollateralEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
	vault: SuiAddress;
}

export interface SettledFundingEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	collateral: IFixed;
	collateralDelta: IFixed;
	marketIds: PerpetualsMarketId[];
	posFundingRatesLong: IFixed[];
	posFundingRatesShort: IFixed[];
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
	liqorCollateral: IFixed;
}

export interface AcquiredLiqeeEvent extends Event {
	collateralCoinType: CoinType;
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	size: bigint;
	markPrice: IFixed;
}

export const isLiquidatedEvent = (event: Event): event is LiquidatedEvent => {
	return event.type.toLowerCase().includes("liquidated");
};

export const isAcquiredLiqeeEvent = (
	event: Event
): event is AcquiredLiqeeEvent => {
	return event.type.toLowerCase().includes("acquiredliqee");
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
	orderId: PerpetualsOrderId;
	side: PerpetualsOrderSide;
	size: bigint;
	dropped: boolean;
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
	| AcquiredLiqeeEvent;

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
			accountAfterOrder: PerpetualsAccountObject;
			priceSlippage: number;
			percentSlippage: Percentage;
			filledSize: number;
			filledSizeUsd: number;
			postedSize: number;
			postedSizeUsd: number;
	  };

export interface ApiPerpetualsPositionOrderDatasBody {
	positionAsksId: ObjectId;
	positionBidsId: ObjectId;
}

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
	tickSize: number;
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
