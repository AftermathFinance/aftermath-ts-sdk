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

/**
 * Unique identifier for a perpetuals market, represented as a Sui object ID
 * (i.e. the `ClearingHouse` object on-chain).
 */
export type PerpetualsMarketId = ObjectId;

/**
 * Unique numeric identifier for a perpetuals account.
 *
 * This is a bigint, as it is derived directly from the on-chain representation.
 */
export type PerpetualsAccountId = bigint;

/**
 * Unique numeric identifier for a perpetuals order.
 *
 * This ID is stable across events and API responses.
 */
export type PerpetualsOrderId = bigint;

/**
 * String representation of a {@link PerpetualsOrderId}.
 *
 * Some APIs serialize order IDs as strings instead of `bigint`.
 */
export type PerpetualsOrderIdAsString = string;

/**
 * Price type for orders, represented as a fixed-point `bigint` in the
 * on-chain format (e.g., scaled by `1e9`).
 */
export type PerpetualsOrderPrice = bigint;

// =========================================================================
//  Enums
// =========================================================================

/**
 * Side of a perpetuals order.
 *
 * - `Bid` (0): Long-side orders / buyers.
 * - `Ask` (1): Short-side orders / sellers.
 */
export enum PerpetualsOrderSide {
	Ask = 1, // true
	Bid = 0, // false
}

/**
 * Order execution and posting behavior.
 *
 * - `Standard`: No special constraints.
 * - `FillOrKill`: Either fully fills immediately or cancels.
 * - `PostOnly`: Only posts to the book; will not take liquidity.
 * - `ImmediateOrCancel`: Fills as much as possible immediately; remainder is canceled.
 */
export enum PerpetualsOrderType {
	Standard = 0,
	FillOrKill = 1,
	PostOnly = 2,
	ImmediateOrCancel = 3,
}

/**
 * Stop order mode.
 *
 * - `SlTp`: Stop Loss / Take Profit order, intended to close a position
 *   (fully or partially).
 * - `Standalone`: Independent stop order that can both reduce or increase
 *   the position, potentially requiring additional allocated collateral.
 */
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

/**
 * Aggregate market configuration and state for a single perpetuals market.
 */
export interface PerpetualsMarketData {
	/** Package ID of the deployed perpetuals contract. */
	packageId: PackageId;
	/** Object ID for the market (clearing house) on-chain. */
	objectId: ObjectId;
	// initialSharedVersion: ObjectVersion;
	/** Collateral coin type used for margin in this market. */
	collateralCoinType: CoinType;
	/** Static configuration parameters for this market. */
	marketParams: PerpetualsMarketParams;
	/** Dynamic runtime state (funding, open interest, etc.). */
	marketState: PerpetualsMarketState;
	/** Current price of collateral in USD or the platform's base unit. */
	collateralPrice: number;
	/** Oracle/index price of the base asset for this market. */
	indexPrice: number;
	/** Estimated funding rate for the next funding interval. */
	estimatedFundingRate: Percentage;
	/** Timestamp (ms) for the next funding event, as a bigint. */
	nextFundingTimestampMs: bigint;
}

/**
 * On-chain capability object that grants control over a perpetuals account.
 *
 * This represents an "owned" account capability, used to sign and authorize
 * account-level actions.
 */
export interface PerpetualsAccountCap {
	/** Object ID of the account capability on-chain. */
	objectId: ObjectId;
	/** Wallet address that owns this account capability. */
	walletAddress: SuiAddress;
	/** Logical ID of the associated perpetuals account. */
	accountId: PerpetualsAccountId;
	/** Object ID of the associated `PerpetualsAccountObject`. */
	accountObjectId: ObjectId;
	/** Collateral coin type backing this account. */
	collateralCoinType: CoinType;
	/** Total collateral (native units) associated with this account. */
	collateral: number;
	// collateralDecimals: CoinDecimal;
	/** On-chain object version. */
	objectVersion: ObjectVersion;
	/** On-chain object digest. */
	objectDigest: ObjectDigest;
	// subAccount: PerpetualsSubAccount;
}

/**
 * Base vault-capability object, as represented on-chain.
 */
export interface PerpetualsVaultCap {
	/** Vault object ID that this cap grants permissions for. */
	vaultId: ObjectId;
	/** Capability object ID. */
	objectId: ObjectId;
	/** Owner of the vault-capability. */
	ownerAddress: SuiAddress;
}

/**
 * Extended vault capability structure used in the SDK.
 *
 * This combines vault and account metadata for convenience when interacting
 * with vault-owned perpetuals accounts.
 */
// TODO: rename
export type PerpetualsVaultCapExtended = {
	/** Vault object ID. */
	vaultId: ObjectId;
	/** Owner address of the vault. */
	ownerAddress: SuiAddress;
	/** Perpetuals account ID controlled by the vault. */
	accountId: PerpetualsAccountId;
	/** Object ID of the account object owned by the vault. */
	accountObjectId: ObjectId;
	/** Collateral coin type used by the vault account. */
	collateralCoinType: CoinType;
	// collateralDecimals: CoinDecimal;
};

/**
 * Aggregate position data for a single perpetuals market and account.
 *
 * Values are generally denoted in:
 * - Base asset units (e.g. BTC)
 * - Quote units (e.g. USD)
 * - Collateral units (per `collateralCoinType`)
 */
