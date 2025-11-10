import { BcsType, bcs } from "@mysten/sui/bcs";
import {
	AnyObjectType,
	ApiDataWithCursorBody,
	ApiIndexerEventsBody,
	Balance,
	Byte,
	Event,
	IFixed,
	IFixedAsString,
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
	// initialSharedVersion: ObjectVersion;
	collateralCoinType: CoinType;
	marketParams: PerpetualsMarketParams;
	marketState: PerpetualsMarketState;
	collateralPrice: number;
	indexPrice: number;
	estimatedFundingRate: Percentage;
	nextFundingTimestampMs: bigint;
}

export interface PerpetualsAccountCap {
	objectId: ObjectId;
	walletAddress: SuiAddress;
	accountId: PerpetualsAccountId;
	accountObjectId: ObjectId;
	collateralCoinType: CoinType;
	collateral: number;
	collateralDecimals: CoinDecimal;
	objectVersion: ObjectVersion;
	objectDigest: ObjectDigest;
	// subAccount: PerpetualsSubAccount;
}

export interface PerpetualsVaultCap {
	vaultId: ObjectId;
	objectId: ObjectId;
	ownerAddress: SuiAddress;
}

// TODO: rename
export type PerpetualsVaultCapExtended = {
	vaultId: ObjectId;
	ownerAddress: SuiAddress;
	accountId: PerpetualsAccountId;
	accountObjectId: ObjectId;
	collateralCoinType: CoinType;
	collateralDecimals: CoinDecimal;
};

export interface PerpetualsPosition {
	collateral: number;
	baseAssetAmount: number;
	quoteAssetNotionalAmount: number;
	cumFundingRateLong: number;
	cumFundingRateShort: number;
	asksQuantity: number;
	bidsQuantity: number;
	// collateralCoinType: CoinType;
	marketId: PerpetualsMarketId;
	pendingOrders: {
		orderId: PerpetualsOrderId;
		side: PerpetualsOrderSide;
		size: bigint;
	}[];
	makerFee: number;
	takerFee: number;
	leverage: number;
	collateralUsd: number;
	marginRatio: number;
	freeMarginUsd: number;
	freeCollateral: number;
	unrealizedFundingsUsd: number;
	unrealizedPnlUsd: number;
	entryPrice: number;
	liquidationPrice: number;
}

// export interface PerpetualsSubAccount {
// 	accountId: PerpetualsAccountId;
// 	collateralCoinType: CoinType;
// 	collateral: number;
// 	objectVersion: ObjectVersion;
// 	// objectDigest: ObjectDigest;
// 	objectId: ObjectId;
// }

// =========================================================================
//  Market
// =========================================================================

export interface PerpetualsMarketParams {
	marginRatioInitial: number;
	marginRatioMaintenance: number;
	baseAssetSymbol: CoinSymbol;
	basePriceFeedId: ObjectId;
	collateralPriceFeedId: ObjectId;
	fundingFrequencyMs: bigint;
	fundingPeriodMs: bigint;
	premiumTwapFrequencyMs: bigint;
	premiumTwapPeriodMs: bigint;
	spreadTwapFrequencyMs: bigint;
	spreadTwapPeriodMs: bigint;
	gasPriceTwapPeriodMs: bigint;
	makerFee: number;
	takerFee: number;
	liquidationFee: number;
	forceCancelFee: number;
	insuranceFundFee: number;
	minOrderUsdValue: number;
	lotSize: bigint;
	tickSize: bigint;
	scalingFactor: number;
	gasPriceTakerFee: number;
	zScoreThreshold: number;
	maxPendingOrders: bigint;
	baseOracleTolerance: bigint;
	collateralOracleTolerance: bigint;
	maxOpenInterest: number;
	maxOpenInterestThreshold: number;
	maxOpenInterestPositionPercent: number;
}

