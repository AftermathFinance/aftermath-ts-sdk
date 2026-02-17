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
	Slippage,
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
	/**
	 * Stop Loss / Take Profit stop order. Can to be placed to close (fully or partially)
	 * the position.
	 */
	SlTp = 0,
	/**
	 * Stop order that can be both reduce or increase the position's size. May require
	 * some collateral to be allocated to be able to be placed.
	 */
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
	/** True if this account cap was allocated to an agent wallet from the admin account cap owner. */
	isAgent: boolean;
	/** Initial shared version of the underlying perpetuals `Account` object. Required when constructing transactions that reference the shared account object. */
	accountObjectInitialSharedVersion: ObjectVersion;
	/** Sui object IDs of agent account caps that have been whitelisted to operate on behalf of this account. */
	whitelistedAgentCapIds: ObjectId[];
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
	/** Collateral coin type used by the vault account. */
	collateralCoinType: CoinType;
	/** Perpetuals account ID controlled by the vault. */
	accountId: PerpetualsAccountId;
	/** Object ID of the account object owned by the vault. */
	accountObjectId: ObjectId;
}

export type PerpetualsPartialVaultCap = Omit<PerpetualsVaultCap, "objectId">;

/**
 * Representation of an LP (share) coin position for a specific vault.
 *
 * This is typically returned by API endpoints that enumerate a wallet's vault
 * positions. `lpAmount` is the raw on-chain balance for the vault's LP coin type.
 *
 * Notes:
 * - `lpAmountUsd` is a convenience valuation derived from current vault TVL and LP supply.
 * - The LP coin itself is an on-chain `Coin<T>` object, but here we expose the derived,
 *   aggregated view needed by UIs.
 */
export interface PerpetualsVaultLpCoin {
	/** Vault identifier that minted the LP coin. */
	vaultId: ObjectId;
	/** Object ID of the specific LP coin object held by the user. */
	objectId: ObjectId;
	/** Raw LP token amount (native units; not human-decimal adjusted). */
	lpAmount: Balance;
	/** Estimated USD value of `lpAmount` at query time. */
	lpAmountUsd: number;
}

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
		/** Current size remaining of the order in base units (scaled as bigint). */
		currentSize: bigint;
		/** Initial size of the order in base units (scaled as bigint). */
		initialSize: bigint;
	}[];
	/** Maker fee rate applied to this position (as a fraction). */
	makerFee: Percentage;
	/** Taker fee rate applied to this position (as a fraction). */
	takerFee: Percentage;
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
	makerFee: Percentage;
	/** Taker fee rate (fraction) charged for taking liquidity. */
	takerFee: Percentage;
	/** Liquidation fee rate (fraction) charged on liquidations. */
	liquidationFee: Percentage;
	/** Fee rate (fraction) for forced cancellation. */
	forceCancelFee: Percentage;
	/** Fraction of fees directed to the insurance fund. */
	insuranceFundFee: Percentage;
	/** Minimum notional order value in USD. */
	minOrderUsdValue: number;
	/** Minimum base size increment for orders (lot size, scaled bigint). */
	lotSize: bigint;
	/** Minimum price increment (tick size, scaled bigint). */
	tickSize: bigint;
	/** Scaling factor used in internal fixed-point conversions. */
	scalingFactor: number;
	/** Additional taker fee that depends on gas cost. */
	gasPriceTakerFee: Percentage;
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
	/** Current size remaining in scaled base units. */
	currentSize: bigint;
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
 * Optional integrator fee configuration for an order.
 *
 * When provided, this allows an approved integrator to collect a fee on the taker
 * volume generated by this order. The integrator must have been previously approved
 * by the user via the create-integration endpoint, and the taker fee must not exceed
 * the maximum fee approved by the user.
 */
export interface PerpetualsBuilderCodeParamaters {
	/**
	 * Sui address of the integrator who will receive the fee.
	 *
	 * This integrator must have been previously approved by the account owner,
	 * and must have a vault created for the market where the order is being placed.
	 */
	integratorAddress: SuiAddress;

	/**
	 * Taker fee (as a decimal) to be charged on this order's taker volume.
	 *
	 * For example, 0.0005 represents a 0.05% fee. This value must not exceed
	 * the maximum taker fee that the user approved for this integrator.
	 * The fee is only applied to taker volume (not maker volume).
	 */
	takerFee: Percentage;
}

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
		/** Unique order identifier for limit order sl/tp is tied to. */
		limitOrderId?: PerpetualsOrderId;
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
 * Human-facing metadata for vault discovery / browsing.
 *
 * This is intended for UI display and is not used for any on-chain risk or
 * accounting logic.
 *
 * Note: The type name contains a historical misspelling ("Metatada") and is
 * preserved for backward compatibility.
 */
export interface PerpetualsVaultMetatada {
	/**
	 * A human-readable name for the `Vault`.
	 */
	name: string;
	/**
	 * A verbose description of the `Vault`.
	 */
	description: string;
	/**
	 * The `Vault` curator's name.
	 */
	curatorName: string | undefined;
	/**
	 * A url for the `Vault`'s curator. Ideally their website.
	 */
	curatorUrl: string | undefined;
	/**
	 * An image url for the `Vault`'s curator. Ideally their logo.
	 */
	curatorLogoUrl: string | undefined;
	/**
	 * Extra / optional fields for future extensibility. Recommended keys include: twitter_url.
	 */
	extraFields: Record<string, string>;
}

/**
 * On-chain representation of a vault that manages user collateral and
 * interacts with clearing houses on their behalf.
 */