export interface PerpetualsPosition {
	/** Allocated collateral (in collateral coins). */
	collateral: number;
	/** Net base asset amount (positive = long, negative = short). */
	baseAssetAmount: number;
	/** Notional exposure of the position in quote units. */
	quoteAssetNotionalAmount: number;
	/** Cumulative funding rate accrued on the long side. */
	cumFundingRateLong: number;
	/** Cumulative funding rate accrued on the short side. */
	cumFundingRateShort: number;
	/** Aggregate size of resting asks in this market for the account. */
	asksQuantity: number;
	/** Aggregate size of resting bids in this market for the account. */
	bidsQuantity: number;
	// collateralCoinType: CoinType;
	/** Market identifier for this position. */
	marketId: PerpetualsMarketId;
	/** All pending (open) orders associated with this position. */
	pendingOrders: {
		/** Unique ID of the order. */
		orderId: PerpetualsOrderId;
		/** Side of the order (Bid/Ask). */
		side: PerpetualsOrderSide;
		/** Size of the order in base units (scaled as bigint). */
		size: bigint;
	}[];
	/** Maker fee rate applied to this position (as a fraction). */
	makerFee: number;
	/** Taker fee rate applied to this position (as a fraction). */
	takerFee: number;
	/** Effective leverage applied to the position. */
	leverage: number;
	/** Collateral value in USD. */
	collateralUsd: number;
	/** Current margin ratio (collateral / exposure). */
	marginRatio: number;
	/** Free margin available in USD. */
	freeMarginUsd: number;
	/** Free (unlocked) collateral in collateral units. */
	freeCollateral: number;
	/** Unrealized funding PnL in USD. */
	unrealizedFundingsUsd: number;
	/** Unrealized position PnL in USD. */
	unrealizedPnlUsd: number;
	/** Average entry price of the position. */
	entryPrice: number;
	/** Approximate liquidation price for the position. */
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

/**
 * Static configuration parameters describing a perpetuals market.
 *
 * These values are typically immutable or rarely changed, and are used
 * to drive risk limits, pricing, and fee schedules.
 */
export interface PerpetualsMarketParams {
	/** Initial margin requirement for new positions (fraction). */
	marginRatioInitial: number;
	/** Maintenance margin requirement for open positions (fraction). */
	marginRatioMaintenance: number;
	/** Symbol of the underlying asset. */
	baseAssetSymbol: CoinSymbol;
	/** On-chain ID of the oracle providing the base asset price. */
	basePriceFeedId: ObjectId;
	/** On-chain ID of the oracle providing the collateral asset price. */
	collateralPriceFeedId: ObjectId;
	/** Funding interval duration in milliseconds. */
	fundingFrequencyMs: bigint;
	/** Funding period used for calculations in milliseconds. */
	fundingPeriodMs: bigint;
	/** TWAP frequency for the premium in milliseconds. */
	premiumTwapFrequencyMs: bigint;
	/** TWAP period for the premium in milliseconds. */
	premiumTwapPeriodMs: bigint;
	/** TWAP frequency for the spread in milliseconds. */
	spreadTwapFrequencyMs: bigint;
	/** TWAP period for the spread in milliseconds. */
	spreadTwapPeriodMs: bigint;
	/** TWAP period for gas price in milliseconds. */
	gasPriceTwapPeriodMs: bigint;
	/** Maker fee rate (fraction) charged for providing liquidity. */
	makerFee: number;
	/** Taker fee rate (fraction) charged for taking liquidity. */
	takerFee: number;
	/** Liquidation fee rate (fraction) charged on liquidations. */
	liquidationFee: number;
	/** Fee rate (fraction) for forced cancellation. */
	forceCancelFee: number;
	/** Fraction of fees directed to the insurance fund. */
	insuranceFundFee: number;
	/** Minimum notional order value in USD. */
	minOrderUsdValue: number;
	/** Minimum base size increment for orders (lot size, scaled bigint). */
	lotSize: bigint;
	/** Minimum price increment (tick size, scaled bigint). */
	tickSize: bigint;
	/** Scaling factor used in internal fixed-point conversions. */
	scalingFactor: number;
	/** Additional taker fee that depends on gas cost. */
	gasPriceTakerFee: number;
	/** Z-score threshold used for outlier detection in pricing. */
	zScoreThreshold: number;
	/** Maximum open interest (notional or base) allowed in the market. */
	maxPendingOrders: bigint;
	/** Oracle tolerance for the base asset price (scaled bigint). */
	baseOracleTolerance: bigint;
	/** Oracle tolerance for the collateral price (scaled bigint). */
	collateralOracleTolerance: bigint;
	/** Maximum open interest (absolute). */
	maxOpenInterest: number;
	/** Threshold above which open interest is considered elevated. */
	maxOpenInterestThreshold: number;
	/** Maximum fraction of open interest a single position can hold. */
	maxOpenInterestPositionPercent: number;
}

/**
 * Dynamic runtime state of a perpetuals market.
 *
 * These values are updated frequently and used to compute funding
 * and other time-variant metrics.
 */
export interface PerpetualsMarketState {
	/** Cumulative funding rate for long positions. */
	cumFundingRateLong: number;
	/** Cumulative funding rate for short positions. */
	cumFundingRateShort: number;
	/** Last timestamp when funding was updated. */
	fundingLastUpdateTimestamp: Timestamp;
	/** Premium TWAP value (book vs index). */
	premiumTwap: number;
	/** Timestamp of last premium TWAP update. */
	premiumTwapLastUpdateTimestamp: Timestamp;
	/** Spread TWAP value. */
	spreadTwap: number;
	/** Timestamp of last spread TWAP update. */
	spreadTwapLastUpdateTimestamp: Timestamp;
	/** Current open interest in the market. */
	openInterest: number;
	/** Total fees accrued by the market. */
	feesAccrued: number;
	// nextFundingTimestamp: Timestamp;
	// estimatedFundingRate: Percentage;
}

/**
 * Single OHLCV data point for a market candle.
 *
 * Typically used in charts and historical data views.
 */
export interface PerpetualsMarketCandleDataPoint {
	/** Start timestamp of this candle. */
	timestamp: Timestamp;
	/** High price within this interval. */
	high: number;
	/** Low price within this interval. */
	low: number;
	/** Open price at the beginning of the interval. */
	open: number;
	/** Close price at the end of the interval. */
	close: number;
	/** Traded volume (base units) during the interval. */
	volume: number;
}

// =========================================================================
//  Orderbook
// =========================================================================

/**
 * A single entry (price level) in an orderbook side.
 */
export interface PerpetualsOrderbookItem {
	/** Total size resting at this price level (base units). */
	size: number;
	/** Price level for the aggregated orders. */
	price: number;
}

/**
 * Aggregated orderbook snapshot for a perpetuals market.
 */
export interface PerpetualsOrderbook {
	/** Bid-side price levels (sorted descending by price). */
	bids: PerpetualsOrderbookItem[];
	/** Ask-side price levels (sorted ascending by price). */
	asks: PerpetualsOrderbookItem[];
	/** Sum of bid-side size across all levels. */
	asksTotalSize: number;
	/** Sum of ask-side size across all levels. */
	bidsTotalSize: number;
	/** Best bid price (highest bid), or undefined if no bids. */
	bestBidPrice: number | undefined;
	/** Best ask price (lowest ask), or undefined if no asks. */
	bestAskPrice: number | undefined;
	/** Mid price between best bid and best ask, if both exist. */
	midPrice: number | undefined;
	/** Incremental nonce associated with this snapshot. */
	nonce: bigint;
}

/**
 * Incremental deltas to an orderbook snapshot.
 *
 * These are typically used over websockets for streaming updates.
 */
export interface PerpetualsOrderbookDeltas {
	/** Updated bid-side price levels. */
	bidsDeltas: PerpetualsOrderbookItem[];
	/** Updated ask-side price levels. */
	asksDeltas: PerpetualsOrderbookItem[];
	/** Delta of total ask-side size. */
	asksTotalSizeDelta: number;
	/** Delta of total bid-side size. */
	bidsTotalSizeDelta: number;
	/** Nonce for ordering deltas. */
	nonce: bigint;
}

/**
 * Core order metadata for perpetuals orders.
 *
 * This is shared across multiple internal and external APIs.
 */
export interface PerpetualsOrderData {
	/** Unique ID of the order. */
	orderId: PerpetualsOrderId;
	/** Initial order size in scaled base units. */
	initialSize: bigint;
	/** Already-filled size in scaled base units. */
	filledSize: bigint;
	/** Order side (Bid or Ask). */
	side: PerpetualsOrderSide;
	/** Market this order belongs to. */
	marketId: PerpetualsMarketId;
}

// reduceOnly: boolean;
// expiryTimestamp?: bigint;
// limitOrder?: {
// 	price: PerpetualsOrderPrice;
// 	orderType: PerpetualsOrderType;
// };

/**
 * Full stop-order representation on-chain.
 *
 * Can represent:
 * - SL/TP orders (`slTp`)
 * - Standalone stops (`nonSlTp`)
 */
export interface PerpetualsStopOrderData {
	/** ID of the stop order object on-chain. */
	objectId: ObjectId;
	/** Market the stop order is tied to. */
	marketId: PerpetualsMarketId;
	/** Size to execute when triggered (scaled base units). */
	size: bigint;
	/** Direction of the stop order. */
	side: PerpetualsOrderSide;
	/** Optional expiration time (ms or seconds, depending on protocol). */
	expiryTimestamp?: bigint;
	/** Optional limit order parameters when the stop triggers. */
	limitOrder?: {
		/** Limit price to post or execute at, scaled bigint. */
		price: bigint;
		/** Order type semantics. */
		orderType: PerpetualsOrderType;
	};
	/** Stop loss / take profit configuration. */
	slTp?: {
		/** Index price at which to trigger a stop loss. */
		stopLossIndexPrice?: number;
		/** Index price at which to take profit. */
		takeProfitIndexPrice?: number;
		// forPositionSide: PerpetualsOrderSide;
	};
	/** Non-SL/TP standalone stop configuration. */
	nonSlTp?: {
		/** Index price threshold used for triggering. */
		stopIndexPrice: number;
		/** If true, triggers when index >= threshold, otherwise index <= threshold. */
		triggerIfGeStopIndexPrice: boolean;
		/** Whether the stop can only reduce an existing position. */
		reduceOnly: boolean;
	};
}

/**
 * Filled order data used in execution price previews and trade details.
 */
export interface PerpetualsFilledOrderData {
	/** Filled size in base units (non-scaled). */
	size: number;
	/** Execution price for the fill. */
	price: number;
}

/**
 * High-level order info with price and size only.
 */
export interface PerpetualsOrderInfo {
	/** Order price. */
	price: number;
	/** Order size (scaled base units). */
	size: bigint;
}

/**
 * Pairing of a perpetuals account capability and its current account state.
 */
export interface PerpetualsAccountData {
	/** Account capability object. */
	accountCap: PerpetualsAccountCap;
	/** Account state object. */
	account: PerpetualsAccountObject;
}

/**
 * Aggregate account-level metrics for perpetuals.
 */
export interface PerpetualsAccountObject {
	/** Numeric ID of the account. */
	accountId: PerpetualsAccountId;
	/** Total equity in USD. */
	totalEquityUsd: number;
	/** Available collateral in collateral units. */
	availableCollateral: number;
	/** Available collateral in USD. */
	availableCollateralUsd: number;
	/** Sum of unrealized funding PnL across markets. */
	totalUnrealizedFundingsUsd: number;
	/** Sum of unrealized position PnL across markets. */
	totalUnrealizedPnlUsd: number;
	/** Per-market positions for this account. */
	positions: PerpetualsPosition[];
}

/**
 * On-chain representation of a vault that manages user collateral and
 * interacts with clearing houses on their behalf.
 */
export interface PerpetualsVaultObject {
	/// Unique identifier for distinct network identification.
	objectId: ObjectId;
	/// Contract version number for controlled upgrades.
	version: bigint;
	// TODO
	name: string;
	/// Supply of LP coins from a `TreasuryCap` for liquidity integrity.
	lpSupply: Balance;
	/// Total balance of underlying Coin (`C`), deposited by users.
	idleCollateral: Balance;
	// TODO
	idleCollateralUsd: number;
	// TODO
	totalCollateral: Balance;
	// TODO
	totalCollateralUsd: number;
	// TODO
	tvlUsd: number;
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
		// TODO
		collateralPriceFeedStorageSourceId: ObjectId;
		// TODO
		collateralPriceFeedStorageTolerance: bigint;
		// TODO
		maxForceWithdrawMarginRatioTolerance: number;
		/// Scaling factor to apply to `C` to convert a balance to ifixed.
		/// Used to calculate user's minimum deposit value in usd
		scalingFactor: number;
		/// The maximum number of distinct `ClearingHouse`.
		maxMarketsInVault: bigint;
		/// The maximum number of pending orders allowed for a single position in the `Vault`.
		maxPendingOrdersPerPosition: bigint;
		// TODO
		maxTotalDepositedCollateral: Balance;
	};
	/** Owner address of the vault. */
	ownerAddress: SuiAddress;
	/** Creation timestamp of the vault. */
	creationTimestamp: Timestamp;
	/** Underlying perpetuals account ID that the vault uses. */
	accountId: PerpetualsAccountId;
	/** Account object ID used by the vault. */
	accountObjectId: ObjectId;
	/** Collateral coin type accepted by this vault. */
	collateralCoinType: CoinType;
	// TODO
	lpCoinType: CoinType;
	/** Decimals for the LP token minted by this vault. */
	lpCoinDecimals: CoinDecimal;
}