export interface PerpetualsMarketState {
	cumFundingRateLong: number;
	cumFundingRateShort: number;
	fundingLastUpdateTimestamp: Timestamp;
	premiumTwap: number;
	premiumTwapLastUpdateTimestamp: Timestamp;
	spreadTwap: number;
	spreadTwapLastUpdateTimestamp: Timestamp;
	openInterest: number;
	feesAccrued: number;
	// nextFundingTimestamp: Timestamp;
	// estimatedFundingRate: Percentage;
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

export interface PerpetualsOrderbookItem {
	size: number;
	price: number;
}

export interface PerpetualsOrderbook {
	bids: PerpetualsOrderbookItem[];
	asks: PerpetualsOrderbookItem[];
	asksTotalSize: number;
	bidsTotalSize: number;
	bestBidPrice: number | undefined;
	bestAskPrice: number | undefined;
	midPrice: number | undefined;
	nonce: bigint;
}

export interface PerpetualsOrderbookDeltas {
	bidsDeltas: PerpetualsOrderbookItem[];
	asksDeltas: PerpetualsOrderbookItem[];
	asksTotalSizeDelta: number;
	bidsTotalSizeDelta: number;
	nonce: bigint;
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
	marketId: PerpetualsMarketId;
	size: bigint;
	side: PerpetualsOrderSide;
	expiryTimestamp?: bigint;
	limitOrder?: {
		price: bigint;
		orderType: PerpetualsOrderType;
	};
	slTp?: {
		stopLossIndexPrice?: number;
		takeProfitIndexPrice?: number;
		// forPositionSide: PerpetualsOrderSide;
	};
	nonSlTp?: {
		stopIndexPrice: number;
		triggerIfGeStopIndexPrice: boolean;
		reduceOnly: boolean;
	};
}

export interface PerpetualsFilledOrderData {
	size: number;
	price: number;
}

export interface PerpetualsOrderInfo {
	price: number;
	size: bigint;
}
export interface PerpetualsAccountData {
	accountCap: PerpetualsAccountCap;
	account: PerpetualsAccountObject;
}

export interface PerpetualsAccountObject {
	accountId: PerpetualsAccountId;
	totalEquityUsd: number;
	availableCollateral: number;
	availableCollateralUsd: number;
	totalUnrealizedFundingsUsd: number;
	totalUnrealizedPnlUsd: number;
	positions: PerpetualsPosition[];
}

export interface PerpetualsVaultObject {
	// TODO: add owner

	/// Unique identifier for distinct network identification.
	objectId: ObjectId;
	/// Contract version number for controlled upgrades.
	version: bigint;
	/// Supply of LP coins from a `TreasuryCap` for liquidity integrity.
	lpSupply: Balance;
	/// Total balance of underlying Coin (`C`), deposited by users.
	collateral: Balance;
	/// IDs of `ClearingHouse` where `Vault` has positions.
	marketIds: PerpetualsMarketId[];
	/// A linked table that keeps track of pending withdrawal requests made by users.
	withdrawQueue: PerpetualsVaultWithdrawRequest[];
	/// Vault parameters
	parameters: {
		/// Lock-in duration for engaged assets in milliseconds.
		lockPeriodMs: bigint;
		/// Fee rate for vault's owner, collected from user's profits when they withdraw
		ownerFeePercentage: number;
		/// Delay period to wait for eventual force withdrawing
		forceWithdrawDelayMs: bigint;
		/// Price feed storage id idetifying the oracle price for `C`
		collateralPriceFeedStorageId: ObjectId;
		/// Scaling factor to apply to `C` to convert a balance to ifixed.
		/// Used to calculate user's minimum deposit value in usd
		scalingFactor: number;
		/// The maximum number of distinct `ClearingHouse`.
		maxMarketsInVault: bigint;
		/// The maximum number of pending orders allowed for a single position in the `Vault`.
		maxPendingOrdersPerPosition: bigint;
	};
	accountId: PerpetualsAccountId;
	accountObjectId: ObjectId;
}

export interface PerpetualsVaultWithdrawRequest {
	/// The address of the user that created the withdraw request
	userAddress: SuiAddress;
	/// The amount of the shares requested for withdrawal.
	lpAmountOut: Balance;
	/// Timestamp of request's creation
	requestTimestamp: Timestamp;
	/// The minimum amount of the balance expected as output for this withdrawal
	minLpAmountOut: Balance;
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
	price: number;
	size: number;
};

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
	collateralDeltaUsd: number;
	marketId: PerpetualsMarketId;
	marketFundingRateLong: number;
	marketFundingRateShort: number;
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
	collateralDeltaUsd: number;
	liqorAccountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	baseLiquidated: number;
	quoteLiquidated: number;
	liqeePnlUsd: number;
	liquidationFeesUsd: number;
	forceCancelFeesUsd: number;
	insuranceFundFeesUsd: number;
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

// export interface CreatedSubAccountEvent extends Event {
// 	accountId: PerpetualsAccountId;
// 	subAccountId: ObjectId;
// }

// export interface SetSubAccountUsersEvent extends Event {
// 	accountId: PerpetualsAccountId;
// 	subAccountId: ObjectId;
// }

export interface SetPositionInitialMarginRatioEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	// NOTE: should this be made into string ?
	initialMarginRatio: number;
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
	orderId: PerpetualsOrderId;
	size: bigint;
	// TODO: change to `isReduceOnly` ?
	reduceOnly: boolean;
	expiryTimestamp?: bigint;
}