export interface PerpetualsVaultObject {
	/**
	 * Unique identifier for distinct network identification.
	 */
	objectId: ObjectId;
	/**
	 * Contract version number for controlled upgrades.
	 */
	version: bigint;
	/**
	 * Curator-provided metadata used for vault discovery and display.
	 *
	 * This data is expected to be relatively stable and is typically set at
	 * creation time (though it may be updatable depending on protocol rules).
	 */
	metadata: PerpetualsVaultMetatada;
	/**
	 * Supply of LP coins from a `TreasuryCap` for liquidity integrity.
	 *
	 * This is the total minted supply of the vault's LP token. Together with
	 * `tvlUsd` and `totalCollateral`, this is used to derive LP share price.
	 */
	lpSupply: Balance;
	/**
	 * Total balance of underlying Coin (`C`), deposited by users.
	 *
	 * "Idle" collateral is not currently allocated to any clearing house
	 * position. It remains held by the vault and can be used for new allocations
	 * or withdrawals (subject to lock/queue rules).
	 */
	idleCollateral: Balance;
	/**
	 * USD valuation of `idleCollateral` at query time.
	 *
	 * This is derived using the vault's collateral oracle price and is provided
	 * for UI convenience.
	 */
	idleCollateralUsd: number;
	/**
	 * Total collateral owned by the vault in native units.
	 *
	 * This is the sum of:
	 * - idle collateral held directly by the vault, and
	 * - collateral currently allocated across clearing houses/positions.
	 */
	totalCollateral: Balance;
	/**
	 * USD valuation of `totalCollateral` at query time.
	 *
	 * This is typically derived from `totalCollateral` and the collateral oracle
	 * price used by the vault.
	 */
	totalCollateralUsd: number;
	/**
	 * Total value locked in USD for this vault.
	 *
	 * Depending on protocol accounting, this may match `totalCollateralUsd`, or
	 * may incorporate additional adjustments. It is the primary headline number
	 * used for ranking and display.
	 */
	tvlUsd: number;
	/**
	 * IDs of `ClearingHouse` where `Vault` has positions.
	 */
	marketIds: PerpetualsMarketId[];
	/**
	 * Vault parameters
	 */
	parameters: {
		/**
		 * Lock-in duration for engaged assets in milliseconds.
		 */
		lockPeriodMs: bigint;
		/**
		 * Fee rate for vault's owner, collected from user's profits when they withdraw
		 */
		performanceFeePercentage: number;
		/**
		 * Delay period to wait for eventual force withdrawing
		 *
		 * Force-withdrawal is an emergency/escape hatch path; this delay gives the
		 * vault time to unwind positions before executing the withdrawal.
		 */
		forceWithdrawDelayMs: bigint;
		/**
		 * Price feed storage id idetifying the oracle price for `C`
		 */
		collateralPriceFeedStorageId: ObjectId;
		/**
		 * Source object ID for the collateral price feed storage.
		 *
		 * Some oracle integrations separate the "storage object" from the "source"
		 * (e.g., an aggregator or publisher object). This field identifies the
		 * upstream source used to populate `collateralPriceFeedStorageId`.
		 */
		collateralPriceFeedStorageSourceId: ObjectId;
		/**
		 * Maximum tolerated deviation for the collateral oracle price.
		 *
		 * Used as a safety bound when valuing deposits/withdrawals and computing
		 * USD conversions. This is typically a fixed-point or scaled bigint value,
		 * consistent with the on-chain oracle representation.
		 */
		collateralPriceFeedStorageTolerance: bigint;
		/**
		 * Maximum margin ratio tolerance for force-withdraw processing.
		 *
		 * Force-withdraw generally requires closing positions. This tolerance
		 * controls how much worse (or better) the resulting margin ratio is allowed
		 * to be, compared to a target/expected value, before rejecting the action.
		 */
		maxForceWithdrawMarginRatioTolerance: number;
		/**
		 * Scaling factor to apply to `C` to convert a balance to ifixed.
		 */
		/**
		 * Used to calculate user's minimum deposit value in usd
		 */
		scalingFactor: number;
		/**
		 * The maximum number of distinct `ClearingHouse`.
		 */
		maxMarketsInVault: bigint;
		/**
		 * The maximum number of pending orders allowed for a single position in the `Vault`.
		 */
		maxPendingOrdersPerPosition: bigint;
		/**
		 * Maximum total collateral (native units) that can be deposited into the vault.
		 *
		 * This is a capacity/risk control parameter. Deposits that would cause the
		 * vault to exceed this limit should be rejected by the protocol/backend.
		 */
		maxTotalDepositedCollateral: Balance;
		/** Minimum position margin (USD) to trigger full close during force withdraw. */
		minForceWithdrawValueUsd: number;
	};
	/** Owner address of the vault. */
	ownerAddress: SuiAddress;
	/** Creation timestamp of the vault. */
	creationTimestamp: Timestamp | undefined;
	/** Underlying perpetuals account ID that the vault uses. */
	accountId: PerpetualsAccountId;
	/** Account object ID used by the vault. */
	accountObjectId: ObjectId;
	/** Collateral coin type accepted by this vault. */
	collateralCoinType: CoinType;
	/**
	 * LP coin type minted by this vault.
	 *
	 * This is the `Coin<T>` type used to represent shares in the vault. Users
	 * receive LP coins on deposit and burn/return them on withdrawal.
	 */
	lpCoinType: CoinType;
	/** Decimals for the LP token minted by this vault. */
	lpCoinDecimals: CoinDecimal;
	/**
	 * Estimated monthly APR for this vault, expressed as a percentage.
	 *
	 * This is typically computed off-chain from historical performance and/or
	 * accounting state. It is a display metric and should not be treated as a
	 * guaranteed rate.
	 */
	monthlyAprPercentage: Percentage;
	/** The annualized percentage return from incentives (added yields) */
	monthlyBoostedAprPercentage: Percentage;
	/** Indicates the vault is temporarily paused until the timestamp (if present). */
	pausedUntilTimestamp: bigint | undefined;
	/** Timestamp at which `pause_vault_for_force_withdraw` was last called. */
	lastPausedTimestamp: Timestamp;
}

/**
 * Represents a single pending vault withdrawal request.
 */