/**
 * Represents a single pending vault withdrawal request.
 */
export interface PerpetualsVaultWithdrawRequest {
	/// The address of the user that created the withdraw request
	userAddress: SuiAddress;
	/// Object id of the vault associated with the withdraw request
	vaultId: SuiAddress;
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

/**
 * Event emitted when a clearing house (market) is upgraded to a new version.
 */
export interface UpdatedMarketVersionEvent extends Event {
	/** Market identifier for which the version changed. */
	marketId: PerpetualsMarketId;
	/** New version value. */
	version: bigint;
}

/**
 * Type guard for {@link UpdatedMarketVersionEvent}.
 *
 * @param event - Generic event.
 * @returns `true` if this is an `UpdatedMarketVersionEvent`.
 */
export const isUpdatedMarketVersion = (
	event: Event
): event is UpdatedMarketVersionEvent => {
	return event.type.toLowerCase().endsWith("::updatedclearinghouseversion");
};

// =========================================================================
//  Collateral
// =========================================================================

/**
 * Cursor-based response wrapping a list of collateral changes for an account.
 */
export interface PerpetualsAccountCollateralChangesWithCursor {
	/** Collateral changes in chronological order (or per backend contract). */
	collateralChanges: PerpetualsAccountCollateralChange[];
	/** Next cursor (timestamp) or undefined if there is no next page. */
	nextCursor: Timestamp | undefined;
}

/**
 * Single collateral change record for an account.
 *
 * This may represent:
 * - Deposits / withdrawals
 * - Liquidations
 * - Funding settlements
 * - Trading fees
 */
export type PerpetualsAccountCollateralChange = {
	/** When the change occurred. */
	timestamp: Timestamp;
	/** Sui transaction digest that produced this change. */
	txDigest: TransactionDigest;
	/** Market ID, if applicable (can be undefined for global changes). */
	marketId: PerpetualsMarketId | undefined;
	/** Concrete event type fully qualified (Sui struct type). */
	eventType: AnyObjectType;
	/** Net change in collateral units. */
	collateralChange: number;
	/** Net change in USD value. */
	collateralChangeUsd: number;
	/** Optional breakdown of fees, with variant shapes based on event. */
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

/**
 * Cursor-based response wrapping a list of trades for an account.
 */
export interface PerpetualsAccountTradesWithCursor {
	/** Trades in chronological order (or per backend contract). */
	trades: PerpetualsAccountTrade[];
	/** Next cursor (timestamp) or undefined if no next page. */
	nextCursor: Timestamp | undefined;
}

/**
 * Historical margin data point for an account, used in margin history views.
 */
export interface PerpetualsAccountMarginData {
	/** Timestamp of this snapshot. */
	timestamp: Timestamp;
	/** Collateral value in USD at that time. */
	collateralUsd: number;
	/** Unrealized funding PnL in USD at that time. */
	unrealizedFundingUsd: number;
	/** Unrealized position PnL in USD at that time. */
	unrealizedPnlUsd: number;
}

/**
 * Individual trade affecting an account.
 */
export type PerpetualsAccountTrade = {
	/** Timestamp of the trade. */
	timestamp: Timestamp;
	/** Sui transaction digest. */
	txDigest: TransactionDigest;
	/** Market in which this trade occurred. */
	marketId: PerpetualsMarketId;
	/** Concrete event type. */
	eventType: AnyObjectType;
	/** Side of the trade relative to the account (Bid/Ask). */
	side: PerpetualsOrderSide;
	/** Execution price. */
	price: number;
	/** Trade size in base units. */
	size: number;
};

/**
 * Event emitted when collateral is deposited into an account.
 */
export interface DepositedCollateralEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

/**
 * Event emitted when collateral is allocated from general account collateral
 * into a specific market position.
 */
export interface AllocatedCollateralEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

/**
 * Event emitted when collateral is deallocated from a market back to
 * the account's general collateral.
 */
export interface DeallocatedCollateralEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

/**
 * Event emitted when collateral is withdrawn from the account.
 */
export interface WithdrewCollateralEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDelta: Balance;
}

/**
 * Event emitted when funding is settled for an account and market.
 */
export interface SettledFundingEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: number;
	marketId: PerpetualsMarketId;
	marketFundingRateLong: number;
	marketFundingRateShort: number;
}