export interface FilledMakerOrdersEvent extends Event {
	events: FilledMakerOrderEventFields[];
}

export interface FilledMakerOrderEventFields {
	accountId: PerpetualsAccountId;
	takerAccountId: PerpetualsAccountId;
	collateralDeltaUsd: number;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	sizeRemaining: bigint;
	orderId: PerpetualsOrderId;
	dropped: boolean;
	pnlUsd: number;
	feesUsd: number;
	canceledSize: bigint;
}

export interface FilledTakerOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: number;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	baseAssetDelta: number;
	quoteAssetDelta: number;
	takerPnlUsd: number;
	takerFeesUsd: number;
}

export type PerpetualsOrderEvent =
	| CanceledOrderEvent
	| PostedOrderEvent
	| PostedOrderEvent
	| FilledMakerOrdersEvent
	| FilledTakerOrderEvent
	| LiquidatedEvent
	| ReducedOrderEvent;

export interface PostedOrderEvent extends Event {
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
	stopOrderType: PerpetualsStopOrderType;
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
	bookPrice: number;
	indexPrice: number;
	premiumTwap: number;
	premiumTwapLastUpdateMs: number;
}

export interface UpdatedSpreadTwapEvent extends Event {
	marketId: PerpetualsMarketId;
	bookPrice: number;
	indexPrice: number;
	spreadTwap: number;
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
	cumFundingRateLong: number;
	cumFundingRateShort: number;
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

// export type ApiPerpetualsPreviewOrderBody = (
// 	| Omit<
// 			ApiPerpetualsLimitOrderBody,
// 			| "collateralChange"
// 			| "walletAddress"
// 			| "hasPosition"
// 			| "txKind"
// 			| "accountId"
// 			| "slTp"
// 	  >
// 	| Omit<
// 			ApiPerpetualsMarketOrderBody,
// 			| "collateralChange"
// 			| "walletAddress"
// 			| "hasPosition"
// 			| "txKind"
// 			| "accountId"
// 			| "slTp"
// 	  >
// ) & {
// 	// TODO: remove eventually ?
// 	accountObjectId: ObjectId | undefined;
// 	collateralCoinType: CoinType;
// 	lotSize: number;
// 	tickSize: number;
// 	leverage?: number;
// 	// NOTE: do we need this ?
// 	// isClose?: boolean;
// };

export type ApiPerpetualsPreviewPlaceMarketOrderBody = Omit<
	ApiPerpetualsMarketOrderBody,
	| "collateralChange"
	| "walletAddress"
	| "hasPosition"
	| "txKind"
	| "accountId"
	| "slTp"
> & {
	// collateralCoinType: CoinType;
	leverage?: number;
	// NOTE: do we need this ?
	// isClose?: boolean;
} & (
		| {
				// TODO: remove eventually ?
				accountId: PerpetualsAccountId | undefined;
		  }
		| {
				// TODO: remove eventually ?
				vaultId: ObjectId | undefined;
		  }
	);

export type ApiPerpetualsPreviewPlaceLimitOrderBody = Omit<
	ApiPerpetualsLimitOrderBody,
	| "collateralChange"
	| "walletAddress"
	| "hasPosition"
	| "txKind"
	| "accountId"
	| "slTp"
> & {
	// collateralCoinType: CoinType;
	leverage?: number;
	// NOTE: do we need this ?
	// isClose?: boolean;
} & (
		| {
				// TODO: remove eventually ?
				accountId: PerpetualsAccountId | undefined;
		  }
		| {
				// TODO: remove eventually ?
				vaultId: ObjectId | undefined;
		  }
	);

export type ApiPerpetualsPreviewCancelOrdersBody = {
	// TODO: remove eventually ?
	// collateralCoinType: CoinType;
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
		}
	>;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

// export type ApiPerpetualsPreviewReduceOrderBody = {
// 	marketId: PerpetualsMarketId;
// 	leverage?: number;
// 	orderId: PerpetualsOrderId;
// 	sizeToSubtract: bigint;
// 	// TODO: remove eventually ?
// 	// collateralCoinType: CoinType;
// } & (
// 	| {
// 			accountId: PerpetualsAccountId;
// 	  }
// 	| {
// 			vaultId: ObjectId;
// 	  }
// );

export type ApiPerpetualsPreviewSetLeverageBody = {
	marketId: PerpetualsMarketId;
	leverage: number;
	// collateralCoinType: CoinType;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

// export type ApiPerpetualsPreviewReduceOrderResponse =
// 	| {
// 			error: string;
// 	  }
// 	| {
// 			positionAfterReduceOrder: PerpetualsPosition;
// 			collateralChange: number;
// 	  };

export type ApiPerpetualsPreviewSetLeverageResponse =
	| {
			error: string;
	  }
	| {
			positionAfterSetLeverage: PerpetualsPosition;
			collateralChange: number;
	  };

export type ApiPerpetualsPreviewPlaceOrderResponse =
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
	price?: number;
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
	side: PerpetualsOrderSide;
	leverage?: number;
	price?: number;
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
	collateralCoinType: CoinType;
	txKind?: SerializedTransaction;
	isSponsoredTx?: boolean;
} & (
	| {
			depositAmount: Balance;
	  }
	| {
			depositCoinArg: TransactionObjectArgument;
	  }
) &
	(
		| {
				accountId: PerpetualsAccountId;
		  }
		| {
				vaultId: ObjectId;
		  }
	);

export type ApiPerpetualsWithdrawCollateralBody = {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	withdrawAmount: Balance;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export interface ApiPerpetualsWithdrawCollateralResponse {
	txKind: SerializedTransaction;
	coinOutArg: TransactionObjectArgument | undefined;
}

export interface ApiPerpetualsTransferCollateralBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	fromAccountId: PerpetualsAccountId;
	toAccountId: PerpetualsAccountId;
	transferAmount: Balance;
	txKind?: SerializedTransaction;
}

export type ApiPerpetualsAllocateCollateralBody = {
	marketId: PerpetualsMarketId;
	allocateAmount: Balance;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export type ApiPerpetualsDeallocateCollateralBody = {
	marketId: PerpetualsMarketId;
	deallocateAmount: Balance;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export interface SdkPerpetualsPlaceStopOrdersInputs {
	stopOrders: Omit<PerpetualsStopOrderData, "objectId">[];
	tx?: Transaction;
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
}

export type ApiPerpetualsPlaceStopOrdersBody = {
	walletAddress: SuiAddress;
	stopOrders: Omit<PerpetualsStopOrderData, "objectId">[];
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export type SdkPerpetualsPlaceSlTpOrdersInputs = {
	marketId: PerpetualsMarketId;
	size?: bigint;
	stopLossIndexPrice?: number;
	takeProfitIndexPrice?: number;
	tx?: Transaction;
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
};
// & (
// 	| {
// 			stopLossIndexPrice: number;
// 			takeProfitIndexPrice: number;
// 	  }
// 	| {
// 			stopLossIndexPrice: number;
// 	  }
// 	| {
// 			takeProfitIndexPrice: number;
// 	  }
// );

export type ApiPerpetualsPlaceSlTpOrdersBody = {
	marketId: PerpetualsMarketId;
	walletAddress: SuiAddress;
	positionSide: PerpetualsOrderSide;
	size?: bigint;
	stopLossIndexPrice?: number;
	takeProfitIndexPrice?: number;
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
	leverage?: number;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);
// & (
// 	| {
// 			stopLossIndexPrice: number;
// 			takeProfitIndexPrice: number;
// 	  }
// 	| {
// 			stopLossIndexPrice: number;
// 	  }
// 	| {
// 			takeProfitIndexPrice: number;
// 	  }
// );

export type ApiPerpetualsEditStopOrdersBody = {
	stopOrders: PerpetualsStopOrderData[];
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export type ApiPerpetualsMarketOrderBody = {
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	collateralChange: number;
	hasPosition: boolean;
	reduceOnly: boolean;
	leverage?: number;
	slTp?: {
		walletAddress: SuiAddress;
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		size?: bigint;
		stopLossIndexPrice?: number;
		takeProfitIndexPrice?: number;
	};
	// & (
	// 	| {
	// 			stopLossIndexPrice: number;
	// 			takeProfitIndexPrice: number;
	// 	  }
	// 	| {
	// 			stopLossIndexPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitIndexPrice: number;
	// 	  }
	// );
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export type ApiPerpetualsLimitOrderBody = {
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	price: bigint;
	orderType: PerpetualsOrderType;
	collateralChange: number;
	hasPosition: boolean;
	reduceOnly: boolean;
	expiryTimestamp?: bigint;
	leverage?: number;
	slTp?: {
		walletAddress: SuiAddress;
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		size?: bigint;
		stopLossIndexPrice?: number;
		takeProfitIndexPrice?: number;
	};
	// & (
	// 	| {
	// 			stopLossIndexPrice: number;
	// 			takeProfitIndexPrice: number;
	// 	  }
	// 	| {
	// 			stopLossIndexPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitIndexPrice: number;
	// 	  }
	// );
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export type ApiPerpetualsCancelOrdersBody = {
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
			collateralChange: number;
		}
	>;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

export type ApiPerpetualsCancelStopOrdersBody = {
	stopOrderIds: ObjectId[];
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

// export type ApiPerpetualsReduceOrderBody = {
// 	marketId: PerpetualsMarketId;
// 	collateralChange: number;
// 	leverage?: number;
// 	orderId: PerpetualsOrderId;
// 	sizeToSubtract: bigint;
// 	txKind?: SerializedTransaction;
// } & (
// 	| {
// 			accountId: PerpetualsAccountId;
// 	  }
// 	| {
// 			vaultId: ObjectId;
// 	  }
// );

export type ApiPerpetualsSetLeverageTxBody = {
	marketId: PerpetualsMarketId;
	collateralChange: number;
	leverage: number;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

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
//  Vaults
// =========================================================================

export interface ApiPerpetualsVaultProcessForceWithdrawsTxBody {
	vaultId: ObjectId;
	sizesToClose: Record<PerpetualsMarketId, Balance>;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultProcessWithdrawRequestsTxBody {
	vaultId: ObjectId;
	userAddresses: SuiAddress[];
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultUpdateWithdrawRequestSlippagesTxBody {
	vaultIds: ObjectId[];
	minLpAmountsOut: Balance[];
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultUpdateForceWithdrawDelayTxBody {
	vaultId: ObjectId;
	forceWithdrawDelayMs: bigint;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultUpdateLockPeriodTxBody {
	vaultId: ObjectId;
	lockPeriodMs: bigint;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultUpdateOwnerFeePercentageTxBody {
	vaultId: ObjectId;
	ownerFeePercentage: number;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultWithdrawOwnerFeesTxBody {
	vaultId: ObjectId;
	// recipientAddress: SuiAddress
	withdrawAmount: Balance;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultWithdrawOwnerFeesTxResponse {
	txKind: SerializedTransaction;
	coinOutArg: TransactionObjectArgument | undefined;
}

export interface ApiPerpetualsVaultAllWithdrawRequestsBody {
	vaultId: ObjectId;
}

export interface ApiPerpetualsVaultWithdrawRequestsBody {
	walletAddress: SuiAddress;
	// vaultIds: ObjectId[] | undefined;
}

export interface ApiPerpetualsVaultCreateWithdrawRequestTxBody {
	vaultId: ObjectId;
	lpWithdrawAmount: Balance;
	minLpWithdrawAmount: Balance;
	txKind?: SerializedTransaction;
}

export interface ApiPerpetualsVaultCancelWithdrawRequestsTxBody {
	vaultIds: ObjectId[];
	walletAddress: SuiAddress;
	txKind?: SerializedTransaction;
}

export type ApiPerpetualsVaultDepositTxBody = {
	vaultId: ObjectId;
	walletAddress: SuiAddress;
	minLpAmountOut: Balance;
	txKind?: SerializedTransaction;
	isSponsoredTx?: boolean;
} & (
	| {
			depositAmount: Balance;
	  }
	| {
			depositCoinArg: TransactionObjectArgument;
	  }
);

export interface ApiPerpetualsVaultPreviewCreateWithdrawRequestBody {
	vaultId: ObjectId;
	lpWithdrawAmount: Balance;
}

export interface ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse {
	collateralAmountOut: number;
	collateralAmountOutUsd: number;
}

export interface ApiPerpetualsVaultPreviewDepositBody {
	vaultId: ObjectId;
	// TODO: rename collateralDepositAmount ?
	depositAmount: Balance;
}

export interface ApiPerpetualsVaultPreviewDepositResponse {
	// provided_balance -- what is this ?
	lpAmountOut: number;
}

export interface ApiPerpetualsVaultPreviewProcessForceWithdrawBody {
	vaultId: ObjectId;
	walletAddress: SuiAddress;
}

export interface ApiPerpetualsVaultPreviewProcessForceWithdrawResponse {
	collateralAmountOut: number;
	collateralAmountOutUsd: number;
	// TODO: change to arr ?
	sizesToClose: Record<PerpetualsMarketId, Balance>;
}

export interface ApiPerpetualsVaultPreviewProcessWithdrawRequestsBody {
	vaultId: ObjectId;
	userAddresses: SuiAddress[];
}

export type ApiPerpetualsVaultPreviewProcessWithdrawRequestsResponse = {
	// userAddress: SuiAddress;
	lpAmountOut: number;
}[];

export interface ApiPerpetualsVaultPreviewWithdrawOwnerFeesBody {
	vaultId: ObjectId;
}

export interface ApiPerpetualsVaultPreviewWithdrawOwnerFeesResponse {
	maxFeesToWithdraw: Balance;
	// maxFeesToWithdrawUsd: number;
	feeCoinType: CoinType;
}

// =========================================================================
//  SDK
// =========================================================================

export type SdkPerpetualsPlaceMarketOrderInputs = Omit<
	ApiPerpetualsMarketOrderBody,
	"accountId" | "hasPosition" | "txKind" | "slTp"
> & {
	tx?: Transaction;
	slTp?: {
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		size?: bigint;
		stopLossIndexPrice?: number;
		takeProfitIndexPrice?: number;
	};
	// & (
	// 	| {
	// 			stopLossIndexPrice: number;
	// 			takeProfitIndexPrice: number;
	// 	  }
	// 	| {
	// 			stopLossIndexPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitIndexPrice: number;
	// 	  }
	// );
};

export type SdkPerpetualsPlaceLimitOrderInputs = Omit<
	ApiPerpetualsLimitOrderBody,
	"accountId" | "hasPosition" | "txKind" | "slTp"
> & {
	tx?: Transaction;
	slTp?: {
		gasCoinArg?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		size?: bigint;
		stopLossIndexPrice?: number;
		takeProfitIndexPrice?: number;
	};
	// & (
	// 	| {
	// 			stopLossIndexPrice: number;
	// 			takeProfitIndexPrice: number;
	// 	  }
	// 	| {
	// 			stopLossIndexPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitIndexPrice: number;
	// 	  }
	// );
};

// export type SdkPerpetualsPlaceOrderPreviewInputs = Omit<
// 	ApiPerpetualsPreviewOrderBody,
// 	"collateralCoinType" | "accountId"
// >;

export type SdkPerpetualsPlaceMarketOrderPreviewInputs = Omit<
	ApiPerpetualsPreviewPlaceMarketOrderBody,
	"collateralCoinType" | "accountId"
>;

export type SdkPerpetualsPlaceLimitOrderPreviewInputs = Omit<
	ApiPerpetualsPreviewPlaceLimitOrderBody,
	"collateralCoinType" | "accountId"
>;

export type SdkPerpetualsCancelOrdersPreviewInputs = Omit<
	ApiPerpetualsPreviewCancelOrdersBody,
	"collateralCoinType" | "accountId"
>;

// =========================================================================
//  Websocket
// =========================================================================

// /perpetuals/ws/updates

export type PerpetualsWsUpdatesSubscriptionAction = "subscribe" | "unsubscribe";

export interface PerpetualsWsUpdatesMarketSubscriptionType {
	market: {
		marketId: PerpetualsMarketId;
	};
}

export interface PerpetualsWsUpdatesUserSubscriptionType {
	user: {
		accountId: PerpetualsAccountId;
		withStopOrders:
			| {
					walletAddress: SuiAddress;
					bytes: string;
					signature: string;
			  }
			| undefined;
	};
}

export interface PerpetualsWsUpdatesOracleSubscriptionType {
	oracle: {
		marketId: PerpetualsMarketId;
	};
}

export interface PerpetualsWsUpdatesOrderbookSubscriptionType {
	orderbook: {
		marketId: PerpetualsMarketId;
	};
}

export interface PerpetualsWsUpdatesTradesSubscriptionType {
	trades: {
		marketId: PerpetualsMarketId;
	};
}

export type PerpetualsWsUpdatesSubscriptionType =
	| PerpetualsWsUpdatesMarketSubscriptionType
	| PerpetualsWsUpdatesUserSubscriptionType
	| PerpetualsWsUpdatesOracleSubscriptionType
	| PerpetualsWsUpdatesOrderbookSubscriptionType
	| PerpetualsWsUpdatesTradesSubscriptionType;

export interface PerpetualsWsUpdatesOraclePayload {
	priceFeedId: ObjectId;
	price: number;
	isBasePriceFeed: boolean;
}

export interface PerpetualsWsUpdatesTradesPayload {
	marketId: PerpetualsMarketId;
	trades: PerpetualsTradeHistoryData[];
}

export interface PerpetualsWsUpdatesOrderbookPayload {
	marketId: PerpetualsMarketId;
	orderbookDeltas: PerpetualsOrderbookDeltas;
}

export interface PerpetualsWsUpdatesUserPayload {
	account: PerpetualsAccountObject;
	stopOrders: PerpetualsStopOrderData[] | undefined;
}

export interface PerpetualsWsUpdatesSubscriptionMessage {
	action: PerpetualsWsUpdatesSubscriptionAction;
	subscriptionType: PerpetualsWsUpdatesSubscriptionType;
}

export type PerpetualsWsUpdatesResponseMessage =
	| { market: PerpetualsMarketData }
	| { user: PerpetualsWsUpdatesUserPayload }
	| { oracle: PerpetualsWsUpdatesOraclePayload }
	| { orderbook: PerpetualsWsUpdatesOrderbookPayload }
	| { trades: PerpetualsWsUpdatesTradesPayload };

// /perpetuals/ws/market-candles/{market_id}/{interval_ms}

export interface PerpetualsWsCandleResponseMessage {
	marketId: PerpetualsMarketId;
	lastCandle: PerpetualsMarketCandleDataPoint | undefined;
}
