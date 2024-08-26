import { BcsType, bcs } from "@mysten/sui/bcs";
import {
	AnyObjectType,
	ApiDataWithCursorBody,
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

function Field<N extends BcsType<any>, V extends BcsType<any>>(
	name: N,
	value: V
) {
	return bcs.struct("Field", { name, value });
}

// =========================================================================
//  Admin
// =========================================================================

export interface PerpetualsAdminCapability extends Object {}

const AdminCapability = bcs.struct("AdminCapability", {
	id: bcs.Address,
});

export interface PerpetualsRegistry extends Object {
	activeCollaterals: CoinType[];
}

const Registry = bcs.struct("Registry", {
	id: bcs.Address,
	activeCollaterals: bcs.vector(bcs.string()),
	nextAccountId: bcs.u64(),
});

const MarketKey = bcs.struct("MarketKey", {
	marketId: bcs.u64(),
});

// =========================================================================
//  Clearing House
// =========================================================================

export interface PerpetualsVault extends Object {
	balance: Balance;
	scalingFactor: bigint;
}

const BalanceStruct = bcs.struct("Balance", { value: bcs.u64() });

const Coin = bcs.struct("Coin", {
	id: bcs.Address,
	balance: BalanceStruct,
});

const Vault = bcs.struct("Vault", {
	id: bcs.Address,
	collateral_balance: BalanceStruct,
	insurance_fund_balance: BalanceStruct,
	scalingFactor: bcs.u64(),
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

const Account = bcs.struct("Account", {
	id: bcs.Address,
	accountId: bcs.u64(),
	collateral: BalanceStruct,
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
	leverage: number;
}

const Position = bcs.struct("Position", {
	collateral: bcs.u256(),
	baseAssetAmount: bcs.u256(),
	quoteAssetNotionalAmount: bcs.u256(),
	cumFundingRateLong: bcs.u256(),
	cumFundingRateShort: bcs.u256(),
	asksQuantity: bcs.u256(),
	bidsQuantity: bcs.u256(),
	pendingOrders: bcs.u64(),
	makerFee: bcs.u256(),
	takerFee: bcs.u256(),
});

const PositionKey = bcs.struct("PositionKey", {
	accountId: bcs.u64(),
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

const Order = bcs.struct("Order", {
	accountId: bcs.u64(),
	size: bcs.u64(),
});

const Orderbook = bcs.struct("Orderbook", {
	id: bcs.Address,
	asks: PerpetualsMap(Order),
	bids: PerpetualsMap(Order),
	counter: bcs.u64(),
});

export interface PerpetualsOrder {
	accountId: PerpetualsAccountId;
	size: bigint;
}

export interface PerpetualsOrderInfo {
	price: PerpetualsOrderPrice;
	size: bigint;
}

const OrderInfo = bcs.struct("OrderInfo", {
	price: bcs.u64(),
	size: bcs.u64(),
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

function PerpetualsMap<T extends BcsType<any>>(T: T) {
	return bcs.struct("Map", {
		id: bcs.Address,
		size: bcs.u64(),
		counter: bcs.u64(),
		root: bcs.u64(),
		first: bcs.u64(),
		branchMin: bcs.u64(),
		branchMax: bcs.u64(),
		leafMin: bcs.u64(),
		leafMax: bcs.u64(),
		branchesMergeMax: bcs.u64(),
		leavesMergeMax: bcs.u64(),
	});
}

export interface PerpetualsBranch {
	keys: bigint[];
	kids: bigint[];
}

export const Branch = bcs.struct("Branch", {
	keys: bcs.vector(bcs.u128()),
	kids: bcs.vector(bcs.u64()),
});

export interface PerpetualsLeaf<V> {
	keys: bigint[];
	vals: V[];
	next: bigint;
}

export function Leaf<V extends BcsType<any>>(V: V) {
	return bcs.struct("Leaf", {
		keys: bcs.vector(bcs.u128()),
		vals: bcs.vector(V),
		next: bcs.u64(),
	});
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
//  Collateral
// =========================================================================

export interface PerpetualsAccountCollateralChangesWithCursor {
	collateralChanges: PerpetualsAccountCollateralChange[];
	nextCursor: Timestamp | undefined;
}

export type PerpetualsAccountCollateralChange = {
	timestamp: Timestamp;
	txDigest: TransactionDigest;
	// marketId: PerpetualsMarketId;
	eventType: AnyObjectType;
	collateralChange: number;
	collateralChangeUsd: number;
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

export type ApiPerpetualsAccountOrderHistoryBody =
	ApiDataWithCursorBody<Timestamp>;

export type ApiPerpetualsAccountCollateralHistoryBody =
	ApiDataWithCursorBody<Timestamp>;

export interface ApiPerpetualsSetPositionLeverageBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

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

export interface ApiPerpetualsPreviewCancelOrdersBody {
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
			collateralToDeallocate: Balance;
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

export interface ApiPerpetualsMarket24hrVolumeResponse {
	volumeUsd: number;
	volumeBaseAssetAmount: number;
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

export const perpetualsRegistry = {
	Account,
	AdminCapability,
	BalanceStruct,
	Branch,
	Coin,
	Field,
	Leaf,
	MarketKey,
	Order,
	Orderbook,
	OrderInfo,
	PerpetualsMap,
	Position,
	PositionKey,
	Registry,
	Vault,
};