/**
 * Union of all event types that impact account collateral.
 */
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

/**
 * Type guard for {@link WithdrewCollateralEvent}.
 */
export const isWithdrewCollateralEvent = (
	event: Event
): event is WithdrewCollateralEvent => {
	return event.type.toLowerCase().includes("::withdrewcollateral");
};

/**
 * Type guard for {@link DepositedCollateralEvent}.
 */
export const isDepositedCollateralEvent = (
	event: Event
): event is DepositedCollateralEvent => {
	return event.type.toLowerCase().includes("::depositedcollateral");
};

/**
 * Type guard for {@link DeallocatedCollateralEvent}.
 */
export const isDeallocatedCollateralEvent = (
	event: Event
): event is DeallocatedCollateralEvent => {
	return event.type.toLowerCase().endsWith("::deallocatedcollateral");
};

/**
 * Type guard for {@link AllocatedCollateralEvent}.
 */
export const isAllocatedCollateralEvent = (
	event: Event
): event is AllocatedCollateralEvent => {
	return event.type.toLowerCase().endsWith("::allocatedcollateral");
};

/**
 * Type guard for {@link SettledFundingEvent}.
 */
export const isSettledFundingEvent = (
	event: Event
): event is SettledFundingEvent => {
	return event.type.toLowerCase().endsWith("::settledfunding");
};

// =========================================================================
//  Liquidation
// =========================================================================

/**
 * Event emitted when an account is liquidated in a given market.
 */
export interface LiquidatedEvent extends Event {
	accountId: PerpetualsAccountId;
	collateralDeltaUsd: number;
	/** Liquidator's account ID. */
	liqorAccountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	/** Amount of base asset liquidated. */
	baseLiquidated: number;
	/** Amount of quote asset liquidated. */
	quoteLiquidated: number;
	/** Liquidated account's PnL in USD for this event. */
	liqeePnlUsd: number;
	/** Liquidation fee paid in USD. */
	liquidationFeesUsd: number;
	/** Force-cancel fees collected in USD. */
	forceCancelFeesUsd: number;
	/** Fees directed to the insurance fund in USD. */
	insuranceFundFeesUsd: number;
}

/**
 * Type guard for {@link LiquidatedEvent}.
 */
export const isLiquidatedEvent = (event: Event): event is LiquidatedEvent => {
	return event.type.toLowerCase().endsWith("::liquidatedposition");
};

// =========================================================================
//  Account
// =========================================================================

/**
 * Event emitted when a new perpetuals account is created for a user.
 */
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

/**
 * Event emitted when an account's initial margin ratio for a position
 * is explicitly set or adjusted.
 */
export interface SetPositionInitialMarginRatioEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	// NOTE: should this be made into string ?
	initialMarginRatio: number;
}

// =========================================================================
//  Order
// =========================================================================

/**
 * Trade data used for market-level trade history.
 */
export interface PerpetualsTradeHistoryData {
	/** Timestamp of the trade. */
	timestamp: Timestamp;
	/** Transaction digest. */
	txDigest: TransactionDigest;
	/** Side of the trade. */
	side: PerpetualsOrderSide;
	/** Filled size in base units. */
	sizeFilled: number;
	/** Order price (limit price) used for the trade. */
	orderPrice: number;
}

/**
 * Cursor-based wrapper for market-level trade history.
 */
export interface PerpetualsTradeHistoryWithCursor {
	/** Trades in this page. */
	trades: PerpetualsTradeHistoryData[];
	// TODO: move `nextCursor` pattern to general types ?
	/** Next cursor or undefined if there are no more pages. */
	nextCursor: Timestamp | undefined;
}

/**
 * Event emitted when an order is filled or dropped by the orderbook
 * (book-keeping receipt).
 */
export interface OrderbookFillReceiptEvent extends Event {
	accountId: PerpetualsAccountId;
	orderId: PerpetualsOrderId;
	size: bigint;
	/** Whether the order was dropped instead of filled. */
	dropped: boolean;
}

/**
 * Event emitted when an order is canceled.
 */
export interface CanceledOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	size: bigint;
	orderId: PerpetualsOrderId;
}

/**
 * Event emitted when a new order is posted to the orderbook.
 */
export interface PostedOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	orderId: PerpetualsOrderId;
	size: bigint;
	// TODO: change to `isReduceOnly` ?
	reduceOnly: boolean;
	expiryTimestamp?: bigint;
}

/**
 * Event emitted when one or more maker orders are filled against a taker.
 */
export interface FilledMakerOrdersEvent extends Event {
	/** List of per-maker fills for this aggregate event. */
	events: FilledMakerOrderEventFields[];
}

/**
 * Details for a single maker order fill inside a {@link FilledMakerOrdersEvent}.
 */
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

/**
 * Event emitted when a taker order is executed.
 */
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

/**
 * Union of all order-related events in the protocol.
 */
export type PerpetualsOrderEvent =
	| CanceledOrderEvent
	| PostedOrderEvent
	| PostedOrderEvent
	| FilledMakerOrdersEvent
	| FilledTakerOrderEvent
	| LiquidatedEvent
	| ReducedOrderEvent;

/**
 * Event emitted when an order is posted.
 *
 * NOTE: This is a second definition of `PostedOrderEvent` used in a
 * simplified context (without `reduceOnly` / `expiryTimestamp`).
 */
export interface PostedOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	orderId: PerpetualsOrderId;
	size: bigint;
	side: PerpetualsOrderSide;
}

/**
 * Event emitted when an existing order is reduced (partial cancellation or
 * adjustment of size).
 */
export interface ReducedOrderEvent extends Event {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	sizeChange: bigint;
	orderId: PerpetualsOrderId;
}

// TODO: make all these checks use string value from perps api

/**
 * Type guard for {@link CanceledOrderEvent}.
 */