export interface PerpetualsVaultWithdrawRequest {
	/**
	 * The address of the user that created the withdraw request
	 */
	userAddress: SuiAddress;
	/**
	 * Object id of the vault associated with the withdraw request
	 */
	vaultId: SuiAddress;
	/**
	 * The amount of the shares requested for withdrawal.
	 */
	lpAmountIn: Balance;
	/**
	 * USD valuation of `lpAmountIn` at request time (or at query time, depending on backend).
	 *
	 * This field is provided for UI convenience and may be computed using the
	 * vault's LP share price.
	 */
	lpAmountInUsd: number;
	/**
	 * Timestamp of request's creation
	 */
	requestTimestamp: Timestamp;
	/**
	 * The minimum amount of the collateral balance expected as output for this withdrawal
	 *
	 * This acts as a slippage/price-protection bound for the user.
	 */
	minCollateralAmountOut: Balance;
	/**
	 * USD valuation of `minCollateralAmountOut`, using the vault's collateral oracle.
	 *
	 * Provided for display; the on-chain constraint is enforced by
	 * `minCollateralAmountOut` (native units).
	 */
	minCollateralAmountOutUsd: number;
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
export type ApiPerpetualsAccountCollateralHistoryResponse =
	ApiPerpetualsHistoricalDataWithCursorResponse & {
		/** Collateral changes in chronological order. */
		collateralChanges: PerpetualsAccountCollateralChange[];
	};

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
 * Cursor-based response wrapping a list of orders for an account.
 */
export type ApiPerpetualsAccountOrderHistoryResponse =
	ApiPerpetualsHistoricalDataWithCursorResponse & {
		/** Orders in chronological order. */
		orders: PerpetualsAccountOrderHistoryData[];
	};

/**
 * Historical margin data point for an account, used in margin history views.
 */
export interface PerpetualsAccountMarginHistoryData {
	/** Timestamp of this snapshot. */
	timestamp: Timestamp;
	/** Available collateral in USD. */
	availableCollateralUsd: number;
	/** Total equity in USD. */
	totalEquityUsd: number;
	/** Unrealized funding PnL in USD at that time. */
	unrealizedFundingsUsd: number;
	/** Unrealized position PnL in USD at that time. */
	unrealizedPnlUsd: number;
}

/**
 * Individual order affecting an account.
 */
export type PerpetualsAccountOrderHistoryData = {
	/** Timestamp of the order. */
	timestamp: Timestamp;
	/** Sui transaction digest. */
	txDigest: TransactionDigest;
	/** Market in which this order occurred. */
	marketId: PerpetualsMarketId;
	/** Concrete event type. */
	eventType: AnyObjectType;
	/** Side of the order relative to the account (Bid/Ask). */
	side: PerpetualsOrderSide;
	/** Price for this order. */
	price: number;
	/** Size in base units. */
	size: number;
	/** Optional stop-loss / take-profit data. */
	slTp?: {
		/** Optional stop-loss trigger price based on the index price. */
		stopLossIndexPrice?: number;
		/** Optional take-profit trigger price based on the index price. */
		takeProfitIndexPrice?: number;
		/** Unique order identifier for limit order sl/tp is tied to. */
		limitOrderId?: PerpetualsOrderId;
	};
	/** Stop order data that is not a stop-loss / take-profit order
	 * (e.g. generic trigger orders).
	 */
	stopOrder?: {
		/** Index price at which the stop order should trigger. */
		stopIndexPrice: number;
	};
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
export interface PerpetualsMarketOrderHistoryData {
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
 * Cursor-based wrapper for market-level order history.
 */
export type ApiPerpetualsMarketOrderHistoryResponse =
	ApiPerpetualsHistoricalDataWithCursorResponse & {
		/** Orders in this page. */
		orders: PerpetualsMarketOrderHistoryData[];
	};

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
	collateralCoinTypes?: CoinType[];
}

/**
 * Request body for fetching specific admin account caps by their account IDs.
 */
export interface ApiPerpetualsAdminAccountCapsBody {
	accountIds: PerpetualsAccountId[];
}

/**
 * Response payload for fetching positions for one or more accounts.
 *
 * The backend returns a list of {@link PerpetualsAccountObject} snapshots.
 * Each snapshot includes per-market {@link PerpetualsPosition} data.
 */
export interface ApiPerpetualsAccountPositionsResponse {
	accounts: PerpetualsAccountObject[];
}

/**
 * Request body for fetching positions for a set of accounts.
 *
 * `marketIds` can be supplied as an optimization hint to limit the markets
 * included in each account's returned `positions` array.
 */
export interface ApiPerpetualsAccountPositionsBody {
	accountIds: PerpetualsAccountId[];
	// TODO: remove eventually ?
	marketIds?: PerpetualsMarketId[];
}

/**
 * Response payload for fetching admin account caps by explicit account IDs.
 */
export interface ApiPerpetualsAdminAccountCapsResponse {
	accountCaps: PerpetualsAccountCap[];
}

/**
 * Response payload for fetching all account caps owned by a wallet.
 *
 * This is typically used during onboarding / wallet connect to discover
 * existing accounts.
 */
export interface ApiPerpetualsOwnedAccountCapsResponse {
	accountCaps: PerpetualsAccountCap[];
}

// =========================================================================
//  Interactions
// =========================================================================

/**
 * Generic shape for Perpetuals API historical data requests that include
 * `beforeTimestampCursor` and `limit` pagination parameters.
 */
export interface ApiPerpetualsHistoricalDataWithCursorBody {
	/**
	 * Cursor for pagination.
	 */
	beforeTimestampCursor?: Timestamp;
	/**
	 * Limit for pagination.
	 */
	limit?: number;
}

/**
 * Generic shape for Perpetuals API historical data responses that include
 * `nextBeforeTimestampCursor` pagination parameter.
 */
export interface ApiPerpetualsHistoricalDataWithCursorResponse {
	/**
	 * The next cursor position. If undefined, no more data is available.
	 */
	nextBeforeTimestampCursor: Timestamp | undefined;
}

/**
 * Enumerates the timeframes available for retrieving historical account margin data,
 * such as `"1D"`, `"1W"`, `"1M"`, etc.
 */
export type PerpetualsAccountMarginHistoryTimeframeKey =
	| "1D"
	| "1W"
	| "1M"
	| "ALL";

/**
 * Request payload for fetching historical margin metrics for an account.
 */
export interface ApiPerpetualsAccountMarginHistoryBody {
	/**
	 * Account ID.
	 */
	accountId: PerpetualsAccountId;

	/**
	 * Timeframe from which to obtain historical data from.
	 */
	timeframe: PerpetualsAccountMarginHistoryTimeframeKey;
}

/**
 * Response payload for historical margin metrics.
 *
 * The returned array is ordered chronologically by `timestamp` (oldest -> newest)
 * unless the backend specifies otherwise.
 */
export interface ApiPerpetualsAccountMarginHistoryResponse {
	marginHistoryDatas: PerpetualsAccountMarginHistoryData[];
}

/**
 * Request body for fetching account-level order history with a cursor.
 */
export type ApiPerpetualsMarketOrderHistoryBody =
	ApiPerpetualsHistoricalDataWithCursorBody & {
		marketId: PerpetualsMarketId;
	};

/**
 * Request body for fetching account-level order history with a cursor.
 */
export type ApiPerpetualsAccountOrderHistoryBody =
	ApiPerpetualsHistoricalDataWithCursorBody & {
		accountId: PerpetualsAccountId;
		authentication?: {
			walletAddress: SuiAddress;
			bytes: string;
			signature: string;
		};
	};

/**
 * Request body for fetching account collateral history with a cursor.
 */
export type ApiPerpetualsAccountCollateralHistoryBody =
	ApiPerpetualsHistoricalDataWithCursorBody & {
		accountId: PerpetualsAccountId;
		authentication?: {
			walletAddress: SuiAddress;
			bytes: string;
			signature: string;
		};
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
	| "cancelSlTp"
	| "txKind"
	| "accountId"
	| "slTp"
	| "slippage"
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
	| "cancelSlTp"
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
			accountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
			/** Simulated position after the market order. */
			updatedPosition: PerpetualsPosition;
			/** Absolute price slippage between reference price and execution price. */
			priceSlippage: number;
			/** Relative price slippage expressed as a fraction
			 * (e.g. `0.01` == 1% slippage). */
			percentSlippage: number;
			/** Size that is expected to be filled immediately (in base units). */
			filledSize: number;
			/** Notional value in USD of the `filledSize`. */
			filledSizeUsd: number;
			/** Any size that remains posted as liquidity (for market orders this is
			 * usually zero unless partially resting is supported). */
			postedSize: number;
			/** Notional value in USD of the `postedSize`. For pure market orders this
			 * is typically `0`. */
			postedSizeUsd: number;
			/** Net collateral change in USD (e.g. fees, margin changes). */
			collateralChange: number;
			/** Effective execution price for the filled portion of the order. */
			executionPrice: number;
			/** Whether there is an existing position in this market. */
			hasPosition: boolean;
			/** True is position is closed. */
			cancelSlTp: boolean;
	  };

/**
 * Response type for cancel-order preview.
 */
export type ApiPerpetualsPreviewCancelOrdersResponse =
	| {
			error: string;
	  }
	| {
			marketIdsToData: Record<
				PerpetualsMarketId,
				{
					updatedPosition: PerpetualsPosition;
					collateralChange: number;
				}
			>;
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
 * Request payload for fetching historical candle (OHLCV) data for a given
 * perpetuals market.
 */
export interface ApiPerpetualsMarketCandleHistoryBody {
	/**
	 * Identifier of the perpetuals market whose candles you want to fetch.
	 *
	 * Must be a valid on-chain market ID.
	 */
	marketId: PerpetualsMarketId;

	/**
	 * Start of the time range to query, as a Unix timestamp in **milliseconds**.
	 */
	fromTimestamp: Timestamp;

	/**
	 * End of the time range to query, as a Unix timestamp in **milliseconds**.
	 */
	toTimestamp: Timestamp;

	/**
	 * Candle interval / resolution in **milliseconds** (e.g. 60_000 for 1m,
	 * 300_000 for 5m).
	 */
	intervalMs: number;
}

/**
 * Response type for historical market candle data.
 */
export interface ApiPerpetualsMarketCandleHistoryResponse {
	candles: PerpetualsMarketCandleDataPoint[];
}

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
	/**
	 * Optional integrator fee configuration for an order.
	 *
	 * If provided, the integrator specified in the configuration will receive a fee
	 * on the taker volume generated by this order. The integrator must have been
	 * previously approved by the account owner, and the fee must not exceed the
	 * maximum fee the user approved for that integrator.
	 */
	builderCode?: PerpetualsBuilderCodeParamaters;
}

/**
 * Request body for fetching stop-order data associated with an account or vault,
 * validated using a wallet signature.
 */
export type ApiPerpetualsStopOrderDatasBody = {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
	marketIds?: PerpetualsMarketId[];
} & (
	| {
			accountId: PerpetualsAccountId;
			accountCapId?: ObjectId;
	  }
	| {
			vaultId: ObjectId;
	  }
);

/**
 * Response payload for stop-order queries.
 *
 * Stop orders are returned in their normalized on-chain shape
 * ({@link PerpetualsStopOrderData}). Clients should interpret `slTp` vs `nonSlTp`
 * to determine the stop semantics.
 */
export interface ApiPerpetualsStopOrderDatasResponse {
	stopOrderDatas: PerpetualsStopOrderData[];
}

// =========================================================================
//  Transactions
// =========================================================================

/**
 * Request body for creating a vault capability (vault cap) for a given wallet.
 */
export interface ApiPerpetualsCreateVaultCapBody {
	walletAddress: SuiAddress;
	lpCoinMetadata: {
		/** Name for the token */
		name: string;
		/** Symbol for the token */
		symbol: string;
		/** Description of the token */
		description: string;
		/** URL for the token logo */
		iconUrl?: string;
	};
}

/**
 * Request body for creating a new vault with initial deposit.
 *
 * The deposit can be specified either:
 * - As a numeric `initialDepositAmount`, or
 * - As an existing `depositCoinArg` (coin object).
 */
export type ApiPerpetualsCreateVaultBody = {
	walletAddress: SuiAddress;
	metadata: {
		/**
		 * A human-readable name for the `Vault`.
		 */
		name: string;
		/**
		 * A verbose description of the `Vault`.
		 */
		description: string;
		/**
		 * The `Vault` curator's name.
		 */
		curatorName?: string;
		/**
		 * A url for the `Vault`'s curator. Ideally their website.
		 */
		curatorUrl?: string;
		/**
		 * An image url for the `Vault`'s curator. Ideally their logo.
		 */
		curatorLogoUrl?: string;
		/**
		 * Extra / optional fields for future extensibility. Recommended keys include: twitter_url.
		 */
		extraFields?: Record<string, string>;
	};
	coinMetadataId: ObjectId;
	treasuryCapId: ObjectId;
	collateralCoinType: CoinType;
	lockPeriodMs: bigint;
	performanceFeePercentage: Percentage;
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
 * Request payload for creating an integrator configuration approval transaction.
 *
 * This transaction allows a user to approve an integrator to receive fees on orders
 * placed on their behalf. The user sets a maximum taker fee that the integrator
 * can charge per order.
 */
export interface ApiPerpetualsBuilderCodesCreateIntegratorConfigTxBody {
	/**
	 * Account ID encoded as a bigint.
	 *
	 * This is the perpetuals account that is granting permission to the integrator.
	 */
	accountId: PerpetualsAccountId;

	/**
	 * Sui address of the integrator being approved.
	 *
	 * Must be a valid Sui object ID.
	 */
	integratorAddress: SuiAddress;

	/**
	 * Maximum taker fee (as a decimal) that the integrator can charge per order.
	 *
	 * For example, 0.001 represents a 0.1% maximum fee. The integrator can set
	 * any fee up to this maximum when placing orders on behalf of the user.
	 */
	maxTakerFee: Percentage;

	/**
	 * Optional existing transaction kind (base64-encoded) to extend.
	 *
	 * If provided, the new integrator approval will be added to this transaction.
	 */
	txKind?: SerializedTransaction;
}

/**
 * Request payload for creating a transaction to revoke an integrator's permissions.
 *
 * This transaction removes an integrator's approval to collect fees on orders
 * placed on behalf of the user. After revocation, the integrator will no longer
 * be able to submit orders with fees for this account.
 */
export interface ApiPerpetualsBuilderCodesRemoveIntegratorConfigTxBody {
	/**
	 * Account ID encoded as a bigint.
	 *
	 * This is the perpetuals account that is revoking the integrator's permission.
	 */
	accountId: PerpetualsAccountId;

	/**
	 * Sui address of the integrator whose permissions are being revoked.
	 *
	 * Must be a valid Sui object ID.
	 */
	integratorAddress: SuiAddress;

	/**
	 * Optional existing transaction kind (base64-encoded) to extend.
	 *
	 * If provided, the integrator removal will be added to this transaction.
	 */
	txKind?: SerializedTransaction;
}

/**
 * Request payload for creating a transaction to initialize an integrator fee vault.
 *
 * Before an integrator can claim fees from a specific market, they must first create
 * a vault for that market. This is a one-time setup per integrator per market.
 */
export interface ApiPerpetualsBuilderCodesCreateIntegratorVaultTxBody {
	/**
	 * Market (clearing house) ID where the integrator vault will be created.
	 *
	 * Must be a valid Sui object ID.
	 */
	marketId: PerpetualsMarketId;

	/**
	 * Sui address of the integrator creating the vault.
	 *
	 * Must be a valid Sui object ID.
	 * This integrator will be able to claim fees from this vault.
	 */
	integratorAddress: SuiAddress;

	/**
	 * Optional existing transaction kind (base64-encoded) to extend.
	 *
	 * If provided, the vault creation will be added to this transaction.
	 */
	txKind?: SerializedTransaction;
}

/**
 * Request payload for creating a transaction to claim accumulated integrator fees from a vault.
 *
 * Integrators earn fees on taker volume generated by orders they submit on behalf of users.
 * These fees accumulate in a vault per market (clearing house), and can be claimed at any time
 * by the integrator.
 */
export interface ApiPerpetualsBuilderCodesClaimIntegratorVaultFeesTxBody {
	/**
	 * Market (clearing house) ID where the integrator fees were earned.
	 *
	 * Must be a valid Sui object ID.
	 */
	marketId: PerpetualsMarketId;

	/**
	 * Sui address of the integrator claiming their fees.
	 *
	 * Must be a valid Sui object ID.
	 * Only the integrator who earned the fees can claim them.
	 */
	integratorAddress: SuiAddress;

	/**
	 * Optional recipient address for the claimed fees.
	 *
	 * When provided, the transaction will include an on-chain transfer of the
	 * claimed coin to this address. When omitted, the claimed coin is exposed
	 * as a transaction argument that can be used in subsequent commands.
	 */
	recipientAddress?: SuiAddress;

	/**
	 * Optional existing transaction kind (base64-encoded) to extend.
	 *
	 * If provided, the fee claim will be added to this transaction.
	 */
	txKind?: SerializedTransaction;
}

/**
 * Response payload for claim integrator vault fees transaction.
 *
 * Contains the transaction kind and optionally a coin output argument when
 * no recipient address was provided.
 */
export interface ApiPerpetualsBuilderCodesClaimIntegratorVaultFeesTxResponse {
	/**
	 * Base64-encoded Sui `TransactionKind` representing the claim (and
	 * optional transfer) transaction.
	 */
	txKind: SerializedTransaction;

	/**
	 * When `recipientAddress` is omitted, this contains a readable argument
	 * pointing to the claimed coin output, so callers can wire it into
	 * subsequent steps.
	 */
	coinOutArg?: TransactionObjectArgument;
}

/**
 * Request payload for fetching integrator configuration for a specific account and integrator.
 *
 * This endpoint checks whether an integrator has been approved by an account to collect fees,
 * and if so, returns the maximum taker fee the integrator is authorized to charge.
 */
export interface ApiPerpetualsBuilderCodesIntegratorConfigBody {
	/**
	 * Account ID encoded as a bigint.
	 *
	 * This is the perpetuals account whose integrator approval is being queried.
	 */
	accountId: PerpetualsAccountId;

	/**
	 * Sui address of the integrator whose configuration is being queried.
	 *
	 * Must be a valid Sui object ID.
	 */
	integratorAddress: SuiAddress;
}

/**
 * Response payload containing integrator configuration details.
 *
 * Returns whether an integrator configuration exists and the maximum taker fee
 * if the integrator has been approved.
 */
export interface ApiPerpetualsBuilderCodesIntegratorConfigResponse {
	/**
	 * Maximum taker fee (as a decimal) that the integrator is authorized to charge.
	 *
	 * For example, 0.001 represents a 0.1% maximum fee. This value is only meaningful
	 * if `exists` is true.
	 */
	maxTakerFee: Percentage | undefined;

	/**
	 * Whether an integrator configuration exists for this account-integrator pair.
	 *
	 * If false, the integrator has not been approved by the account and cannot
	 * collect fees on orders placed on behalf of the account.
	 */
	exists: boolean;
}

/**
 * Individual integrator vault data for a specific market.
 *
 * Contains the market ID and the accumulated fees available to claim from that market's vault.
 */
export interface PerpetualsIntegratorVaultData {
	/**
	 * Market (clearing house) object ID.
	 */
	marketId: PerpetualsMarketId;

	/**
	 * Total accumulated fees in the market's collateral currency that are available to claim.
	 *
	 * Fees are denominated in the collateral coin type used by the market.
	 */
	fees: number;
}

/**
 * Request payload for fetching integrator vault fees across multiple markets.
 *
 * This endpoint returns the accumulated fees an integrator has earned in their vaults
 * across one or more markets (clearing houses). These fees are generated from taker
 * volume on orders the integrator submitted on behalf of users.
 */
export interface ApiPerpetualsBuilderCodesIntegratorVaultsBody {
	/**
	 * List of market (clearing house) IDs to query for integrator vault fees.
	 *
	 * Each market ID must be a valid Sui object ID.
	 */
	marketIds: PerpetualsMarketId[];

	/**
	 * Sui address of the integrator whose vault fees are being queried.
	 *
	 * Must be a valid Sui object ID.
	 */
	integratorAddress: SuiAddress;
}

/**
 * Response payload containing accumulated fees per market for an integrator.
 *
 * Returns a vector of integrator vault data, one entry per market queried.
 * Markets where the integrator has no vault may be omitted or have zero fees.
 */
export interface ApiPerpetualsBuilderCodesIntegratorVaultsResponse {
	/**
	 * Vector of integrator vault data containing market IDs and their accumulated fees.
	 *
	 * Each entry represents a market where the integrator has a vault and potentially
	 * claimable fees. The order matches the order of market IDs in the request.
	 */
	integratorVaults: PerpetualsIntegratorVaultData[];
}

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
 * Request body for depositing collateral into a perpetuals account.
 *
 * The deposit can be provided by:
 * - `depositAmount` (numeric amount), or
 * - `depositCoinArg` (Sui coin object).
 */
export type ApiPerpetualsDepositCollateralBody = {
	walletAddress: SuiAddress;
	accountId: PerpetualsAccountId;
	accountCapId?: ObjectId;
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
);

/**
 * Request body for withdrawing collateral from an account.
 */
export type ApiPerpetualsWithdrawCollateralBody = {
	accountId: PerpetualsAccountId;
	withdrawAmount: Balance;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
};

/**
 * Response body for withdraw-collateral transactions.
 *
 * The SDK typically uses `txKind` to reconstruct a transaction locally.
 */
export interface ApiPerpetualsWithdrawCollateralResponse {
	txKind: SerializedTransaction;
	coinOutArg: TransactionObjectArgument | undefined;
}

/**
 * Request body for transferring collateral between two perpetuals accounts.
 */
export interface ApiPerpetualsTransferCollateralBody {
	walletAddress: SuiAddress;
	fromAccountId: PerpetualsAccountId;
	fromAccountCapId?: ObjectId;
	toAccountId: PerpetualsAccountId;
	toAccountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
	/** Unique order identifier for limit order sl/tp is tied to. */
	limitOrderId?: PerpetualsOrderId;
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
	limitOrderId?: PerpetualsOrderId;
	gasCoinArg?: TransactionObjectArgument;
	isSponsoredTx?: boolean;
	leverage?: number;
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
			accountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
	walletAddress: SuiAddress;
	marketId: PerpetualsMarketId;
	side: PerpetualsOrderSide;
	/** Order size in scaled base units. */
	size: bigint;
	/** Change in collateral allocated to this position (collateral units). */
	collateralChange: number;
	/** Whether the account already has a position in this market. */
	hasPosition: boolean;
	/** True is position is closed. */
	cancelSlTp: boolean;
	/** If true, order can only reduce an existing position. */
	reduceOnly: boolean;
	/** Allowable max slippage for trade execution. */
	slippage: Slippage;
	/** Optional leverage override. */
	leverage?: number;
	/** Optional SL/TP instructions to be placed along with the market order. */
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

	/**
	 * Optional integrator fee configuration for this order.
	 *
	 * If provided, the integrator specified in the configuration will receive a fee
	 * on the taker volume generated by this order. The integrator must have been
	 * previously approved by the account owner, and the fee must not exceed the
	 * maximum fee the user approved for that integrator.
	 */
	builderCode?: PerpetualsBuilderCodeParamaters;
	/** Optional serialized transaction kind if assembled by the API. */
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
			accountCapId?: ObjectId;
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
	walletAddress: SuiAddress;
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
	/** True is position is closed. */
	cancelSlTp: boolean;
	/** If true, order can only reduce an existing position. */
	reduceOnly: boolean;
	/** Optional expiration for the order. */
	expiryTimestamp?: bigint;
	/** Optional leverage override. */
	leverage?: number;
	/** Optional SL/TP instructions to be placed along with the limit order. */
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

	/**
	 * Optional integrator fee configuration for this order.
	 *
	 * If provided, the integrator specified in the configuration will receive a fee
	 * on the taker volume generated by this order. The integrator must have been
	 * previously approved by the account owner, and the fee must not exceed the
	 * maximum fee the user approved for that integrator.
	 */
	builderCode?: PerpetualsBuilderCodeParamaters;
	/** Optionally pre-built transaction payload. */
	txKind?: SerializedTransaction;
} & (
	| {
			accountId: PerpetualsAccountId;
			accountCapId?: ObjectId;
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
	walletAddress: SuiAddress;
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
			accountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
			accountCapId?: ObjectId;
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
 * 24-hour volume and price change statistics for a single market.
 */
export interface PerpetualsMarket24hrStats {
	/** The total 24h volume in USD. */
	volumeUsd: number;
	/** The total 24h volume measured in the base asset. */
	volumeBaseAssetAmount: number;
	/**
	 * Absolute price change over the last 24h, denominated in the
	 * base asset's quote units.
	 */
	priceChange: number;
	/** Relative price change over the last 24h (e.g. +5% => `0.05`). */
	priceChangePercentage: number;
	/** Latest base asset price for this market. */
	basePrice: number;
	/** Latest collateral asset price used in this market. */
	collateralPrice: number;
	/**
	 * Mid price derived from the current order book.
	 *
	 * Calculated as the average of the best bid and best ask.
	 * `undefined` if either side of the book is empty.
	 */
	midPrice: number | undefined;
	/**
	 * Mark price used for liquidations and risk calculations.
	 *
	 * Computed as the median of the index TWAP, the current
	 * book-derived price, and the index price adjusted for
	 * funding contributions.
	 */
	markPrice: number;
}

/**
 * Response type for requesting 24h stats for multiple markets.
 */
export interface ApiPerpetualsMarkets24hrStatsResponse {
	marketsStats: PerpetualsMarket24hrStats[];
}

/**
 * Request body for fetching all markets for a given collateral type.
 *
 * This endpoint is commonly used to populate a "Markets" list filtered by
 * the user's selected collateral (e.g., USDC-margined markets).
 */
export interface ApiPerpetualsAllMarketsBody {
	collateralCoinType: CoinType;
}

/**
 * Response payload for {@link ApiPerpetualsAllMarketsBody}.
 *
 * Returns enriched market data including parameters, state, and current prices.
 */
export interface ApiPerpetualsAllMarketsResponse {
	markets: PerpetualsMarketData[];
}

/**
 * Request body for fetching a specific set of markets by ID.
 */
export interface ApiPerpetualsMarketsBody {
	marketIds: PerpetualsMarketId[];
}

/**
 * Response payload for {@link ApiPerpetualsMarketsBody}.
 *
 * Each item includes the market data.
 */
export interface ApiPerpetualsMarketsResponse {
	marketDatas: {
		market: PerpetualsMarketData;
	}[];
}

/**
 * Request body for fetching a specific set of orderbooks by market ID.
 */
export interface ApiPerpetualsOrderbooksBody {
	marketIds: PerpetualsMarketId[];
}

/**
 * Response payload for {@link ApiPerpetualsOrderbooksBody}.
 *
 * Each item includes the current orderbook snapshot.
 */
export interface ApiPerpetualsOrderbooksResponse {
	orderbooks: {
		orderbook: PerpetualsOrderbook;
	}[];
}

/**
 * Request body for fetching vault objects.
 *
 * If `vaultIds` is omitted, the API may return all vaults (potentially paginated
 * at the transport layer).
 */
export interface ApiPerpetualsVaultsBody {
	vaultIds?: ObjectId[];
}

/**
 * Response payload for vault queries.
 */
export interface ApiPerpetualsVaultsResponse {
	vaults: PerpetualsVaultObject[];
}

/**
 * Request body for fetching current prices for a list of markets.
 *
 * This is a lightweight alternative to fetching full {@link PerpetualsMarketData}
 * when only prices are needed.
 */
export interface ApiPerpetualsMarketsPricesBody {
	marketIds: PerpetualsMarketId[];
}

/**
 * Response payload for {@link ApiPerpetualsMarketsPricesBody}.
 *
 * Returns base (index/oracle) and collateral prices, the order book mid price,
 * and the mark price used for liquidations and risk calculations.
 */
export interface ApiPerpetualsMarketsPricesResponse {
	marketsPrices: {
		/** Identifier of the market. */
		marketId: PerpetualsMarketId;
		/** Latest base asset price for this market. */
		basePrice: number;
		/** Latest collateral asset price used in this market. */
		collateralPrice: number;
		/**
		 * Mid price derived from the current order book.
		 *
		 * Calculated as the average of the best bid and best ask.
		 * `undefined` if either side of the book is empty.
		 */
		midPrice: number | undefined;
		/**
		 * Mark price used for liquidations and risk calculations.
		 *
		 * Computed as the median of the index TWAP, the current
		 * book-derived price, and the index price adjusted for
		 * funding contributions.
		 */
		markPrice: number;
	}[];
}

/**
 * Request body for granting an Agent Wallet on a perpetuals account.
 *
 * This corresponds to `POST /api/perpetuals/account/transactions/grant-agent-wallet`.
 *
 * The resulting on-chain transaction must be signed by the **account admin** wallet.
 * After execution, `recipientAddress` receives assistant-level permissions for `accountId`
 * (trading actions are allowed, but **withdrawing collateral** and managing other agent wallets are not).
 */
export type ApiPerpetualsGrantAgentWalletTxBody = {
	recipientAddress: SuiAddress;
	accountId: PerpetualsAccountId;
	txKind?: SerializedTransaction;
};

/**
 * Request body for revoking an Agent Wallet from a perpetuals account.
 *
 * This corresponds to `POST /api/perpetuals/account/transactions/revoke-agent-wallet`.
 *
 * The resulting on-chain transaction must be signed by the **account admin** wallet.
 * `accountCapId` is the object ID of the assistant capability to revoke.
 */
export type ApiPerpetualsRevokeAgentWalletTxBody = {
	accountId: PerpetualsAccountId;
	accountCapId: ObjectId;
	txKind?: SerializedTransaction;
};

export type ApiPerpetualsTransferCapTxBody = {
	/**
	 * Recipient wallet address that should receive the capability object.
	 *
	 * Must be a valid Sui address string.
	 */
	recipientAddress: SuiAddress;

	/**
	 * Object ID of the capability to transfer.
	 *
	 * This should be the object ID of the cap being transferred (e.g., an account cap or vault cap).
	 */
	capObjectId: ObjectId;

	/**
	 * Optional serialized (base64) Sui `TransactionKind` to extend.
	 *
	 * When provided, the transfer operation is appended to the existing transaction.
	 */
	txKind?: SerializedTransaction;
};

// =========================================================================
//  Vaults
// =========================================================================

/**
 * Request body for fetching LP coin prices for a set of vaults.
 *
 * LP coin price is typically expressed in USD per 1 LP token (native units adjusted
 * using `lpCoinDecimals` on the vault object).
 */
export interface ApiPerpetualsVaultLpCoinPricesBody {
	vaultIds: ObjectId[];
}

/**
 * Response payload for {@link ApiPerpetualsVaultLpCoinPricesBody}.
 *
 * The response is index-aligned with the request `vaultIds` array.
 */
export interface ApiPerpetualsVaultLpCoinPricesResponse {
	lpCoinPrices: number[];
}

/**
 * Request body for fetching a wallet's owned LP coin objects across vaults.
 */
export interface ApiPerpetualsVaultOwnedLpCoinsBody {
	walletAddress: SuiAddress;
}

/**
 * Response payload listing owned LP coin objects (per vault).
 */
export interface ApiPerpetualsVaultOwnedLpCoinsResponse {
	ownedLpCoins: PerpetualsVaultLpCoin[];
}

/**
 * Request body for fetching vault capability objects owned by a wallet.
 *
 * Vault caps are typically owned by the vault creator/owner and are required
 * for privileged vault actions (processing withdrawals, updating parameters, etc.).
 */
export interface ApiPerpetualsOwnedVaultCapsBody {
	walletAddress: SuiAddress;
}

/**
 * Response payload listing all vault caps owned by the wallet.
 */
export interface ApiPerpetualsOwnedVaultCapsResponse {
	ownedVaultCaps: PerpetualsVaultCap[];
}

/**
 * API body to process forced withdrawals in a vault.
 */
export interface ApiPerpetualsVaultProcessForceWithdrawRequestTxBody {
	walletAddress: SuiAddress;
	vaultId: ObjectId;
	/** Per-market sizes to close as part of force withdraw. */
	sizesToClose: Record<PerpetualsMarketId, Balance>;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
}

/**
 * Response body for force-withdraw processing transactions.
 *
 * - `txKind` is a serialized transaction kind the client can sign/submit.
 * - `coinOutArg` (if present) is the transaction argument referencing the
 *   withdrawn collateral coin output.
 */
export interface ApiPerpetualsVaultProcessForceWithdrawRequestTxResponse {
	txKind: SerializedTransaction;
	coinOutArg: TransactionObjectArgument | undefined;
}

// TODO: docs
export interface ApiPerpetualsVaultPauseVaultForForceWithdrawRequestTxBody {
	vaultId: ObjectId;
	txKind?: SerializedTransaction;
}

/**
 * API body to process regular withdraw requests for a vault.
 */
export interface ApiPerpetualsVaultOwnerProcessWithdrawRequestsTxBody {
	vaultId: ObjectId;
	userAddresses: SuiAddress[];
	txKind?: SerializedTransaction;
}

/**
 * API body to update slippage parameter for pending vault withdraw
 * request for a specific vault.
 */
export interface ApiPerpetualsVaultUpdateWithdrawRequestSlippageTxBody {
	vaultId: ObjectId;
	minCollateralAmountOut: Balance;
	txKind?: SerializedTransaction;
}

/**
 * API body to update the force-withdrawal delay in a vault.
 */
export interface ApiPerpetualsVaultOwnerUpdateForceWithdrawDelayTxBody {
	vaultId: ObjectId;
	forceWithdrawDelayMs: bigint;
	txKind?: SerializedTransaction;
}

/**
 * API body to update the lock period on a vault.
 */
export interface ApiPerpetualsVaultOwnerUpdateLockPeriodTxBody {
	vaultId: ObjectId;
	lockPeriodMs: bigint;
	txKind?: SerializedTransaction;
}

/**
 * API body to update the owner's fee percentage on a vault.
 */
export interface ApiPerpetualsVaultOwnerUpdatePerformanceFeeTxBody {
	vaultId: ObjectId;
	performanceFeePercentage: number;
	txKind?: SerializedTransaction;
}

/**
 * API body for the vault owner withdrawing collected fees.
 */
export interface ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxBody {
	vaultId: ObjectId;
	withdrawAmount: Balance;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
}

/**
 * Response for owner-fee withdrawal transactions.
 */
export interface ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxResponse {
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
 * Response payload listing withdrawal requests for the requested vaults.
 *
 * Depending on backend behavior, this may include all queued requests across
 * all specified vaults.
 */
export interface ApiPerpetualsVaultsWithdrawRequestsResponse {
	withdrawRequests: PerpetualsVaultWithdrawRequest[];
}

/**
 * Request body for fetching withdrawal requests for a given wallet across
 * its vault positions.
 */
export interface ApiPerpetualsVaultOwnedWithdrawRequestsBody {
	walletAddress: SuiAddress;
	// vaultIds: ObjectId[] | undefined;
}

/**
 * Response payload listing withdrawal requests created by `walletAddress`.
 */
export interface ApiPerpetualsVaultOwnedWithdrawRequestsResponse {
	ownedWithdrawRequests: PerpetualsVaultWithdrawRequest[];
}

/**
 * API body for creating a single withdraw request from a vault.
 */
export interface ApiPerpetualsVaultCreateWithdrawRequestTxBody {
	vaultId: ObjectId;
	walletAddress: SuiAddress;
	lpWithdrawAmount: Balance;
	minCollateralAmountOut: Balance;
	txKind?: SerializedTransaction;
}

/**
 * API body for withdrawing collateral from a vault as owner.
 */
export interface ApiPerpetualsVaultOwnerWithdrawCollateralTxBody {
	vaultId: ObjectId;
	lpWithdrawAmount: Balance;
	minCollateralAmountOut: Balance;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
}

/**
 * Response body for vault owner withdraw-collateral transactions.
 *
 * The SDK typically uses `txKind` to reconstruct a transaction locally.
 */
export interface ApiPerpetualsVaultOwnerWithdrawCollateralTxResponse {
	txKind: SerializedTransaction;
	coinOutArg: TransactionObjectArgument | undefined;
}

/**
 * API body for canceling withdrawal requests across vaults for a wallet.
 */
export interface ApiPerpetualsVaultCancelWithdrawRequestTxBody {
	vaultId: ObjectId;
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
	walletAddress: SuiAddress;
	lpWithdrawAmount: Balance;
}

/**
 * Response body for vault withdrawal preview.
 */
export type ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse =
	| {
			error: string;
	  }
	| {
			collateralAmountOut: Balance;
			collateralPrice: number;
	  };

/**
 * Request body for previewing a vault owner collateral withdrawal.
 */
export interface ApiPerpetualsVaultPreviewOwnerWithdrawCollateralBody {
	vaultId: ObjectId;
	lpWithdrawAmount: Balance;
}

/**
 * Response body for vault owner collateral withdrawal preview.
 */
export type ApiPerpetualsVaultPreviewOwnerWithdrawCollateralResponse =
	| {
			error: string;
	  }
	| {
			collateralAmountOut: Balance;
			collateralPrice: number;
	  };

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
export type ApiPerpetualsVaultPreviewDepositResponse =
	| {
			error: string;
	  }
	| {
			lpAmountOut: Balance;
			collateralPrice: number;
			depositedAmountUsd: number;
	  };

/**
 * Request body for previewing forced withdraw processing for a vault.
 */
export interface ApiPerpetualsVaultPreviewProcessForceWithdrawRequestBody {
	vaultId: ObjectId;
	walletAddress: SuiAddress;
}

/**
 * Response body for forced withdraw processing preview.
 */
export type ApiPerpetualsVaultPreviewProcessForceWithdrawRequestResponse =
	| {
			error: string;
	  }
	| {
			collateralAmountOut: Balance;
			collateralPrice: number;
			// TODO: change to arr ?
			sizesToClose: Record<PerpetualsMarketId, bigint>;
			priceImpact: Percentage;
			performanceFeesChargedUsd: number;
			isWithinWithdrawRequestSlippage: boolean;
			minCollateralAmountOut: Balance;
	  };

// TODO: docs
export interface ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestBody {
	vaultId: ObjectId;
	walletAddress: SuiAddress;
}

// TODO: docs
export type ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestResponse =

		| {
				error: string;
		  }
		| {
				isPausable: boolean;
				minNextPauseTimestamp: bigint;
		  };

/**
 * Request body for previewing normal withdraw requests processing for a vault.
 */
export interface ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsBody {
	vaultId: ObjectId;
	userAddresses: SuiAddress[];
}

/**
 * Response body for previewing normal withdraw requests processing.
 */
export type ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsResponse =
	| {
			error: string;
	  }
	| {
			userPreviews: {
				userAddress: SuiAddress;
				collateralAmountOut: Balance;
			}[];
			collateralPrice: number;
	  };

/**
 * Request body for previewing maximum performance fees withdrawable from a vault.
 */
export interface ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesBody {
	vaultId: ObjectId;
}

/**
 * Response body for previewing vault performance fee withdrawal.
 */
export type ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesResponse =
	| {
			error: string;
	  }
	| {
			maxFeesToWithdraw: Balance;
			// maxFeesToWithdrawUsd: number;
			feeCoinType: CoinType;
	  };

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
	"accountId" | "txKind" | "slTp" | "walletAddress"
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
	"accountId" | "txKind" | "slTp" | "walletAddress"
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
 * Websocket subscription payload for market orders stream.
 */
export interface PerpetualsWsUpdatesMarketOrdersSubscriptionType {
	marketOrders: {
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for user-specific order updates.
 */
export interface PerpetualsWsUpdatesUserOrdersSubscriptionType {
	userOrders: {
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
 * Websocket subscription payload for bucketed orderbook snapshots
 * (top of orderbook) for a specific market.
 */
export interface PerpetualsWsUpdatesTopOfOrderbookSubscriptionType {
	topOfOrderbook: {
		marketId: PerpetualsMarketId;
		priceBucketSize: number;
		bucketsNumber: number;
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
	| PerpetualsWsUpdatesMarketOrdersSubscriptionType
	| PerpetualsWsUpdatesUserOrdersSubscriptionType
	| PerpetualsWsUpdatesUserCollateralChangesSubscriptionType
	| PerpetualsWsUpdatesTopOfOrderbookSubscriptionType;

/**
 * Websocket payload for oracle price updates.
 */
export interface PerpetualsWsUpdatesOraclePayload {
	marketId: PerpetualsMarketId;
	basePrice: number;
	collateralPrice: number;
}

/**
 * Websocket payload for market orders stream.
 */
export interface PerpetualsWsUpdatesMarketOrdersPayload {
	marketId: PerpetualsMarketId;
	orders: PerpetualsMarketOrderHistoryData[];
}

/**
 * Websocket payload for user-specific orders stream.
 */
export interface PerpetualsWsUpdatesUserOrdersPayload {
	accountId: PerpetualsAccountId;
	orders: PerpetualsAccountOrderHistoryData[];
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
 * A single data point in the bucketed (top of) orderbook.
 */
export interface PerpetualsTopOfOrderbookDataPoint {
	price: number;
	size: number;
	totalSize: number;
	sizeUsd: number;
	totalSizeUsd: number;
}

/**
 * Bucketed orderbook state for top-of-orderbook updates.
 */
export interface PerpetualsTopOfOrderbook {
	bids: PerpetualsTopOfOrderbookDataPoint[];
	asks: PerpetualsTopOfOrderbookDataPoint[];
	minAskPrice: number | undefined;
	maxBidPrice: number | undefined;
}

/**
 * Websocket payload for bucketed orderbook (top of orderbook) updates.
 */
export interface PerpetualsWsUpdatesTopOfOrderbookPayload {
	marketId: PerpetualsMarketId;
	bids: PerpetualsTopOfOrderbookDataPoint[];
	asks: PerpetualsTopOfOrderbookDataPoint[];
	minAskPrice: number | undefined;
	maxBidPrice: number | undefined;
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
	| { marketOrders: PerpetualsWsUpdatesMarketOrdersPayload }
	| { userOrders: PerpetualsWsUpdatesUserOrdersPayload }
	| {
			userCollateralChanges: PerpetualsWsUpdatesUserCollateralChangesPayload;
	  }
	| { topOfOrderbook: PerpetualsWsUpdatesTopOfOrderbookPayload };

// /perpetuals/ws/market-candles/{market_id}/{interval_ms}

/**
 * Websocket response message carrying the last candle for a given market
 * and interval.
 */
export interface PerpetualsWsCandleResponseMessage {
	marketId: PerpetualsMarketId;
	lastCandle: PerpetualsMarketCandleDataPoint | undefined;
}