export const isCanceledOrderEvent = (
	event: Event
): event is CanceledOrderEvent => {
	return event.type.toLowerCase().endsWith("::canceledorder");
};

/**
 * Type guard for {@link PostedOrderEvent}.
 */
export const isPostedOrderEvent = (event: Event): event is PostedOrderEvent => {
	return event.type.toLowerCase().endsWith("::postedorder");
};

/**
 * Type guard for {@link FilledMakerOrdersEvent}.
 */
export const isFilledMakerOrdersEvent = (
	event: Event
): event is FilledMakerOrdersEvent => {
	return event.type.toLowerCase().endsWith("::filledmakerorders");
};

/**
 * Type guard for {@link FilledTakerOrderEvent}.
 */
export const isFilledTakerOrderEvent = (
	event: Event
): event is FilledTakerOrderEvent => {
	return event.type.toLowerCase().endsWith("::filledtakerorder");
};

/**
 * Type guard for {@link ReducedOrderEvent}.
 */
export const isReducedOrderEvent = (
	event: Event
): event is ReducedOrderEvent => {
	return event.type.toLowerCase().endsWith("::reducedorder");
};

// =========================================================================
//  Stop Orders
// =========================================================================

/**
 * Event emitted when a stop order ticket is created.
 *
 * Stop order tickets represent off-chain-executable stop orders that
 * executors can trigger.
 */
export interface CreatedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subAccountId?: ObjectId;
	executors: SuiAddress[];
	gas: Balance;
	stopOrderType: PerpetualsStopOrderType;
	/** Encrypted stop-order details (payload). */
	encryptedDetails: Byte[];
}

/**
 * Event emitted when a stop order ticket is executed.
 */
export interface ExecutedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	executor: SuiAddress;
}

/**
 * Event emitted when a stop order ticket is deleted or canceled.
 */
export interface DeletedStopOrderTicketEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subAccountId?: ObjectId;
	executor: SuiAddress;
}

/**
 * Event emitted when the details (payload) of a stop order ticket are edited.
 */
export interface EditedStopOrderTicketDetailsEvent extends Event {
	ticketId: ObjectId;
	accountId: PerpetualsAccountId;
	subAccountId?: ObjectId;
	encryptedDetails: Byte[];
	stopOrderType: PerpetualsStopOrderType;
}

/**
 * Event emitted when the set of executors for a stop order ticket is edited.
 */
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

/**
 * Event emitted when deallocated collateral is transferred from a clearing
 * house to an account or subaccount.
 */
export interface TransferredDeallocatedCollateralEvent extends Event {
	chId: ObjectId;
	/** Account or SubAccount object id. */
	objectId: ObjectId; // Account or SubAccount object id
	accountId: PerpetualsAccountId;
	collateral: Balance;
}

/**
 * Event emitted when an account or subaccount receives collateral.
 */
export interface ReceivedCollateralEvent extends Event {
	/** Account or SubAccount object id. */
	objectId: ObjectId; // Account or SubAccount object id
	accountId: PerpetualsAccountId;
	collateral: Balance;
}

// =========================================================================
//  Twap
// =========================================================================

/**
 * Event emitted when premium TWAP is updated for a market.
 */
export interface UpdatedPremiumTwapEvent extends Event {
	marketId: PerpetualsMarketId;
	bookPrice: number;
	indexPrice: number;
	premiumTwap: number;
	premiumTwapLastUpdateMs: number;
}

/**
 * Event emitted when spread TWAP is updated for a market.
 */
export interface UpdatedSpreadTwapEvent extends Event {
	marketId: PerpetualsMarketId;
	bookPrice: number;
	indexPrice: number;
	spreadTwap: number;
	spreadTwapLastUpdateMs: number;
}

/**
 * Union of all TWAP-related events.
 */
export type PerpetualsTwapEvent =
	| UpdatedPremiumTwapEvent
	| UpdatedSpreadTwapEvent;

/**
 * Type guard for {@link UpdatedPremiumTwapEvent}.
 */
export const isUpdatedPremiumTwapEvent = (
	event: Event
): event is UpdatedPremiumTwapEvent => {
	return event.type.toLowerCase().endsWith("::updatedpremiumtwap");
};

/**
 * Type guard for {@link UpdatedSpreadTwapEvent}.
 */
export const isUpdatedSpreadTwapEvent = (
	event: Event
): event is UpdatedSpreadTwapEvent => {
	return event.type.toLowerCase().endsWith("::updatedspreadtwap");
};

// =========================================================================
//  Funding
// =========================================================================

/**
 * Event emitted when market funding values are updated.
 */
export interface UpdatedFundingEvent extends Event {
	marketId: PerpetualsMarketId;
	cumFundingRateLong: number;
	cumFundingRateShort: number;
	fundingLastUpdateMs: Timestamp;
}

/**
 * Type guard for {@link UpdatedFundingEvent}.
 */
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

/**
 * Request body for fetching all account caps owned by a given wallet.
 */
export interface ApiPerpetualsOwnedAccountCapsBody {
	walletAddress: SuiAddress;
}

/**
 * Request body for fetching specific account caps by their object IDs.
 */
export interface ApiPerpetualsAccountCapsBody {
	accountCapIds: ObjectId[];
}

// =========================================================================
//  Interactions
// =========================================================================

// export interface ApiPerpetualsAccountMarginHistoryBody {
// 	accountId: PerpetualsAccountId;
// 	collateralCoinType: CoinType;
// }

/**
 * Request body for fetching account-level order history with a cursor.
 */
export type ApiPerpetualsAccountOrderHistoryBody =
	ApiDataWithCursorBody<Timestamp> & {
		accountId: PerpetualsAccountId;
	};

/**
 * Request body for fetching account collateral history with a cursor.
 */
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

/**
 * Request body for previewing a market order placement (before sending a tx).
 *
 * This version is used by the API and includes account or vault context.
 */
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
	/** Optional leverage override for the preview. */
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

/**
 * Request body for previewing a limit order placement (before sending a tx).
 *
 * This version is used by the API and includes account or vault context.
 */
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
	/** Optional leverage override for the preview. */
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

/**
 * Request body for previewing cancel-order operations.
 */
export type ApiPerpetualsPreviewCancelOrdersBody = {
	// TODO: remove eventually ?
	// collateralCoinType: CoinType;
	/** Per-market mapping of order IDs to cancel. */
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

/**
 * Request body for previewing a leverage change for a given position.
 */
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

/**
 * Request body for previewing a collateral allocation/deallocation for a given position.
 */
export type ApiPerpetualsPreviewEditCollateralBody = {
	marketId: PerpetualsMarketId;
	collateralChange: Balance;
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

/**
 * Response type for a leverage preview request.
 *
 * Either returns an error, or the position and collateral after the change.
 */
export type ApiPerpetualsPreviewSetLeverageResponse =
	| {
			error: string;
	  }
	| {
			updatedPosition: PerpetualsPosition;
			collateralChange: number;
	  };

/**
 * Response type for a allocate/deallocate collateral preview request.
 *
 * Either returns an error, or the position and collateral after the change.
 */
export type ApiPerpetualsPreviewEditCollateralResponse =
	| {
			error: string;
	  }
	| {
			updatedPosition: PerpetualsPosition;
			collateralChange: number;
	  };

/**
 * Generic response type for a place-order preview (market or limit).
 */
export type ApiPerpetualsPreviewPlaceOrderResponse =
	| {
			error: string;
	  }
	| {
			updatedPosition: PerpetualsPosition;
			priceSlippage: number;
			percentSlippage: Percentage;
			filledSize: number;
			filledSizeUsd: number;
			postedSize: number;
			postedSizeUsd: number;
			collateralChange: number;
			executionPrice: number;
	  };

/**
 * Response type for cancel-order preview.
 */
export type ApiPerpetualsPreviewCancelOrdersResponse =
	| {
			error: string;
	  }
	| {
			updatedPositions: PerpetualsPosition[];
			collateralChange: number;
	  };

// export interface ApiPerpetualsOrderbookStateBody {
// 	orderbookPrice: number;
// 	lotSize: number;
// 	tickSize: number;
// 	priceBucketSize: number;
// }

/**
 * Request body for computing an execution price for a hypothetical trade
 * using the current orderbook state and oracle prices.
 */
export interface ApiPerpetualsExecutionPriceBody {
	side: PerpetualsOrderSide;
	size: bigint;
	/** Lot size used to discretize the order size. */
	lotSize: number;
	/** Available collateral. */
	collateral: Balance;
	/** Oracle ID for the base price. */
	basePriceFeedId: ObjectId;
	/** Oracle ID for the collateral price. */
	collateralPriceFeedId: ObjectId;
	/** Optional user-specified price constraint. */
	price?: number;
}

/**
 * Response body for execution price previews.
 */
export interface ApiPerpetualsExecutionPriceResponse {
	executionPrice: number;
	sizeFilled: number;
	sizePosted: number;
	fills: PerpetualsFilledOrderData[];
}

/**
 * Response type for historical market candle data.
 */
export type ApiPerpetualsHistoricalMarketDataResponse =
	PerpetualsMarketCandleDataPoint[];

/**
 * Request body for computing the maximum order size for an account in a
 * given market.
 */
export interface ApiPerpetualsMaxOrderSizeBody {
	marketId: PerpetualsMarketId;
	accountId: PerpetualsAccountId;
	side: PerpetualsOrderSide;
	leverage?: number;
	price?: number;
}

/**
 * Request body for fetching enriched order data for an account.
 */
export interface ApiPerpetualsAccountOrderDatasBody {
	accountId: PerpetualsAccountId;
	orderDatas: {
		orderId: PerpetualsOrderId;
		currentSize: bigint;
	}[];
}

/**
 * (Duplicated) request body for fetching enriched order data for an account.
 *
 * NOTE: This is intentionally left for compatibility; both interfaces are
 * identical.
 */
export interface ApiPerpetualsAccountOrderDatasBody {
	accountId: PerpetualsAccountId;
	orderDatas: {
		orderId: PerpetualsOrderId;
		currentSize: bigint;
	}[];
}

/**
 * Request body for fetching stop-order data associated with an account,
 * validated using a wallet signature.
 */
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

/**
 * Request body for creating a vault capability (vault cap) for a given wallet.
 */
export interface ApiPerpetualsCreateVaultCapBody {
	walletAddress: SuiAddress;
	// TODO: add tx support ?
	// txKind?: SerializedTransaction;
}

/**
 * Request body for creating a new vault with initial deposit.
 *
 * The deposit can be specified either:
 * - As a numeric `initialDepositAmount`, or
 * - As an existing `depositCoinArg` (coin object).
 */
export type ApiPerpetualsCreateVaultBody = {
	name: string;
	walletAddress: SuiAddress;
	lpCoinType: CoinType;
	collateralCoinType: CoinType;
	collateralOracleId: ObjectId;
	// NOTE: is this correct ?
	lockPeriodMs: bigint;
	ownerFeePercentage: Percentage;
	// NOTE: is this correct ?
	forceWithdrawDelayMs: bigint;
	txKind?: SerializedTransaction;
	isSponsoredTx?: boolean;
} & (
	| {
			initialDepositAmount: Balance;
	  }
	| {
			initialDepositCoinArg: TransactionObjectArgument;
	  }
);

/**
 * Request body for creating a new perpetuals account for a given wallet
 * and collateral coin type.
 */
export interface ApiPerpetualsCreateAccountBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	txKind?: SerializedTransaction;
}

/**
 * Request body for depositing collateral into a perpetuals account or vault.
 *
 * The deposit can be provided by:
 * - `depositAmount` (numeric amount), or
 * - `depositCoinArg` (Sui coin object).
 */
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

/**
 * Request body for withdrawing collateral from an account or vault.
 */
export type ApiPerpetualsWithdrawCollateralBody = {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	withdrawAmount: Balance;
	// TODO: find out if this is needed
	/** Optional destination wallet address; defaults to owner if omitted. */
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

/**
 * Response body for withdraw-collateral transactions.
 *
 * The SDK typically uses `txKind` to reconstruct a transaction locally.
 */
export interface ApiPerpetualsWithdrawCollateralResponse {
	txKind: SerializedTransaction;
	// TODO: find out if this is needed
	// coinOutArg: TransactionObjectArgument | undefined;
	coinOutArg: TransactionObjectArgument; // | undefined;
}

/**
 * Request body for transferring collateral between two perpetuals accounts.
 */
export interface ApiPerpetualsTransferCollateralBody {
	walletAddress: SuiAddress;
	collateralCoinType: CoinType;
	fromAccountId: PerpetualsAccountId;
	toAccountId: PerpetualsAccountId;
	transferAmount: Balance;
	txKind?: SerializedTransaction;
}

/**
 * Request body for allocating collateral to a given market (account/vault).
 */
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

/**
 * Request body for deallocating collateral from a given market (account/vault).
 */
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

/**
 * SDK-level inputs for placing one or more stop orders.
 *
 * This is a client-facing type that wraps the on-chain format.
 */
export interface SdkPerpetualsPlaceStopOrdersInputs {
	/** Stop orders to place (without objectId, which is created on-chain). */
	stopOrders: Omit<PerpetualsStopOrderData, "objectId">[];
	/** Optional transaction to embed the call in. */
	tx?: Transaction;
	/** Optional gas coin for sponsored or custom gas usage. */
	gasCoinArg?: TransactionObjectArgument;
	/** Whether the transaction is expected to be sponsored by the API. */
	isSponsoredTx?: boolean;
}

/**
 * Request body for placing stop orders via the API.
 */
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

/**
 * SDK-level inputs for placing stop-loss / take-profit orders bound to a
 * specific market and position side.
 */
export type SdkPerpetualsPlaceSlTpOrdersInputs = {
	marketId: PerpetualsMarketId;
	/** Optional target size for SL/TP orders (scaled base units). */
	size?: bigint;
	/** Index price at which to trigger stop loss. */
	stopLossIndexPrice?: number;
	/** Index price at which to trigger take profit. */
	takeProfitIndexPrice?: number;
	/** Optional transaction to embed in. */
	tx?: Transaction;
	/** Optional gas coin argument. */
	gasCoinArg?: TransactionObjectArgument;
	/** Whether to treat the transaction as sponsored. */
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

/**
 * API request body for placing SL/TP orders bound to a position.
 */
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

/**
 * API request body for editing existing stop orders for an
 * account or vault.
 */
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

/**
 * API request body for placing a market order in a given market.
 *
 * This form is used by the backend and includes contextual information
 * like `accountId` or `vaultId`.
 */
export type ApiPerpetualsMarketOrderBody = {
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	/** Order size in scaled base units. */
	size: bigint;
	/** Change in collateral allocated to this position (collateral units). */
	collateralChange: number;
	/** Whether the account already has a position in this market. */
	hasPosition: boolean;
	/** If true, order can only reduce an existing position. */
	reduceOnly: boolean;
	/** Optional leverage override. */
	leverage?: number;
	/** Optional SL/TP instructions to be placed along with the market order. */
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
	/** Optional serialized transaction kind if assembled by the API. */
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

/**
 * API request body for placing a limit order in a given market.
 */
export type ApiPerpetualsLimitOrderBody = {
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	/** Order size in scaled base units. */
	size: bigint;
	/** Limit price in scaled fixed-point representation. */
	price: bigint;
	/** How the order behaves on the orderbook. */
	orderType: PerpetualsOrderType;
	/** Change in collateral allocated to this position. */
	collateralChange: number;
	/** Whether the account already has a position in this market. */
	hasPosition: boolean;
	/** If true, order can only reduce an existing position. */
	reduceOnly: boolean;
	/** Optional expiration for the order. */
	expiryTimestamp?: bigint;
	/** Optional leverage override. */
	leverage?: number;
	/** Optional SL/TP instructions to be placed along with the limit order. */
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
	/** Optionally pre-built transaction payload. */
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

/**
 * API request body for canceling one or more orders for an
 * account or vault, per market.
 */
export type ApiPerpetualsCancelOrdersBody = {
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
			/** Collateral change associated with canceling these orders. */
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

/**
 * API request body for canceling stop orders identified by object IDs.
 */
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

/**
 * API body for setting leverage on an existing position.
 */
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

/**
 * 24 hour statistics for a single perpetuals market.
 */
export interface PerpetualsMarket24hrStats {
	/** 24h volume in USD. */
	volumeUsd: number;
	/** 24h volume in base asset units. */
	volumeBaseAssetAmount: number;
	/** Absolute price change over 24 hours. */
	priceChange: number;
	/** Relative price change percentage over 24 hours. */
	priceChangePercentage: number;
}

/**
 * Response type for requesting 24h stats for multiple markets.
 */
export type ApiPerpetualsMarkets24hrStatsResponse = PerpetualsMarket24hrStats[];

// =========================================================================
//  Vaults
// =========================================================================

/**
 * API body to process forced withdrawals in a vault.
 */
export interface ApiPerpetualsVaultProcessForceWithdrawsTxBody {
	vaultId: ObjectId;
	/** Per-market sizes to close as part of force withdraw. */
	sizesToClose: Record<PerpetualsMarketId, Balance>;
	txKind?: SerializedTransaction;
}

/**
 * API body to process regular withdraw requests for a vault.
 */
export interface ApiPerpetualsVaultProcessWithdrawRequestsTxBody {
	vaultId: ObjectId;
	userAddresses: SuiAddress[];
	txKind?: SerializedTransaction;
}

/**
 * API body to update slippage parameters for pending vault withdraw
 * requests across several vaults.
 */
export interface ApiPerpetualsVaultUpdateWithdrawRequestSlippagesTxBody {
	vaultIds: ObjectId[];
	minLpAmountsOut: Balance[];
	txKind?: SerializedTransaction;
}

/**
 * API body to update the force-withdrawal delay in a vault.
 */
export interface ApiPerpetualsVaultUpdateForceWithdrawDelayTxBody {
	vaultId: ObjectId;
	forceWithdrawDelayMs: bigint;
	txKind?: SerializedTransaction;
}

/**
 * API body to update the lock period on a vault.
 */
export interface ApiPerpetualsVaultUpdateLockPeriodTxBody {
	vaultId: ObjectId;
	lockPeriodMs: bigint;
	txKind?: SerializedTransaction;
}

/**
 * API body to update the owner's fee percentage on a vault.
 */
export interface ApiPerpetualsVaultUpdateOwnerFeePercentageTxBody {
	vaultId: ObjectId;
	ownerFeePercentage: number;
	txKind?: SerializedTransaction;
}

/**
 * API body for the vault owner withdrawing collected fees.
 */
export interface ApiPerpetualsVaultWithdrawOwnerFeesTxBody {
	vaultId: ObjectId;
	withdrawAmount: Balance;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
}

/**
 * Response for owner-fee withdrawal transactions.
 */
export interface ApiPerpetualsVaultWithdrawOwnerFeesTxResponse {
	txKind: SerializedTransaction;
	coinOutArg: TransactionObjectArgument | undefined;
}

/**
 * Request body for fetching all withdrawal requests for specific vaults.
 */
export interface ApiPerpetualsVaultsWithdrawRequestsBody {
	vaultIds: ObjectId[];
}

/**
 * Request body for fetching withdrawal requests for a given wallet across
 * its vault positions.
 */
export interface ApiPerpetualsVaultWithdrawRequestsBody {
	walletAddress: SuiAddress;
	// vaultIds: ObjectId[] | undefined;
}

/**
 * API body for creating a single withdraw request from a vault.
 */
export interface ApiPerpetualsVaultCreateWithdrawRequestTxBody {
	vaultId: ObjectId;
	lpWithdrawAmount: Balance;
	minLpWithdrawAmount: Balance;
	txKind?: SerializedTransaction;
}

/**
 * API body for canceling withdrawal requests across vaults for a wallet.
 */
export interface ApiPerpetualsVaultCancelWithdrawRequestsTxBody {
	vaultIds: ObjectId[];
	walletAddress: SuiAddress;
	txKind?: SerializedTransaction;
}

/**
 * Request body for depositing into a vault.
 *
 * Deposit can be specified as a numeric amount or as an existing coin object.
 */
export type ApiPerpetualsVaultDepositTxBody = {
	vaultId: ObjectId;
	walletAddress: SuiAddress;
	minLpAmountOut: Balance;
	txKind?: SerializedTransaction;
	isSponsoredTx?: boolean;
} & (
	| {
			depositAmount: Balance;
			collateralCoinType: CoinType;
	  }
	| {
			depositCoinArg: TransactionObjectArgument;
	  }
);

/**
 * Request body for previewing a vault withdrawal request.
 */
export interface ApiPerpetualsVaultPreviewCreateWithdrawRequestBody {
	vaultId: ObjectId;
	lpWithdrawAmount: Balance;
}

/**
 * Response body for vault withdrawal preview.
 */
export interface ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse {
	collateralAmountOut: Balance;
	collateralPrice: number;
}

/**
 * Request body for previewing a vault deposit.
 */
export interface ApiPerpetualsVaultPreviewDepositBody {
	vaultId: ObjectId;
	// TODO: rename collateralDepositAmount ?
	depositAmount: Balance;
}

/**
 * Response body for vault deposit preview.
 */
export interface ApiPerpetualsVaultPreviewDepositResponse {
	lpAmountOut: number;
	collateralPrice: number;
	depositedAmountUsd: number;
}

/**
 * Request body for previewing forced withdraw processing for a vault.
 */
export interface ApiPerpetualsVaultPreviewProcessForceWithdrawBody {
	vaultId: ObjectId;
	walletAddress: SuiAddress;
}

/**
 * Response body for forced withdraw processing preview.
 */
export interface ApiPerpetualsVaultPreviewProcessForceWithdrawResponse {
	collateralAmountOut: Balance;
	collateralPrice: number;
	// TODO: change to arr ?
	sizesToClose: Record<PerpetualsMarketId, bigint>;
}

/**
 * Request body for previewing normal withdraw requests processing for a vault.
 */
export interface ApiPerpetualsVaultPreviewProcessWithdrawRequestsBody {
	vaultId: ObjectId;
	userAddresses: SuiAddress[];
}

/**
 * Response body for previewing normal withdraw requests processing.
 */
export interface ApiPerpetualsVaultPreviewProcessWithdrawRequestsResponse {
	userPreviews: {
		userAddress: SuiAddress;
		lpAmountOut: number;
	}[];
	collateralPrice: number;
}

/**
 * Request body for previewing maximum owner fees withdrawable from a vault.
 */
export interface ApiPerpetualsVaultPreviewWithdrawOwnerFeesBody {
	vaultId: ObjectId;
}

/**
 * Response body for previewing vault owner fee withdrawal.
 */
export interface ApiPerpetualsVaultPreviewWithdrawOwnerFeesResponse {
	maxFeesToWithdraw: Balance;
	// maxFeesToWithdrawUsd: number;
	feeCoinType: CoinType;
}

// =========================================================================
//  SDK
// =========================================================================

/**
 * SDK-level inputs for placing a market order from a client.
 *
 * This omits server-managed fields like `accountId`, `hasPosition`,
 * and serialized `txKind`, and exposes a client-friendly `slTp` wrapper.
 */
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

/**
 * SDK-level inputs for placing a limit order from a client.
 */
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

/**
 * SDK-level inputs for previewing a market order.
 */
export type SdkPerpetualsPlaceMarketOrderPreviewInputs = Omit<
	ApiPerpetualsPreviewPlaceMarketOrderBody,
	"collateralCoinType" | "accountId"
>;

/**
 * SDK-level inputs for previewing a limit order.
 */
export type SdkPerpetualsPlaceLimitOrderPreviewInputs = Omit<
	ApiPerpetualsPreviewPlaceLimitOrderBody,
	"collateralCoinType" | "accountId"
>;

/**
 * SDK-level inputs for previewing order cancellations.
 */
export type SdkPerpetualsCancelOrdersPreviewInputs = Omit<
	ApiPerpetualsPreviewCancelOrdersBody,
	"collateralCoinType" | "accountId"
>;

// =========================================================================
//  Websocket
// =========================================================================

// /perpetuals/ws/updates

/**
 * Action for websocket subscription messages.
 */
export type PerpetualsWsUpdatesSubscriptionAction = "subscribe" | "unsubscribe";

/**
 * Websocket subscription payload for subscribing to a specific market's
 * updates (orderbook, prices, etc.).
 */
export interface PerpetualsWsUpdatesMarketSubscriptionType {
	market: {
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for subscribing to user/account updates,
 * optionally including stop-order data (via signature).
 */
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

/**
 * Websocket subscription payload for market oracle price updates.
 */
export interface PerpetualsWsUpdatesOracleSubscriptionType {
	oracle: {
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for orderbook updates.
 */
export interface PerpetualsWsUpdatesOrderbookSubscriptionType {
	orderbook: {
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for market trades stream.
 */
export interface PerpetualsWsUpdatesMarketTradesSubscriptionType {
	marketTrades: {
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for user-specific trade updates.
 */
export interface PerpetualsWsUpdatesUserTradesSubscriptionType {
	userTrades: {
		accountId: PerpetualsAccountId;
	};
}

/**
 * Websocket subscription payload for user-specific collateral changes.
 */
export interface PerpetualsWsUpdatesUserCollateralChangesSubscriptionType {
	userCollateralChanges: {
		accountId: PerpetualsAccountId;
	};
}

/**
 * Union of all websocket subscription types for perpetuals updates.
 */
export type PerpetualsWsUpdatesSubscriptionType =
	| PerpetualsWsUpdatesMarketSubscriptionType
	| PerpetualsWsUpdatesUserSubscriptionType
	| PerpetualsWsUpdatesOracleSubscriptionType
	| PerpetualsWsUpdatesOrderbookSubscriptionType
	| PerpetualsWsUpdatesMarketTradesSubscriptionType
	| PerpetualsWsUpdatesUserTradesSubscriptionType
	| PerpetualsWsUpdatesUserCollateralChangesSubscriptionType;

/**
 * Websocket payload for oracle price updates.
 */
export interface PerpetualsWsUpdatesOraclePayload {
	marketId: PerpetualsMarketId;
	basePrice: number;
	collateralPrice: number;
}

/**
 * Websocket payload for market trades stream.
 */
export interface PerpetualsWsUpdatesMarketTradesPayload {
	marketId: PerpetualsMarketId;
	trades: PerpetualsTradeHistoryData[];
}

/**
 * Websocket payload for user-specific trades stream.
 */
export interface PerpetualsWsUpdatesUserTradesPayload {
	accountId: PerpetualsAccountId;
	trades: PerpetualsAccountTrade[];
}

/**
 * Websocket payload for user-specific collateral changes.
 */
export interface PerpetualsWsUpdatesUserCollateralChangesPayload {
	accountId: PerpetualsAccountId;
	collateralChanges: PerpetualsAccountCollateralChange[];
}

/**
 * Websocket payload for incremental orderbook updates.
 */
export interface PerpetualsWsUpdatesOrderbookPayload {
	marketId: PerpetualsMarketId;
	orderbookDeltas: PerpetualsOrderbookDeltas;
}

/**
 * Websocket payload for user account and stop-order updates.
 */
export interface PerpetualsWsUpdatesUserPayload {
	account: PerpetualsAccountObject;
	stopOrders: PerpetualsStopOrderData[] | undefined;
}

/**
 * Websocket subscription message format sent by clients to manage
 * their subscriptions.
 */
export interface PerpetualsWsUpdatesSubscriptionMessage {
	action: PerpetualsWsUpdatesSubscriptionAction;
	subscriptionType: PerpetualsWsUpdatesSubscriptionType;
}

/**
 * Websocket response message for `/perpetuals/ws/updates`.
 *
 * Each response includes exactly one of the following discriminated unions.
 */
export type PerpetualsWsUpdatesResponseMessage =
	| { market: PerpetualsMarketData }
	| { user: PerpetualsWsUpdatesUserPayload }
	| { oracle: PerpetualsWsUpdatesOraclePayload }
	| { orderbook: PerpetualsWsUpdatesOrderbookPayload }
	| { marketTrades: PerpetualsWsUpdatesMarketTradesPayload }
	| { userTrades: PerpetualsWsUpdatesUserTradesPayload }
	| {
			userCollateralChanges: PerpetualsWsUpdatesUserCollateralChangesPayload;
	  };

// /perpetuals/ws/market-candles/{market_id}/{interval_ms}

/**
 * Websocket response message carrying the last candle for a given market
 * and interval.
 */
export interface PerpetualsWsCandleResponseMessage {
	marketId: PerpetualsMarketId;
	lastCandle: PerpetualsMarketCandleDataPoint | undefined;
}
