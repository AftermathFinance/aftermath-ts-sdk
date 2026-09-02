import type {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import type {
	AnyObjectType,
	Balance,
	Bps,
	Byte,
	EmptyObject,
	Event,
	ObjectDigest,
	ObjectId,
	ObjectVersion,
	PackageId,
	Percentage,
	SerializedTransaction,
	Slippage,
	SuiAddress,
	Timestamp,
	TransactionDigest,
	ValueOf,
} from "../../general/types/generalTypes";
import type { CoinDecimal, CoinSymbol, CoinType } from "../coin/coinTypes";

// =========================================================================
//  Sponsor Config
// =========================================================================

/**
 * Configuration for gas pool sponsorship on perpetuals transactions.
 *
 * When provided, the transaction will include a gas pool sponsor rebate step
 * that debits the specified wallet's gas pool.
 */
export interface PerpetualsSponsorConfig {
	/**
	 * Wallet address to use for gas pool sponsorship. Must be the connected
	 * wallet: af-fe now verifies the sponsor and refuses a request naming any
	 * other address with error 2034 before it reaches the pool.
	 */
	walletAddress: SuiAddress;
	/**
	 * Base64 UTF-8 bytes of the Terms and Conditions message (see
	 * `UserData.createTermsAndConditionsMessage`), signed once by `walletAddress`
	 * and cached for the session. Sending this cached signature is all the gas
	 * pool needs; it replaces the old per-tx `SPONSOR_GAS` payload.
	 */
	bytes?: string;
	/** `walletAddress`'s signature over `bytes` (the cached T&C signature). */
	signature?: string;
}

/**
 * Semantic capability type for composed-flow transfers.
 *
 * Used by `getTransferCapTx` (Method 2) to specify which kind of capability
 * is being transferred without exposing Move type tags.
 */
export type PerpetualsCapType =
	| "accountAdmin"
	| "accountAgent"
	| "vaultAdmin"
	| "vaultAgent";

/**
 * PTB argument references returned by deferred `create_account` for use
 * in downstream composed endpoints (share-account, grant-agent-wallet, etc.).
 */
export interface DeferredAccountArgs {
	/** Argument reference for the created Account object. */
	accountArg: TransactionObjectArgument;
	/** Argument reference for the AccountSharePolicy. */
	sharePolicyArg: TransactionObjectArgument;
	/** Argument reference for the AccountCap<ADMIN>. */
	adminCapArg: TransactionObjectArgument;
	/** Collateral type for the account. */
	collateralCoinType: CoinType;
}

/**
 * PTB argument reference + semantic capability type for composed-flow
 * party transfers.
 */
export interface ComposedTransferArgs {
	/** PTB argument reference for the object to transfer. */
	objectArg: TransactionObjectArgument;
	/** Semantic capability type being transferred. */
	capType: PerpetualsCapType;
}

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
 * Optional client-managed order id (`u64`) used to tag an order at post time.
 *
 * It is scoped to a `(marketId, accountId)` pair and is not unique on-chain.
 * Callers can later track or cancel an order by this id instead of the on-chain
 * order id. Serialized on the wire as a BigInt-style string (e.g. `"123n"`).
 */
export type PerpetualsClientOrderId = bigint;

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
export const PerpetualsOrderSide = {
	Ask: 1, // true
	Bid: 0, // false
} as const;

/** Numeric side value used by perpetuals order and position records. */
export type PerpetualsOrderSide = ValueOf<typeof PerpetualsOrderSide>;

/**
 * Order execution and posting behavior.
 *
 * - `Standard`: No special constraints.
 * - `FillOrKill`: Either fully fills immediately or cancels.
 * - `PostOnly`: Only posts to the book; will not take liquidity.
 * - `ImmediateOrCancel`: Fills as much as possible immediately; remainder is canceled.
 */
export const PerpetualsOrderType = {
	Standard: 0,
	FillOrKill: 1,
	PostOnly: 2,
	ImmediateOrCancel: 3,
} as const;

/** Numeric execution policy value used when placing an order. */
export type PerpetualsOrderType = ValueOf<typeof PerpetualsOrderType>;

/**
 * Stop order mode.
 *
 * - `SlTp`: Stop Loss / Take Profit order, intended to close a position
 *   (fully or partially).
 * - `Standalone`: Independent stop order that can both reduce or increase
 *   the position, potentially requiring additional allocated collateral.
 */
export const PerpetualsStopOrderType = {
	SlTp: 0,
	Standalone: 1,
} as const;

/** Numeric mode value distinguishing SL/TP and standalone stop orders. */
export type PerpetualsStopOrderType = ValueOf<typeof PerpetualsStopOrderType>;

/**
 * Which on-chain price a stop order's trigger is evaluated against.
 */
export const PerpetualsStopOrderTriggerPriceType = {
	IndexPrice: 0,
	BookMidPrice: 1,
	MarkPrice: 2,
} as const;

/** Numeric value selecting the price source used by a stop-order trigger. */
export type PerpetualsStopOrderTriggerPriceType = ValueOf<
	typeof PerpetualsStopOrderTriggerPriceType
>;

/**
 * Execution details for a stop order that has been executed.
 */
export type PerpetualsExecutionInfo =
	| {
			/** Indicates that no stop-order execution category applies. */
			notSpecified: EmptyObject;
	  }
	| {
			/** Details for an executed standalone stop order. */
			standaloneExecuted: {
				/** Price at which the standalone stop order executed. */
				executionPrice: number;
			};
	  }
	| {
			/** Details for an executed stop-loss order. */
			stopLossExecuted: {
				/** Price at which the stop-loss order executed. */
				executionPrice: number;
			};
	  }
	| {
			/** Details for an executed take-profit order. */
			takeProfitExecuted: {
				/** Price at which the take-profit order executed. */
				executionPrice: number;
			};
	  };

/**
 * Current state of a stop order in its lifecycle.
 */
export type PerpetualsOrderState =
	| {
			/** Indicates that the order state is unknown to the client. */
			unknown: EmptyObject;
	  }
	| {
			/** Indicates that the order is invalid; inspect `error` for the reason. */
			invalid: {
				/** Reason the order is invalid. */
				error: string;
			};
	  }
	| {
			/** Indicates that the order is pending activation. */
			pending: EmptyObject;
	  }
	| {
			/** Indicates that the order is active and eligible for execution. */
			active: EmptyObject;
	  }
	| {
			/** Indicates that the order has executed. */
			executed: PerpetualsExecutionInfo;
	  }
	| {
			/** Indicates that the order has been cancelled. */
			cancelled: EmptyObject;
	  }
	| {
			/** Indicates that the order is currently being executed. */
			inExecution: EmptyObject;
	  }
	| {
			/** Indicates that the order is marked for cancellation. */
			toCancel: EmptyObject;
	  };

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

/** Vault capability data without the capability object's own ID. */
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
	/** USD value of the deposit. */
	depositedAmountUsd: number;
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
		/** Client-managed order id this order was tagged with, if any. */
		clientOrderId?: PerpetualsClientOrderId;
	}[];
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
	/** Numeric price-feed storage id of the base asset's oracle feed. */
	basePriceFeedId: number;
	/** Numeric price-feed storage id of the collateral asset's oracle feed. */
	collateralPriceFeedId: number;
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
	/** Maker fee rate (fraction) charged for providing liquidity. */
	makerFee: Percentage;
	/** Taker fee rate (fraction) charged for taking liquidity. */
	takerFee: Percentage;
	/** Liquidation fee rate (fraction) charged on liquidations. */
	liquidationFee: Percentage;
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
	/**
	 * Additional taker fee charged when the transaction is submitted with a gas
	 * price above the epoch reference gas price. `undefined` means priority-gas
	 * transactions are rejected on-chain; a value means the surcharge applies.
	 */
	priorityTakerFee: Percentage | undefined;
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
	 * Numeric integrator id (as assigned by the registry) of the integrator who
	 * will receive the fee.
	 *
	 * This integrator must have been previously approved by the account owner.
	 */
	integratorId: number;

	/**
	 * Integrator fee (as a decimal) to be charged on this order's taker volume.
	 *
	 * For example, 0.0005 represents a 0.05% fee. This value must not exceed
	 * the maximum integrator fee that the user approved for this integrator.
	 * The fee is only applied to taker volume (not maker volume).
	 */
	integratorFee: Percentage;
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
	/** Current state of the stop order in its lifecycle. */
	orderState: PerpetualsOrderState;
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
		/** Price at which to trigger a stop loss (interpreted per `triggerPriceType`). */
		stopLossPrice?: number;
		/** Price at which to take profit (interpreted per `triggerPriceType`). */
		takeProfitPrice?: number;
		/** Which on-chain price the trigger uses: 0 = index, 1 = book, 2 = mark. */
		triggerPriceType: PerpetualsStopOrderTriggerPriceType;
		/** Unique order identifier for limit order sl/tp is tied to. */
		limitOrderId?: PerpetualsOrderId;
	};
	/** Non-SL/TP standalone stop configuration. */
	nonSlTp?: {
		/** Price threshold used for triggering (interpreted per `triggerPriceType`). */
		stopIndexPrice: number;
		/** If true, triggers when price >= threshold, otherwise price <= threshold. */
		triggerIfGeStopIndexPrice: boolean;
		/** Whether the stop can only reduce an existing position. */
		reduceOnly: boolean;
		/** Which on-chain price the trigger uses: 0 = index, 1 = book, 2 = mark. */
		triggerPriceType: PerpetualsStopOrderTriggerPriceType;
	};
	/** Optional integrator fee configuration applied when this stop order fires. */
	builderCode?: PerpetualsBuilderCodeParamaters;
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
 * Network-specific protocol limits shared by all Perpetuals vaults.
 *
 * These values come from the current on-chain vaults configuration rather
 * than SDK constants. Fetch them with `Perpetuals.getVaultsConfig`.
 */
export interface PerpetualsVaultsConfig {
	/** ID of the on-chain vaults configuration object. */
	id: ObjectId;
	/** On-chain configuration version. */
	version: bigint;
	/** Default collateral price-feed staleness tolerance, in milliseconds. */
	collateralPriceFeedStorageToleranceMs: bigint;
	/** Maximum vault deposit lock period, in milliseconds. */
	maxLockPeriodMs: bigint;
	/** Maximum force-withdraw delay, in milliseconds. */
	maxForceWithdrawDelayMs: bigint;
	/** Maximum vault owner performance fee as a fraction (for example, `0.2`). */
	maxPerformanceFeePercentage: number;
	/** Minimum USD value the owner must lock when creating a vault. */
	minOwnerLockUsd: number;
	/** Maximum USD value the owner may lock when creating a vault. */
	maxOwnerLockUsd: number;
	/** Minimum USD value accepted for a user deposit. */
	minDepositUsd: number;
	/** Maximum number of distinct markets supported by one vault. */
	maxMarketsInVault: bigint;
	/** Maximum pending orders allowed per vault position. */
	maxPendingOrdersPerPosition: bigint;
	/** Time a vault remains paused for force withdrawal, in milliseconds. */
	forceWithdrawPauseMs: bigint;
	/** Maximum active assistant capabilities associated with one vault. */
	maxAssistantsPerVault: bigint;
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
	 * `tvlUsd`, this is used to derive LP share price.
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
	 * Total value locked in USD for this vault.
	 *
	 * Includes idle collateral plus the value of all open positions. It is the
	 * primary headline number used for ranking and display.
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
		 * Numeric price-feed storage id identifying the oracle price for `C`.
		 */
		collateralPriceFeedStorageId: number;
		/**
		 * Numeric source id of the collateral price feed (the oracle
		 * provider/source: pyth, stork, etc.). Together with
		 * `collateralPriceFeedStorageId` it identifies the feed in the oracle
		 * aggregator registry.
		 */
		collateralPriceFeedStorageSourceId: number;
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
	/**
	 * The amount of LP tokens locked by the vault owner (native units).
	 *
	 * This is the owner's initially locked liquidity, a portion of which can be
	 * withdrawn via the owner locked liquidity withdraw flow.
	 */
	ownerLockedLpBalance: Balance;
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
export interface PerpetualsAccountCollateralChange {
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
				insuranceFundFeesUsd: number;
		  }
		| {
				netFeesUsd: number;
				liqorFeesUsd: number;
		  }
		| {
				netFeesUsd: number;
		  };
}

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
	/** Realized funding PnL in USD at that time. */
	realizedFundingsUsd: number;
	/** Realized position PnL in USD at that time. */
	realizedPnlUsd: number;
	/** Taker volume in USD at that time. */
	takerVolumeUsd: number;
	/** Maker volume in USD at that time. */
	makerVolumeUsd: number;
	/** Taker fees in USD at that time. */
	takerFeesUsd: number;
	/** Maker fees in USD at that time. */
	makerFeesUsd: number;
	/** Liquidated fees in USD at that time. */
	liquidatedFeesUsd: number;
	/** Liquidator fees in USD at that time. */
	liquidatorFeesUsd: number;
}

/**
 * Individual order affecting an account.
 */
export interface PerpetualsAccountOrderHistoryData {
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
		stopLossPrice?: number;
		/** Optional take-profit trigger price based on the index price. */
		takeProfitPrice?: number;
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
	/** Optional order ID. */
	orderId?: string;
	/** Realized PnL for this order event, if applicable. */
	pnl?: number;
	/** Fees charged for this order event, if applicable. */
	fees?: number;
}

/**
 * Event emitted when collateral is deposited into an account.
 */
export interface DepositedCollateralEvent extends Event {
	/** Perpetuals account receiving the collateral. */
	accountId: PerpetualsAccountId;
	/** Deposited collateral in the coin's smallest unit. */
	collateralDelta: Balance;
}

/**
 * Event emitted when collateral is allocated from general account collateral
 * into a specific market position.
 */
export interface AllocatedCollateralEvent extends Event {
	/** Market receiving collateral from the account's free balance. */
	marketId: PerpetualsMarketId;
	/** Perpetuals account whose collateral is allocated. */
	accountId: PerpetualsAccountId;
	/** Allocated collateral in the coin's smallest unit. */
	collateralDelta: Balance;
}

/**
 * Event emitted when collateral is deallocated from a market back to
 * the account's general collateral.
 */
export interface DeallocatedCollateralEvent extends Event {
	/** Market returning collateral to the account's free balance. */
	marketId: PerpetualsMarketId;
	/** Perpetuals account receiving the deallocated collateral. */
	accountId: PerpetualsAccountId;
	/** Deallocated collateral in the coin's smallest unit. */
	collateralDelta: Balance;
}

/**
 * Event emitted when collateral is withdrawn from the account.
 */
export interface WithdrewCollateralEvent extends Event {
	/** Perpetuals account whose collateral was withdrawn. */
	accountId: PerpetualsAccountId;
	/** Withdrawn collateral in the coin's smallest unit. */
	collateralDelta: Balance;
}

/**
 * Event emitted when funding is settled for an account and market.
 */
export interface SettledFundingEvent extends Event {
	/** Perpetuals account whose funding was settled. */
	accountId: PerpetualsAccountId;
	/** Signed collateral change from funding, in USD. */
	collateralDeltaUsd: number;
	/** Market whose funding was settled. */
	marketId: PerpetualsMarketId;
	/** Long cumulative funding rate as a decimal fraction. */
	marketFundingRateLong: number;
	/** Short cumulative funding rate as a decimal fraction. */
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
	/** Perpetuals account that was liquidated. */
	accountId: PerpetualsAccountId;
	/** Net collateral change from the liquidation, in USD. */
	collateralDeltaUsd: number;
	/** Liquidator's account ID. */
	liqorAccountId: PerpetualsAccountId;
	/** Market in which the position was liquidated. */
	marketId: PerpetualsMarketId;
	/** Side of the liquidated position. */
	side: PerpetualsOrderSide;
	/** Amount of base asset liquidated. */
	baseLiquidated: number;
	/** Amount of quote asset liquidated. */
	quoteLiquidated: number;
	/** Liquidated account's PnL in USD for this event. */
	liqeePnlUsd: number;
	/** Liquidation fee paid in USD. */
	liquidationFeesUsd: number;
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
	/** Wallet that created the account. */
	user: SuiAddress;
	/** Newly created perpetuals account ID. */
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
	/** Market whose position margin ratio changed. */
	marketId: PerpetualsMarketId;
	/** Perpetuals account whose position changed. */
	accountId: PerpetualsAccountId;
	// NOTE: should this be made into string ?
	/** Position initial margin ratio as a decimal fraction. */
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
	/** Perpetuals account whose order was processed. */
	accountId: PerpetualsAccountId;
	/** Encoded order ID. */
	orderId: PerpetualsOrderId;
	/** Filled or dropped size in the order's raw integer scale. */
	size: bigint;
	/** Whether the order was dropped instead of filled. */
	dropped: boolean;
}

/**
 * Event emitted when an order is canceled.
 */
export interface CanceledOrderEvent extends Event {
	/** Perpetuals account whose order was canceled. */
	accountId: PerpetualsAccountId;
	/** Market containing the canceled order. */
	marketId: PerpetualsMarketId;
	/** Side of the canceled order. */
	side: PerpetualsOrderSide;
	/** Canceled size in the order's raw integer scale. */
	size: bigint;
	/** Encoded canceled order ID. */
	orderId: PerpetualsOrderId;
}

/**
 * Event emitted when a new order is posted to the orderbook.
 */
export interface PostedOrderEvent extends Event {
	/** Perpetuals account that posted the order. */
	accountId: PerpetualsAccountId;
	/** Market containing the posted order. */
	marketId: PerpetualsMarketId;
	/** Encoded posted order ID. */
	orderId: PerpetualsOrderId;
	/** Posted size in the order's raw integer scale. */
	size: bigint;
	// TODO: change to `isReduceOnly` ?
	/** Whether the order can only reduce an existing position. */
	reduceOnly: boolean;
	/** Optional expiration timestamp in Unix milliseconds. */
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
	/** Maker account whose order was filled. */
	accountId: PerpetualsAccountId;
	/** Taker account that matched the maker order. */
	takerAccountId: PerpetualsAccountId;
	/** Maker collateral change from this fill, in USD. */
	collateralDeltaUsd: number;
	/** Market containing the filled order. */
	marketId: PerpetualsMarketId;
	/** Side of the maker order. */
	side: PerpetualsOrderSide;
	/** Filled size in the order's raw integer scale. */
	size: bigint;
	/** Remaining maker order size in the raw integer scale. */
	sizeRemaining: bigint;
	/** Encoded maker order ID. */
	orderId: PerpetualsOrderId;
	/** Whether the order was dropped after processing. */
	dropped: boolean;
	/** Maker PnL from the fill, in USD. */
	pnlUsd: number;
	/** Maker fees from the fill, in USD. */
	feesUsd: number;
	/** Canceled maker size in the raw integer scale. */
	canceledSize: bigint;
}

/**
 * Event emitted when a taker order is executed.
 */
export interface FilledTakerOrderEvent extends Event {
	/** Taker account whose order was executed. */
	accountId: PerpetualsAccountId;
	/** Taker collateral change from the fill, in USD. */
	collateralDeltaUsd: number;
	/** Market containing the executed order. */
	marketId: PerpetualsMarketId;
	/** Derived position side from the signed base delta. */
	side: PerpetualsOrderSide;
	/** Signed base-asset delta from the fill. */
	baseAssetDelta: number;
	/** Signed quote-asset delta from the fill. */
	quoteAssetDelta: number;
	/** Taker PnL from the fill, in USD. */
	takerPnlUsd: number;
	/** Taker fees from the fill, in USD. */
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

// This declaration merges with the documented `PostedOrderEvent` above and
// contributes the `side` field to its public shape.
export interface PostedOrderEvent extends Event {
	accountId: PerpetualsAccountId;
	marketId: PerpetualsMarketId;
	orderId: PerpetualsOrderId;
	size: bigint;
	/** Side of the posted order. */
	side: PerpetualsOrderSide;
}

/**
 * Event emitted when an existing order is reduced (partial cancellation or
 * adjustment of size).
 */
export interface ReducedOrderEvent extends Event {
	/** Market containing the reduced order. */
	marketId: PerpetualsMarketId;
	/** Perpetuals account whose order was reduced. */
	accountId: PerpetualsAccountId;
	/** Reduced size in the order's raw integer scale. */
	sizeChange: bigint;
	/** Encoded reduced order ID. */
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
	/** Stop-order ticket object ID. */
	ticketId: ObjectId;
	/** Perpetuals account that owns the ticket. */
	accountId: PerpetualsAccountId;
	/** Optional subaccount that owns the ticket. */
	subAccountId?: ObjectId;
	/** Wallets allowed to execute the ticket. */
	executors: SuiAddress[];
	/** Reserved execution gas in the coin's smallest unit. */
	gas: Balance;
	/** Stop-order mode. */
	stopOrderType: PerpetualsStopOrderType;
	/** Encrypted stop-order details (payload). */
	encryptedDetails: Byte[];
}

/**
 * Event emitted when a stop order ticket is executed.
 */
export interface ExecutedStopOrderTicketEvent extends Event {
	/** Stop-order ticket object ID. */
	ticketId: ObjectId;
	/** Perpetuals account that owns the ticket. */
	accountId: PerpetualsAccountId;
	/** Wallet that executed the ticket. */
	executor: SuiAddress;
}

/**
 * Event emitted when a stop order ticket is deleted or canceled.
 */
export interface DeletedStopOrderTicketEvent extends Event {
	/** Stop-order ticket object ID. */
	ticketId: ObjectId;
	/** Perpetuals account that owns the ticket. */
	accountId: PerpetualsAccountId;
	/** Optional subaccount that owns the ticket. */
	subAccountId?: ObjectId;
	/** Wallet that deleted the ticket. */
	executor: SuiAddress;
}

/**
 * Event emitted when the details (payload) of a stop order ticket are edited.
 */
export interface EditedStopOrderTicketDetailsEvent extends Event {
	/** Stop-order ticket object ID. */
	ticketId: ObjectId;
	/** Perpetuals account that owns the ticket. */
	accountId: PerpetualsAccountId;
	/** Optional subaccount that owns the ticket. */
	subAccountId?: ObjectId;
	/** Encrypted stop-order payload. */
	encryptedDetails: Byte[];
	/** Stop-order mode used by the ticket. */
	stopOrderType: PerpetualsStopOrderType;
}

/**
 * Event emitted when the set of executors for a stop order ticket is edited.
 */
export interface EditedStopOrderTicketExecutorEvent extends Event {
	/** Stop-order ticket object ID. */
	ticketId: ObjectId;
	/** Perpetuals account that owns the ticket. */
	accountId: PerpetualsAccountId;
	/** Optional subaccount that owns the ticket. */
	subAccountId?: ObjectId;
	/** Wallets authorized to execute the ticket. */
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
	/** Clearing-house object that transferred the collateral. */
	chId: ObjectId;
	/** Account or SubAccount object id. */
	objectId: ObjectId; // Account or SubAccount object id
	/** Perpetuals account associated with the transfer. */
	accountId: PerpetualsAccountId;
	/** Transferred collateral in the coin's smallest unit. */
	collateral: Balance;
}

/**
 * Event emitted when an account or subaccount receives collateral.
 */
export interface ReceivedCollateralEvent extends Event {
	/** Account or SubAccount object id. */
	objectId: ObjectId; // Account or SubAccount object id
	/** Perpetuals account receiving the collateral. */
	accountId: PerpetualsAccountId;
	/** Received collateral in the coin's smallest unit. */
	collateral: Balance;
}

// =========================================================================
//  Twap
// =========================================================================

/**
 * Event emitted when premium TWAP is updated for a market.
 */
export interface UpdatedPremiumTwapEvent extends Event {
	/** Market whose premium TWAP changed. */
	marketId: PerpetualsMarketId;
	/** Current orderbook price, in quote units. */
	bookPrice: number;
	/** Oracle/index price, in quote units. */
	indexPrice: number;
	/** Premium TWAP as a decimal price difference. */
	premiumTwap: number;
	/** Premium TWAP update timestamp in Unix milliseconds. */
	premiumTwapLastUpdateMs: number;
}

/**
 * Event emitted when spread TWAP is updated for a market.
 */
export interface UpdatedSpreadTwapEvent extends Event {
	/** Market whose spread TWAP changed. */
	marketId: PerpetualsMarketId;
	/** Current orderbook price, in quote units. */
	bookPrice: number;
	/** Oracle/index price, in quote units. */
	indexPrice: number;
	/** Spread TWAP as a decimal price difference. */
	spreadTwap: number;
	/** Spread TWAP update timestamp in Unix milliseconds. */
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
	/** Market whose funding rates changed. */
	marketId: PerpetualsMarketId;
	/** Cumulative long funding rate as a decimal fraction. */
	cumFundingRateLong: number;
	/** Cumulative short funding rate as a decimal fraction. */
	cumFundingRateShort: number;
	/** Funding update timestamp in Unix milliseconds. */
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
	/** Wallet whose owned account-cap objects are queried. */
	walletAddress: SuiAddress;
	/** Optional collateral coin types used to filter the returned caps. */
	collateralCoinTypes?: CoinType[];
}

/**
 * Request body for fetching specific admin account caps by their account IDs.
 */
export interface ApiPerpetualsAdminAccountCapsBody {
	/** Perpetuals account IDs whose admin caps are queried. */
	accountIds: PerpetualsAccountId[];
}

/**
 * Response payload for fetching positions for one or more accounts.
 *
 * The backend returns a list of {@link PerpetualsAccountObject} snapshots.
 * Each snapshot includes per-market {@link PerpetualsPosition} data.
 */
export interface ApiPerpetualsAccountPositionsResponse {
	/** Account snapshots with their returned market positions. */
	accounts: PerpetualsAccountObject[];
}

/**
 * Request body for fetching positions for a set of accounts.
 *
 * `marketIds` can be supplied as an optimization hint to limit the markets
 * included in each account's returned `positions` array.
 */
export interface ApiPerpetualsAccountPositionsBody {
	/** Perpetuals account IDs to query. */
	accountIds: PerpetualsAccountId[];
	// TODO: remove eventually ?
	/** Optional market filter applied to each account's positions. */
	marketIds?: PerpetualsMarketId[];
}

/**
 * Response payload for fetching admin account caps by explicit account IDs.
 */
export interface ApiPerpetualsAdminAccountCapsResponse {
	/** Admin account capabilities matching the requested account IDs. */
	accountCaps: PerpetualsAccountCap[];
}

/**
 * Response payload for fetching all account caps owned by a wallet.
 *
 * This is typically used during onboarding / wallet connect to discover
 * existing accounts.
 */
export interface ApiPerpetualsOwnedAccountCapsResponse {
	/** Account capabilities owned by the requested wallet. */
	accountCaps: PerpetualsAccountCap[];
}

// =========================================================================
//  Interactions
// =========================================================================

/**
 * Discrete event type recorded in user history responses
 * (trade, collateral, etc.).
 *
 * Serialized as PascalCase strings on the wire.
 */
export type UserHistoryEventType =
	| "PostedOrder"
	| "CanceledOrder"
	| "FilledTakerOrder"
	| "FilledMakerOrder"
	| "LiquidatedPosition"
	| "PerformedLiquidation"
	| "PerformedADL"
	| "DepositedCollateral"
	| "WithdrewCollateral"
	| "AllocatedCollateral"
	| "DeallocatedCollateral"
	| "SettledFunding"
	| "CreatedStopOrderTicket"
	| "DeletedStopOrderTicket"
	| "ExecutedStopOrderTicket";

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
	/** Margin snapshots in the requested page. */
	marginHistoryDatas: PerpetualsAccountMarginHistoryData[];
}

/**
 * Request body for fetching account-level order history with a cursor.
 */
export type ApiPerpetualsMarketOrderHistoryBody =
	ApiPerpetualsHistoricalDataWithCursorBody & {
		/** Market ID associated with the request. */
		marketId: PerpetualsMarketId;
	};

/**
 * Request body for fetching account-level order history with a cursor.
 */
export type ApiPerpetualsAccountOrderHistoryBody =
	ApiPerpetualsHistoricalDataWithCursorBody & {
		/** Account ID associated with the request. */
		accountId: PerpetualsAccountId;
		/** Optional wallet authentication data used to authorize the request. */
		authentication?: {
			/** Wallet address used to identify the signer or owner. */
			walletAddress: SuiAddress;
			/** Serialized message bytes covered by `signature`. */
			bytes: string;
			/** Wallet signature over `bytes` from `walletAddress`. */
			signature: string;
		};
		/**
		 * Optional filter restricting results to the specified event types.
		 *
		 * When omitted, the backend returns events of all types.
		 */
		eventTypes?: UserHistoryEventType[];
	};

/**
 * Request body for fetching account collateral history with a cursor.
 */
export type ApiPerpetualsAccountCollateralHistoryBody =
	ApiPerpetualsHistoricalDataWithCursorBody & {
		/** Account ID associated with the request. */
		accountId: PerpetualsAccountId;
		/** Optional wallet authentication data used to authorize the request. */
		authentication?: {
			/** Wallet address used to identify the signer or owner. */
			walletAddress: SuiAddress;
			/** Serialized message bytes covered by `signature`. */
			bytes: string;
			/** Wallet signature over `bytes` from `walletAddress`. */
			signature: string;
		};
		/**
		 * Optional filter restricting results to the specified event types.
		 *
		 * When omitted, the backend returns events of all types.
		 */
		eventTypes?: UserHistoryEventType[];
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
	/**
	 * If true, the preview includes deallocating free collateral (margin not
	 * backing a position) back to the wallet. Defaults to false.
	 */
	shouldDeallocateFreeCollateral?: boolean;
	// NOTE: do we need this ?
	// isClose?: boolean;
} & (
		| {
				// TODO: remove eventually ?
				/** Account ID associated with the request. */
				accountId: PerpetualsAccountId | undefined;
		  }
		| {
				// TODO: remove eventually ?
				/** Vault object ID used instead of an account. */
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
	/**
	 * If true, the preview includes deallocating free collateral (margin not
	 * backing a position) back to the wallet. Defaults to false.
	 */
	shouldDeallocateFreeCollateral?: boolean;
	// NOTE: do we need this ?
	// isClose?: boolean;
} & (
		| {
				// TODO: remove eventually ?
				/** Account ID associated with the request. */
				accountId: PerpetualsAccountId | undefined;
		  }
		| {
				// TODO: remove eventually ?
				/** Vault object ID used instead of an account. */
				vaultId: ObjectId | undefined;
		  }
	);

/**
 * Request body for previewing a scale order placement (before sending a tx).
 */
export type ApiPerpetualsPreviewPlaceScaleOrderBody = {
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Order side: `0` for bid or long, `1` for ask or short. */
	side: PerpetualsOrderSide;
	/** Total size distributed across all orders (scaled bigint). */
	totalSize: bigint;
	/** Starting price of the scale range (inclusive, scaled bigint). */
	startPrice: bigint;
	/** Ending price of the scale range (inclusive, scaled bigint). */
	endPrice: bigint;
	/** Number of limit orders to place across the range. */
	numberOfOrders: number;
	/** Order type (e.g. GTC, IOC). */
	orderType: PerpetualsOrderType;
	/** If true, orders can only reduce an existing position. */
	reduceOnly: boolean;
	/** Optional leverage override. */
	leverage?: number;
	/** Size ratio between last and first order. `1.0` = uniform, `2.0` = last is 2x first. */
	sizeSkew?: number;
	/** Optional integrator fee configuration. */
	builderCode?: PerpetualsBuilderCodeParamaters;
	/** Optional expiration timestamp in milliseconds since epoch. */
	expiryTimestamp?: bigint;
	/**
	 * If true, the preview includes deallocating free collateral (margin not
	 * backing a position) back to the wallet. Defaults to false.
	 */
	shouldDeallocateFreeCollateral?: boolean;
} & (
	| {
			// TODO: remove eventually ?
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId | undefined;
	  }
	| {
			// TODO: remove eventually ?
			/** Vault object ID used instead of an account. */
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
	/**
	 * If true, also deallocate free collateral (margin not backing a position)
	 * back to the wallet. Defaults to false.
	 */
	shouldDeallocateFreeCollateral?: boolean;
	/**
	 * If true, abort the preview when any given order ID is not found on-chain.
	 * If false (default), missing IDs are tolerated.
	 */
	shouldAbortOnMissingId?: boolean;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
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
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Leverage applied by the request or preview. */
	leverage: number;
	// collateralCoinType: CoinType;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * Request body for previewing a collateral allocation/deallocation for a given position.
 */
export type ApiPerpetualsPreviewEditCollateralBody = {
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Collateral amount to allocate, deallocate, or change. */
	collateralChange: Balance;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
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
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Position after the simulated operation. */
			updatedPosition: PerpetualsPosition;
			/** Collateral amount to allocate, deallocate, or change. */
			collateralChange: number;
	  };

/**
 * Response type for a allocate/deallocate collateral preview request.
 *
 * Either returns an error, or the position and collateral after the change.
 */
export type ApiPerpetualsPreviewEditCollateralResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Position after the simulated operation. */
			updatedPosition: PerpetualsPosition;
			/** Collateral amount to allocate, deallocate, or change. */
			collateralChange: number;
	  };

/**
 * Generic response type for a place-order preview (market or limit).
 */
export type ApiPerpetualsPreviewPlaceOrderResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
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
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Per-market map of order IDs or preview results. */
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
	/** Side of the hypothetical order. */
	side: PerpetualsOrderSide;
	/** Hypothetical order size in the order's raw integer scale. */
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
	/** Effective price for the filled portion, in quote units. */
	executionPrice: number;
	/** Filled size in base units. */
	sizeFilled: number;
	/** Size that would remain posted in base units. */
	sizePosted: number;
	/** Individual orderbook fills used to compute the result. */
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
	 * Candle resolution as a CCXT-style timeframe label (e.g. `"1m"`, `"1h"`, `"1d"`).
	 */
	resolution: PerpetualsCandleResolution;
}

/**
 * Candle resolution as a CCXT-style timeframe label.
 */
export type PerpetualsCandleResolution =
	| "1m"
	| "5m"
	| "15m"
	| "30m"
	| "1h"
	| "4h"
	| "12h"
	| "1d"
	| "3d"
	| "1w"
	| "1mo";

/**
 * Response type for historical market candle data.
 */
export interface ApiPerpetualsMarketCandleHistoryResponse {
	/** OHLCV candles in the requested time range. */
	candles: PerpetualsMarketCandleDataPoint[];
}

/**
 * Request payload for fetching historical funding rate data for a given
 * perpetuals market.
 */
export interface ApiPerpetualsMarketFundingHistoryBody {
	/** Market ID to query. Must be a valid on-chain market ID. */
	marketId: PerpetualsMarketId;
	/** Start of the time range to query (Unix timestamp in **milliseconds**). */
	fromTimestamp: Timestamp;
	/** End of the time range to query (Unix timestamp in **milliseconds**). */
	toTimestamp: Timestamp;
	/** Maximum number of funding points to return. */
	limit?: number;
}

/**
 * Single funding rate datapoint for a perpetuals market at a given timestamp.
 *
 * Funding rate fields are expressed as fractions: `0.01` = `1%`.
 */
export interface PerpetualsMarketFundingHistoryPoint {
	/** Identifier of the perpetuals market. */
	marketId: PerpetualsMarketId;
	/** Timestamp at which this funding point was recorded (ms). */
	timestamp: Timestamp;
	/** On-chain event timestamp (ms). */
	eventTimestamp: Timestamp;
	/**
	 * Funding rate applied to long positions for this period, as a fraction
	 * (e.g. `0.01` = `1%`).
	 */
	longFundingRate: Percentage;
	/**
	 * Funding rate applied to short positions for this period, as a fraction
	 * (e.g. `0.01` = `1%`).
	 */
	shortFundingRate: Percentage;
	/**
	 * Cumulative funding rate accrued by long positions up to this point, as
	 * a fraction (e.g. `0.01` = `1%`).
	 */
	cumulativeLongFundingRate: Percentage;
	/**
	 * Cumulative funding rate accrued by short positions up to this point, as
	 * a fraction (e.g. `0.01` = `1%`).
	 */
	cumulativeShortFundingRate: Percentage;
	/** Sui transaction digest associated with this funding event. */
	txDigest: TransactionDigest;
}

/**
 * Response type for historical market funding data.
 */
export interface ApiPerpetualsMarketFundingHistoryResponse {
	/** Funding points in the requested time range. */
	history: PerpetualsMarketFundingHistoryPoint[];
}

/**
 * Request body for computing the maximum order size for an account in a
 * given market.
 */
export interface ApiPerpetualsMaxOrderSizeBody {
	/** Market in which the maximum order size is calculated. */
	marketId: PerpetualsMarketId;
	/** Account whose collateral and positions constrain the result. */
	accountId: PerpetualsAccountId;
	/** Side of the hypothetical order. */
	side: PerpetualsOrderSide;
	/** Optional leverage assumption used by the calculation. */
	leverage?: number;
	/** Optional order price assumption in quote units. */
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
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Serialized message bytes covered by `signature`. */
	bytes: string;
	/** Wallet signature over `bytes` from `walletAddress`. */
	signature: string;
	/** Optional market IDs used to limit the query. */
	marketIds?: PerpetualsMarketId[];
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
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
	/** Stop-order tickets returned for the requested account or vault. */
	stopOrderDatas: PerpetualsStopOrderData[];
}

// =========================================================================
//  TWAP Orders
// =========================================================================

/**
 * Per-order TWAP (time-weighted-average-price) request payload.
 */
export interface PerpetualsTwapOrderDetails {
	/** Market (clearing house) ID this TWAP order targets. */
	marketId: PerpetualsMarketId;
	/** Position side: `0` for bid (long), `1` for ask (short). */
	side: PerpetualsOrderSide;
	/** Total base-asset size to execute across all chunks (scaled base units). */
	size: bigint;
	/** Whether the order may only reduce an existing position. */
	reduceOnly: boolean;
	/** Number of child executions to split the order into. */
	chunksAmount: number;
	/** Target spacing between chunk executions, in milliseconds. */
	executionGapMs: number;
	/** Allowed jitter around each scheduled execution time, in milliseconds. */
	executionTimeUncertaintyMs: number;
	/** Optional deadline for the first execution (ms since epoch). */
	firstRunExpireTimestamp?: bigint;
	/** Optional overall expiry for the TWAP order (ms since epoch). */
	expireTimestamp?: bigint;
	/** How long to keep retrying a failed chunk execution, in milliseconds. */
	timeForRetryMs: number;
	/** Allowed deviation of a chunk's size from its target, in basis points. */
	amountUncertaintyBps: Bps;
	/** Cap on a single execution's size, as basis points of total size. */
	maxOneExecutionAmountBps: Bps;
	/**
	 * Threshold below which a small trailing remainder is merged into the final
	 * chunk, in basis points.
	 */
	smallTailMergeThresholdBps: Bps;
	/** Max slippage tolerated per chunk execution, in basis points. */
	maxSlippageBps: Bps;
	/** Optional integrator fee configuration (friendly fractional fee). */
	builderCode?: PerpetualsBuilderCodeParamaters;
}

/**
 * Lifecycle state of a TWAP order.
 */
export type PerpetualsTwapOrderState =
	| "unknown"
	| "invalid"
	| "pending"
	| "active"
	| "reservedForProcessing"
	| "executing"
	| "completed"
	| "spoiled"
	| "cancelled"
	| "toCancel"
	| "finalized";

/**
 * Per-order TWAP details as returned by the read endpoint.
 *
 * Same fields as {@link PerpetualsTwapOrderDetails} minus `builderCode`, which
 * the read response does not include.
 */
export type PerpetualsTwapOrderDetailsData = Omit<
	PerpetualsTwapOrderDetails,
	"builderCode"
>;

/**
 * A TWAP order as surfaced to clients by the read endpoint.
 */
export interface PerpetualsTwapOrderData {
	/** ID of the TWAP order object on-chain. */
	twapOrderObjectId: ObjectId;
	/** Collateral coin type backing the order. */
	collateralType: CoinType;
	/** Current lifecycle state of the TWAP order. */
	orderState: PerpetualsTwapOrderState;
	/** Reason the order is invalid, when `orderState === "invalid"`. */
	invalidReason?: string;
	/** Free-form status message about the order, if any. */
	statusMessage?: string;
	/** Order details. */
	details: PerpetualsTwapOrderDetailsData;
	/** Base-asset amount already executed (scaled base units). */
	processedAmount: bigint;
	/** Base-asset amount currently reserved for execution (scaled base units). */
	scheduledAmount: bigint;
	/** Timestamp (ms since epoch) of the most recent chunk execution. */
	lastExecutionTimestampMs: Timestamp;
}

/**
 * Edit to apply to an existing TWAP order. Any field left undefined is unchanged.
 */
export interface PerpetualsTwapOrderEdit {
	/** Replacement order details (full set). */
	newDetails?: PerpetualsTwapOrderDetails;
	/** Replacement set of authorized executor addresses. */
	newExecutors?: string[];
}

/**
 * Body fields the SDK fills in automatically, so callers omit them from every
 * `Sdk*Inputs` type.
 */
export type PerpetualsServerInjectedTxFields =
	| "txKind"
	| "walletAddress"
	| "accountId"
	| "accountCapId";

/**
 * SDK-level inputs for creating one or more TWAP orders — the request body
 * without the auto-filled fields, plus an optional transaction to extend.
 */
export type SdkPerpetualsCreateTwapOrdersInputs = Omit<
	ApiPerpetualsCreateTwapOrdersBody,
	PerpetualsServerInjectedTxFields
> & {
	/** Optional transaction to extend with the operation. */
	tx?: Transaction;
};

/**
 * Request body for creating TWAP orders via the API, for an
 * account or vault.
 */
export type ApiPerpetualsCreateTwapOrdersBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** TWAP orders to create. */
	twapOrders: PerpetualsTwapOrderDetails[];
	/** Optional gas coin argument used when extending the transaction. */
	gasCoinArg?: TransactionObjectArgument;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Whether the transaction is sponsored rather than paid directly by the wallet. */
	isSponsoredTx?: boolean;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * Request body for editing existing TWAP orders via the API.
 *
 * `newTwapOrders` maps each TWAP order object id to the edit to apply.
 */
export type ApiPerpetualsEditTwapOrdersBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Mapping from TWAP order object IDs to the edits to apply. */
	newTwapOrders: Record<ObjectId, PerpetualsTwapOrderEdit>;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * SDK-level inputs for editing existing TWAP orders — the request body without
 * the auto-filled fields, plus an optional transaction to extend.
 */
export type SdkPerpetualsEditTwapOrdersInputs = Omit<
	ApiPerpetualsEditTwapOrdersBody,
	PerpetualsServerInjectedTxFields
> & {
	/** Optional transaction to extend with the operation. */
	tx?: Transaction;
};

/**
 * Request body for canceling TWAP orders identified by object IDs, for an
 * account or vault.
 */
export type ApiPerpetualsCancelTwapOrdersBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** TWAP order object IDs to cancel. */
	twapOrderIds: ObjectId[];
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * SDK-level inputs for canceling TWAP orders — the request body without the
 * auto-filled fields, plus an optional transaction to extend.
 */
export type SdkPerpetualsCancelTwapOrdersInputs = Omit<
	ApiPerpetualsCancelTwapOrdersBody,
	PerpetualsServerInjectedTxFields
> & {
	/** Optional transaction to extend with the operation. */
	tx?: Transaction;
};

/**
 * Request body for fetching the TWAP orders of an account, validated using a
 * wallet signature.
 */
export type ApiPerpetualsTwapOrderDatasBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Serialized message bytes covered by `signature`. */
	bytes: string;
	/** Wallet signature over `bytes` from `walletAddress`. */
	signature: string;
	/** Optional market IDs used to limit the query. */
	marketIds?: PerpetualsMarketId[];
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * Response payload for TWAP-order queries.
 */
export interface ApiPerpetualsTwapOrderDatasResponse {
	/** TWAP order records returned for the requested account or vault. */
	twapOrderDatas: PerpetualsTwapOrderData[];
}

// =========================================================================
//  Transactions
// =========================================================================

/**
 * Request body for creating a vault capability (vault cap) for a given wallet.
 */
export interface ApiPerpetualsCreateVaultCapBody {
	/** Wallet that will own the created vault capability. */
	walletAddress: SuiAddress;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
	/** Metadata used to create the vault's LP coin type. */
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
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Metadata used to create the vault's LP asset. */
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
	/** Object ID of the collateral coin metadata. */
	coinMetadataId: ObjectId;
	/** Treasury-cap object ID used to create the vault asset. */
	treasuryCapId: ObjectId;
	/** Move coin type used as collateral. */
	collateralCoinType: CoinType;
	/** Vault lock period in milliseconds. */
	lockPeriodMs: bigint;
	/** Vault performance fee percentage. */
	performanceFeePercentage: Percentage;
	/** Delay before a force withdrawal can be processed, in milliseconds. */
	forceWithdrawDelayMs: bigint;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Whether the transaction is sponsored rather than paid directly by the wallet. */
	isSponsoredTx?: boolean;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Initial deposit amount in collateral units. */
			initialDepositAmount: Balance;
	  }
	| {
			/** Coin argument containing the initial deposit. */
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
	 * Numeric integrator id (as assigned by the registry) of the integrator
	 * being approved.
	 */
	integratorId: number;

	/**
	 * Maximum integrator fee (as a decimal) that the integrator can charge per
	 * order.
	 *
	 * For example, 0.001 represents a 0.1% maximum fee. The service converts
	 * this to the on-chain scaled format internally. The integrator can set
	 * any fee up to this maximum when placing orders on behalf of the user.
	 */
	maxIntegratorFee: Percentage;

	/**
	 * Optional existing transaction kind (base64-encoded) to extend.
	 *
	 * If provided, the new integrator approval will be added to this transaction.
	 */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
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
	 * Numeric integrator id (as assigned by the registry) of the integrator
	 * whose permissions are being revoked.
	 */
	integratorId: number;

	/**
	 * Optional existing transaction kind (base64-encoded) to extend.
	 *
	 * If provided, the integrator removal will be added to this transaction.
	 */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Request payload for creating a transaction to initialize an integrator fee vault.
 *
 * Before an integrator can claim fees, they must first create a global vault.
 * This is a one-time setup per integrator and applies across all markets. The
 * integrator's identity (address) is taken from the transaction sender on-chain.
 */
export interface ApiPerpetualsBuilderCodesCreateIntegratorVaultTxBody {
	/**
	 * Optional existing transaction kind (base64-encoded) to extend.
	 *
	 * If provided, the vault creation will be added to this transaction.
	 */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Request payload for creating a transaction to claim accumulated integrator fees from a vault.
 *
 * Integrators earn fees on taker volume generated by orders they submit on behalf of users.
 * These fees accumulate in a global vault per integrator and can be claimed at any time.
 */
export interface ApiPerpetualsBuilderCodesClaimIntegratorVaultFeesTxBody {
	/**
	 * Numeric integrator id (as assigned by the registry).
	 *
	 * Only the integrator who earned the fees can claim them. Integrator vaults
	 * are global across markets, so no clearing-house id is required.
	 */
	integratorId: number;

	/**
	 * Optional recipient address for the claimed fees.
	 *
	 * When provided, the transaction will include on-chain transfers of all
	 * claimed coins to this address. When omitted, the claimed coins are exposed
	 * as transaction arguments that can be used in subsequent commands.
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
 * Contains the transaction kind and optionally the coin output arguments when
 * no recipient address was provided.
 */
export interface ApiPerpetualsBuilderCodesClaimIntegratorVaultFeesTxResponse {
	/**
	 * Base64-encoded Sui `TransactionKind` representing the claim (and
	 * optional transfer) transaction.
	 */
	txKind: SerializedTransaction;

	/**
	 * When `recipientAddress` is omitted, this contains readable arguments
	 * pointing to each claimed coin output (one per non-zero collateral balance
	 * held by the integrator's global vault), so callers can wire them into
	 * subsequent steps. Empty if the vault holds no balances.
	 */
	coinOutArgs?: TransactionObjectArgument[];
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
	 * Numeric integrator id (as assigned by the registry) whose configuration is
	 * being queried.
	 */
	integratorId: number;
}

/**
 * Response payload containing integrator configuration details.
 *
 * Returns whether an integrator configuration exists and the maximum integrator
 * fee if the integrator has been approved.
 */
export interface ApiPerpetualsBuilderCodesIntegratorConfigResponse {
	/**
	 * Maximum integrator fee (as a decimal) that the integrator is authorized to
	 * charge.
	 *
	 * For example, 0.001 represents a 0.1% maximum fee. This value is only meaningful
	 * if `exists` is true.
	 */
	maxIntegratorFee: Percentage | undefined;

	/**
	 * Whether an integrator configuration exists for this account-integrator pair.
	 *
	 * If false, the integrator has not been approved by the account and cannot
	 * collect fees on orders placed on behalf of the account.
	 */
	exists: boolean;
}

/**
 * Accumulated integrator vault fees for a single collateral coin type.
 *
 * Integrator vaults are global (one per integrator across all markets), so fees
 * are grouped by collateral coin type rather than by market.
 */
export interface PerpetualsIntegratorVaultData {
	/**
	 * The collateral coin type these fees are denominated in.
	 */
	collateralCoinType: CoinType;

	/**
	 * Total accumulated fees in the collateral currency that are available to claim.
	 */
	fees: number;

	/**
	 * Total accumulated fees converted to USD.
	 */
	feesUsd: number;
}

/**
 * Request payload for fetching integrator vault fees.
 *
 * This endpoint returns the accumulated fees an integrator has earned in their
 * global vault, grouped by collateral coin type. Vaults are global per integrator
 * (not per market), so a single request covers all markets.
 */
export interface ApiPerpetualsBuilderCodesIntegratorVaultsBody {
	/**
	 * Numeric integrator id (as assigned by the registry) whose vault fees are
	 * being queried.
	 */
	integratorId: number;
}

/**
 * Response payload containing accumulated fees per collateral type for an integrator.
 *
 * Returns a vector of integrator vault data, one entry per collateral coin type
 * with a non-zero balance in the integrator's global vault.
 */
export interface ApiPerpetualsBuilderCodesIntegratorVaultsResponse {
	/**
	 * Vector of integrator vault data containing collateral coin types and their
	 * accumulated fees.
	 */
	integratorVaults: PerpetualsIntegratorVaultData[];
}

/**
 * Request body for creating a new perpetuals account for a given wallet
 * and collateral coin type.
 */
export interface ApiPerpetualsCreateAccountBody {
	/** Wallet that will own the created account capability. */
	walletAddress: SuiAddress;
	/** Collateral coin type for the new account. */
	collateralCoinType: CoinType;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** When `true`, defer sharing and return PTB argument references. */
	deferShare?: boolean;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Response from the create-account endpoint.
 *
 * When `deferShare` is false (default), returns `txKind` and optionally `sponsorSignature`.
 * When `deferShare` is true, additionally returns `deferred` with argument references
 * for PTB composition.
 */
export interface ApiPerpetualsCreateAccountResponse {
	/** Serialized transaction kind for creating the account. */
	txKind: SerializedTransaction;
	/** Sponsor signature returned for a sponsored transaction, if any. */
	sponsorSignature?: string;
	/** Deferred account argument references for downstream composition
	 * (only set when `deferShare = true`). */
	deferred?: DeferredAccountArgs;
}

/**
 * Request body for depositing collateral into a perpetuals account.
 *
 * The deposit can be provided by:
 * - `depositAmount` (numeric amount), or
 * - `depositCoinArg` (Sui coin object).
 */
export type ApiPerpetualsDepositCollateralBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Account ID associated with the request. */
	accountId: PerpetualsAccountId;
	/** Optional account capability object ID used to authorize the account operation. */
	accountCapId?: ObjectId;
	/** Move coin type used as collateral. */
	collateralCoinType: CoinType;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Whether the transaction is sponsored rather than paid directly by the wallet. */
	isSponsoredTx?: boolean;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Collateral amount to deposit. */
			depositAmount: Balance;
	  }
	| {
			/** Coin argument containing the collateral deposit. */
			depositCoinArg: TransactionObjectArgument;
	  }
);

/**
 * Request body for withdrawing collateral from an account.
 */
export interface ApiPerpetualsWithdrawCollateralBody {
	/** Perpetuals account from which collateral is withdrawn. */
	accountId: PerpetualsAccountId;
	/** Withdrawal amount in the collateral coin's smallest unit. */
	withdrawAmount: Balance;
	/** Optional recipient. The account owner is used when omitted. */
	recipientAddress?: SuiAddress;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Response body for withdraw-collateral transactions.
 *
 * The SDK typically uses `txKind` to reconstruct a transaction locally.
 */
export interface ApiPerpetualsWithdrawCollateralResponse {
	/** Serialized transaction kind for the withdrawal. */
	txKind: SerializedTransaction;
	/** Sponsor signature returned for a sponsored transaction, if any. */
	sponsorSignature?: string;
	/** PTB argument for the withdrawn coin output, when available. */
	coinOutArg: TransactionObjectArgument | undefined;
}

/**
 * Request body for transferring collateral between two perpetuals accounts.
 */
export interface ApiPerpetualsTransferCollateralBody {
	/** Wallet authorized to transfer collateral. */
	walletAddress: SuiAddress;
	/** Source perpetuals account ID. */
	fromAccountId: PerpetualsAccountId;
	/** Optional source account capability object ID. */
	fromAccountCapId?: ObjectId;
	/** Destination perpetuals account ID. */
	toAccountId: PerpetualsAccountId;
	/** Optional destination account capability object ID. */
	toAccountCapId?: ObjectId;
	/** Amount to transfer in the collateral coin's smallest unit. */
	transferAmount: Balance;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Request body for allocating collateral to a given market (account/vault).
 */
export type ApiPerpetualsAllocateCollateralBody = {
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Collateral amount to allocate to the position. */
	allocateAmount: Balance;
	/**
	 * Caller wallet. For vault-backed accounts, when the caller is a vault
	 * assistant (rather than the vault owner), the backend uses this to
	 * resolve the correct assistant cap.
	 */
	walletAddress?: SuiAddress;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * Request body for deallocating collateral from a given market (account/vault).
 */
export type ApiPerpetualsDeallocateCollateralBody = {
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Collateral amount to deallocate from the position. */
	deallocateAmount: Balance;
	/**
	 * Caller wallet. For vault-backed accounts, when the caller is a vault
	 * assistant (rather than the vault owner), the backend uses this to
	 * resolve the correct assistant cap.
	 */
	walletAddress?: SuiAddress;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
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
	stopOrders: Omit<PerpetualsStopOrderData, "objectId" | "orderState">[];
	/** Optional transaction to embed the call in. */
	tx?: Transaction;
	/** Optional gas coin for sponsored or custom gas usage. */
	gasCoinArg?: TransactionObjectArgument;
	/** Whether the transaction is expected to be sponsored by the API. */
	isSponsoredTx?: boolean;
	/** Optional gas pool sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Request body for placing stop orders via the API.
 */
export type ApiPerpetualsPlaceStopOrdersBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Stop orders to create or update. */
	stopOrders: Omit<PerpetualsStopOrderData, "objectId" | "orderState">[];
	/** Optional gas coin argument used when extending the transaction. */
	gasCoinArg?: TransactionObjectArgument;
	/** Whether the transaction is sponsored rather than paid directly by the wallet. */
	isSponsoredTx?: boolean;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * SDK-level inputs for placing stop-loss / take-profit orders bound to a
 * specific market and position side.
 */
export interface SdkPerpetualsPlaceSlTpOrdersInputs {
	/** Market and position side targeted by the SL/TP orders. */
	marketId: PerpetualsMarketId;
	/** Optional target size for SL/TP orders (scaled base units). */
	size?: bigint;
	/** Price at which to trigger stop loss (interpreted per `triggerPriceType`). */
	stopLossPrice?: number;
	/** Price at which to trigger take profit (interpreted per `triggerPriceType`). */
	takeProfitPrice?: number;
	/**
	 * Which on-chain price the trigger uses: 0 = index (default), 1 = book, 2 = mark.
	 */
	triggerPriceType?: PerpetualsStopOrderTriggerPriceType;
	/** Optional integrator fee configuration applied when the SL/TP fires. */
	builderCode?: PerpetualsBuilderCodeParamaters;
	/** Unique order identifier for limit order sl/tp is tied to. */
	limitOrderId?: PerpetualsOrderId;
	/** Optional transaction to embed in. */
	tx?: Transaction;
	/** Optional gas coin argument. */
	gasCoinArg?: TransactionObjectArgument;
	/** Whether to treat the transaction as sponsored. */
	isSponsoredTx?: boolean;
	/** Optional gas pool sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
}
// & (
// 	| {
// 			stopLossPrice: number;
// 			takeProfitPrice: number;
// 	  }
// 	| {
// 			stopLossPrice: number;
// 	  }
// 	| {
// 			takeProfitPrice: number;
// 	  }
// );

/**
 * API request body for placing SL/TP orders bound to a position.
 */
export type ApiPerpetualsPlaceSlTpOrdersBody = {
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Position side to which the stop-loss or take-profit order applies. */
	positionSide: PerpetualsOrderSide;
	/** Order size in base units. */
	size?: bigint;
	/** Stop-loss trigger price. */
	stopLossPrice?: number;
	/** Take-profit trigger price. */
	takeProfitPrice?: number;
	/**
	 * Which on-chain price the trigger uses: 0 = index (default), 1 = book, 2 = mark.
	 */
	triggerPriceType?: PerpetualsStopOrderTriggerPriceType;
	/** Optional integrator fee configuration applied when the SL/TP fires. */
	builderCode?: PerpetualsBuilderCodeParamaters;
	/** Optional limit-order ID associated with the stop-loss or take-profit order. */
	limitOrderId?: PerpetualsOrderId;
	/** Optional gas coin argument used when extending the transaction. */
	gasCoinArg?: TransactionObjectArgument;
	/** Whether the transaction is sponsored rather than paid directly by the wallet. */
	isSponsoredTx?: boolean;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
	/** Leverage applied by the request or preview. */
	leverage?: number;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);
// & (
// 	| {
// 			stopLossPrice: number;
// 			takeProfitPrice: number;
// 	  }
// 	| {
// 			stopLossPrice: number;
// 	  }
// 	| {
// 			takeProfitPrice: number;
// 	  }
// );

/**
 * API request body for editing existing stop orders for an
 * account or vault.
 */
export type ApiPerpetualsEditStopOrdersBody = {
	/** Stop orders to create or update. */
	stopOrders: PerpetualsStopOrderData[];
	/**
	 * Caller wallet. For vault-backed accounts, when the caller is a vault
	 * assistant (rather than the vault owner), the backend uses this to
	 * resolve the correct assistant cap.
	 */
	walletAddress?: SuiAddress;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
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
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Order side: `0` for bid or long, `1` for ask or short. */
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
		/** Optional gas coin argument used when extending the transaction. */
		gasCoinArg?: TransactionObjectArgument;
		/** Whether the transaction is sponsored rather than paid directly by the wallet. */
		isSponsoredTx?: boolean;
		/** Order size in base units. */
		size?: bigint;
		/** Stop-loss trigger price. */
		stopLossPrice?: number;
		/** Take-profit trigger price. */
		takeProfitPrice?: number;
		/**
		 * Which on-chain price the trigger uses: 0 = index (default), 1 = book, 2 = mark.
		 */
		triggerPriceType?: PerpetualsStopOrderTriggerPriceType;
		/** Optional integrator fee configuration applied when the SL/TP fires. */
		builderCode?: PerpetualsBuilderCodeParamaters;
	};
	// & (
	// 	| {
	// 			stopLossPrice: number;
	// 			takeProfitPrice: number;
	// 	  }
	// 	| {
	// 			stopLossPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitPrice: number;
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
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * API request body for placing a limit order in a given market.
 */
export type ApiPerpetualsLimitOrderBody = {
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Order side: `0` for bid or long, `1` for ask or short. */
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
		/** Optional gas coin argument used when extending the transaction. */
		gasCoinArg?: TransactionObjectArgument;
		/** Whether the transaction is sponsored rather than paid directly by the wallet. */
		isSponsoredTx?: boolean;
		/** Order size in base units. */
		size?: bigint;
		/** Stop-loss trigger price. */
		stopLossPrice?: number;
		/** Take-profit trigger price. */
		takeProfitPrice?: number;
		/**
		 * Which on-chain price the trigger uses: 0 = index (default), 1 = book, 2 = mark.
		 */
		triggerPriceType?: PerpetualsStopOrderTriggerPriceType;
		/** Optional integrator fee configuration applied when the SL/TP fires. */
		builderCode?: PerpetualsBuilderCodeParamaters;
	};
	// & (
	// 	| {
	// 			stopLossPrice: number;
	// 			takeProfitPrice: number;
	// 	  }
	// 	| {
	// 			stopLossPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitPrice: number;
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
	/**
	 * Optional client-managed order id to tag this limit order with. Resolve or
	 * cancel by this id later instead of the on-chain order id.
	 */
	clientOrderId?: PerpetualsClientOrderId;
	/** Optionally pre-built transaction payload. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * API request body for placing a scale order (multiple limit orders
 * distributed across a price range) in a given market.
 */
export type ApiPerpetualsScaleOrderBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Order side: `0` for bid or long, `1` for ask or short. */
	side: PerpetualsOrderSide;
	/** Total size distributed across all orders (base asset amount, scaled bigint). */
	totalSize: bigint;
	/** Starting price of the scale range (inclusive, scaled bigint). */
	startPrice: bigint;
	/** Ending price of the scale range (inclusive, scaled bigint). */
	endPrice: bigint;
	/** Number of limit orders to place across the range. */
	numberOfOrders: number;
	/** Order type (e.g. GTC, IOC). */
	orderType: PerpetualsOrderType;
	/** Collateral change associated with this order. */
	collateralChange: number;
	/** Whether the account already has a position in this market. */
	hasPosition: boolean;
	/** If true, orders can only reduce an existing position. */
	reduceOnly: boolean;
	/** True if position is closed. */
	cancelSlTp: boolean;
	/** Optional expiration timestamp in milliseconds since epoch. */
	expiryTimestamp?: bigint;
	/** Optional leverage override. */
	leverage?: number;
	/** Size ratio between last and first order. `1.0` = uniform, `2.0` = last is 2x first. */
	sizeSkew?: number;
	/** Optional integrator fee configuration. */
	builderCode?: PerpetualsBuilderCodeParamaters;
	/**
	 * Optional client-managed order ids to tag the scale ladder with. When
	 * provided, the length should match `numberOfOrders`; the id at each index
	 * tags the corresponding ladder order.
	 */
	clientOrderIds?: PerpetualsClientOrderId[];
	/** Optionally pre-built transaction payload. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * A single order to place as part of a cancel-and-place batch.
 */
export interface ApiPerpetualsOrderToPlace {
	/** Order side: `0` = bid (long), `1` = ask (short). */
	side: PerpetualsOrderSide;
	/** Limit price (scaled bigint). */
	price: bigint;
	/** Order size in scaled base units. */
	size: bigint;
	/** Optional client-managed order id to tag this placed order with. */
	clientOrderId?: PerpetualsClientOrderId;
}

/**
 * API request body for atomically canceling existing orders and placing
 * new ones in a single transaction.
 */
export type ApiPerpetualsCancelAndPlaceOrdersBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Order IDs to cancel. */
	orderIdsToCancel: PerpetualsOrderId[];
	/** New orders to place after the cancellation. */
	ordersToPlace: ApiPerpetualsOrderToPlace[];
	/** Order type (e.g. GTC, IOC). */
	orderType: PerpetualsOrderType;
	/** If true, placed orders can only reduce an existing position. */
	reduceOnly: boolean;
	/** Optional expiration timestamp in milliseconds since epoch. */
	expiryTimestamp?: bigint;
	/** Optional leverage override. */
	leverage?: number;
	/** Whether the account already has a position in this market. */
	hasPosition: boolean;
	/** Optional integrator fee configuration. */
	builderCode?: PerpetualsBuilderCodeParamaters;
	/**
	 * If true, also deallocate free collateral (margin not backing a position)
	 * back to the wallet in the same transaction. Defaults to false.
	 */
	shouldDeallocateFreeCollateral?: boolean;
	/**
	 * If true, abort the transaction when any ID in `orderIdsToCancel` is not
	 * found on-chain. If false (default), missing IDs are tolerated.
	 */
	shouldAbortOnMissingId?: boolean;
	/**
	 * Optional client-managed order ids to cancel (in addition to
	 * `orderIdsToCancel`).
	 */
	clientOrderIdsToCancel?: PerpetualsClientOrderId[];
	/** Optionally pre-built transaction payload. */
	txKind?: SerializedTransaction;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * API request body for canceling one or more orders for an
 * account or vault, per market.
 */
export type ApiPerpetualsCancelOrdersBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Per-market map of order IDs or preview results. */
	marketIdsToData: Record<
		PerpetualsMarketId,
		{
			orderIds: PerpetualsOrderId[];
			/**
			 * Optional client-managed order ids to cancel in this market (in
			 * addition to `orderIds`).
			 */
			clientOrderIds?: PerpetualsClientOrderId[];
			/** Collateral change associated with canceling these orders. */
			collateralChange: number;
		}
	>;
	/**
	 * If true, abort the transaction when any given order ID is not found
	 * on-chain. If false (default), missing IDs are tolerated.
	 */
	shouldAbortOnMissingId?: boolean;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
			vaultId: ObjectId;
	  }
);

/**
 * API request body for canceling stop orders identified by object IDs.
 */
export type ApiPerpetualsCancelStopOrdersBody = {
	/** Wallet address used to identify the signer or owner. */
	walletAddress: SuiAddress;
	/** Stop-order object IDs to cancel. */
	stopOrderIds: ObjectId[];
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
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
	/** Market ID associated with the request. */
	marketId: PerpetualsMarketId;
	/** Collateral amount to allocate, deallocate, or change. */
	collateralChange: number;
	/** Leverage applied by the request or preview. */
	leverage: number;
	/**
	 * Caller wallet. For vault-backed accounts, when the caller is a vault
	 * assistant (rather than the vault owner), the backend uses this to
	 * resolve the correct assistant cap.
	 */
	walletAddress?: SuiAddress;
	/** Serialized transaction kind sent to the service. */
	txKind?: SerializedTransaction;
	/** Optional transaction sponsorship configuration. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Account ID associated with the request. */
			accountId: PerpetualsAccountId;
			/** Optional account capability object ID used to authorize the account operation. */
			accountCapId?: ObjectId;
	  }
	| {
			/** Vault object ID used instead of an account. */
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
	/** 24-hour statistics aligned with the requested market IDs. */
	marketsStats: PerpetualsMarket24hrStats[];
}

/**
 * Request body for fetching all markets for a given collateral type.
 *
 * This endpoint is commonly used to populate a "Markets" list filtered by
 * the user's selected collateral (e.g., USDC-margined markets).
 */
export interface ApiPerpetualsAllMarketsBody {
	/** Collateral coin type used to filter available markets. */
	collateralCoinType: CoinType;
}

/**
 * Response payload for {@link ApiPerpetualsAllMarketsBody}.
 *
 * Returns enriched market data including parameters, state, and current prices.
 */
export interface ApiPerpetualsAllMarketsResponse {
	/** Market snapshots matching the requested collateral type. */
	markets: PerpetualsMarketData[];
}

/**
 * Request body for fetching a specific set of markets by ID.
 */
export interface ApiPerpetualsMarketsBody {
	/** Market object IDs to query. */
	marketIds: PerpetualsMarketId[];
}

/**
 * Display metadata for a market: ticker symbols, label, artwork and
 * category.
 *
 * Presentation data only — none of it affects pricing, margin or execution.
 */
export interface PerpetualsMarketMetadata {
	/** Base asset ticker, e.g. `"BTC"` (not the `"BTCUSD"` pair symbol). */
	symbol: string;
	/** Long-form name, e.g. `"Bitcoin"`. Absent when unset. */
	displayName?: string;
	/** Grouping label, e.g. `"Crypto"`, `"Commodities"`, `"Equities"`. */
	category: string;
	/** Icon location for the market, e.g. `"/markets/btc.png"`. */
	image: string;
	/** Collateral asset ticker, e.g. `"USDC"`. */
	collateralSymbol: string;
}

/**
 * Response payload for {@link ApiPerpetualsMarketsBody}.
 *
 * Each item includes the market data, plus display metadata when it is
 * available for that market.
 */
export interface ApiPerpetualsMarketsResponse {
	/** Market snapshots and optional display metadata. */
	marketDatas: {
		market: PerpetualsMarketData;
		metadata?: PerpetualsMarketMetadata | null;
	}[];
}

/**
 * Request body for fetching a specific set of orderbooks by market ID.
 */
export interface ApiPerpetualsOrderbooksBody {
	/** Market object IDs whose orderbooks are queried. */
	marketIds: PerpetualsMarketId[];
}

/**
 * Response payload for {@link ApiPerpetualsOrderbooksBody}.
 *
 * Each item includes the current orderbook snapshot.
 */
export interface ApiPerpetualsOrderbooksResponse {
	/** Orderbook snapshots for the requested markets. */
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
	/** Optional vault object IDs. Omit to request all available vaults. */
	vaultIds?: ObjectId[];
}

/**
 * Response payload for vault queries.
 */
export interface ApiPerpetualsVaultsResponse {
	/** Vault snapshots returned by the query. */
	vaults: PerpetualsVaultObject[];
}

/**
 * Request body for fetching current prices for a list of markets.
 *
 * This is a lightweight alternative to fetching full {@link PerpetualsMarketData}
 * when only prices are needed.
 */
export interface ApiPerpetualsMarketsPricesBody {
	/** Market object IDs whose prices are queried. */
	marketIds: PerpetualsMarketId[];
}

/**
 * Response payload for {@link ApiPerpetualsMarketsPricesBody}.
 *
 * Returns base (index/oracle) and collateral prices, the order book mid price,
 * and the mark price used for liquidations and risk calculations.
 */
export interface ApiPerpetualsMarketsPricesResponse {
	/** Current price records for the requested markets. */
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
 *
 * ### Methods
 * - **Method 1 (existing account)**: Provide `accountId`.
 * - **Method 2 (composed flow)**: Provide `deferred` with argument references
 *   from a deferred `getCreateAccountTx` call.
 */
export interface ApiPerpetualsGrantAgentWalletTxBody {
	/** Wallet that receives assistant-level account permissions. */
	recipientAddress: SuiAddress;
	/** Perpetuals account ID (Method 1). */
	accountId?: PerpetualsAccountId;
	/** Composed PTB args from deferred create-account (Method 2). */
	deferred?: DeferredAccountArgs;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
}

/**
 * Request body for revoking an Agent Wallet from a perpetuals account.
 *
 * This corresponds to `POST /api/perpetuals/account/transactions/revoke-agent-wallet`.
 *
 * The resulting on-chain transaction must be signed by the **account admin** wallet.
 * `accountCapId` is the object ID of the assistant capability to revoke.
 */
export interface ApiPerpetualsRevokeAgentWalletTxBody {
	/** Perpetuals account whose assistant capability is revoked. */
	accountId: PerpetualsAccountId;
	/** Assistant capability object ID to revoke. */
	accountCapId: ObjectId;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
}

/** Request body for granting an Agent Wallet on a perpetuals vault. */
export interface ApiPerpetualsVaultGrantAgentWalletTxBody {
	/** Vault object whose assistant capability is created. */
	vaultId: ObjectId;
	/** Wallet that receives assistant-level vault permissions. */
	recipientAddress: SuiAddress;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
}

/** Request body for revoking an Agent Wallet from a perpetuals vault. */
export interface ApiPerpetualsVaultRevokeAgentWalletTxBody {
	/** Vault object whose assistant capability is revoked. */
	vaultId: ObjectId;
	/** Assistant capability object ID to revoke. */
	accountCapId: ObjectId;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
}

/** Request body for transferring an account or vault capability. */
export interface ApiPerpetualsTransferCapTxBody {
	/**
	 * Recipient wallet address that should receive the capability object.
	 *
	 * Must be a valid Sui address string.
	 */
	recipientAddress: SuiAddress;

	/**
	 * Object ID of the capability to transfer.
	 *
	 * Required for Method 1 (on-chain object); omit for Method 2 (composed flow).
	 */
	capObjectId?: ObjectId;

	/**
	 * Composed PTB argument + capability type from a deferred flow.
	 *
	 * Required for Method 2 (composed flow); omit for Method 1.
	 */
	composed?: ComposedTransferArgs;

	/**
	 * Optional serialized (base64) Sui `TransactionKind` to extend.
	 *
	 * When provided, the transfer operation is appended to the existing transaction.
	 */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Request body for sharing a Perpetuals account that was created with deferred sharing.
 *
 * This finalizes the account creation flow by consuming the `AccountSharePolicy`
 * and sharing the `Account` object.
 *
 * The deferred account fields (`accountArg`, `sharePolicyArg`, `adminCapArg`,
 * `collateralCoinType`) are sent as top-level fields (matching the API's flattened layout).
 *
 * ### Example flow
 * 1. `create-account` with `deferShare=true` → returns `deferred` with argument references
 * 2. `grant-agent-wallet` with `deferred` → mints assistant cap
 * 3. `transfer-cap` with `composed` → transfers admin cap to primary wallet
 * 4. `share` with deferred fields → finalizes account sharing
 */
export interface ApiPerpetualsShareAccountBody {
	/** PTB argument for the deferred Account object. */
	accountArg: TransactionObjectArgument;
	/** PTB argument for the AccountSharePolicy object. */
	sharePolicyArg: TransactionObjectArgument;
	/** PTB argument for the AccountCap with admin authority. */
	adminCapArg: TransactionObjectArgument;
	/** Collateral coin type parameter for the account. */
	collateralCoinType: CoinType;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

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
	/** Vault object IDs whose LP prices are queried. */
	vaultIds: ObjectId[];
}

/**
 * Response payload for {@link ApiPerpetualsVaultLpCoinPricesBody}.
 *
 * The response is index-aligned with the request `vaultIds` array.
 */
export interface ApiPerpetualsVaultLpCoinPricesResponse {
	/** LP prices aligned with the requested vault IDs. */
	lpCoinPrices: number[];
}

/**
 * Request body for fetching a wallet's owned LP coin objects across vaults.
 */
export interface ApiPerpetualsVaultOwnedLpCoinsBody {
	/** Wallet whose LP coin objects are queried. */
	walletAddress: SuiAddress;
}

/**
 * Response payload listing owned LP coin objects (per vault).
 */
export interface ApiPerpetualsVaultOwnedLpCoinsResponse {
	/** LP coin positions owned by the wallet. */
	ownedLpCoins: PerpetualsVaultLpCoin[];
}

/**
 * Request body for fetching vault capability objects owned by a wallet.
 *
 * Vault caps are typically owned by the vault creator/owner and are required
 * for privileged vault actions (processing withdrawals, updating parameters, etc.).
 */
export interface ApiPerpetualsOwnedVaultCapsBody {
	/** Wallet whose owned vault capabilities are queried. */
	walletAddress: SuiAddress;
}

/**
 * Response payload listing all vault caps owned by the wallet.
 */
export interface ApiPerpetualsOwnedVaultCapsResponse {
	/** Vault capabilities owned by the wallet. */
	ownedVaultCaps: PerpetualsVaultCap[];
}

/**
 * Request body for fetching vault **assistant** capability objects owned by a
 * wallet.
 *
 * Assistant caps let a non-owner wallet operate a vault on behalf of the
 * owner. They are structurally identical to regular vault caps but grant a
 * narrower permission set.
 */
export interface ApiPerpetualsOwnedVaultAssistantCapsBody {
	/** Wallet whose owned assistant capabilities are queried. */
	walletAddress: SuiAddress;
}

/**
 * Response payload listing all vault assistant caps owned by the wallet.
 */
export interface ApiPerpetualsOwnedVaultAssistantCapsResponse {
	/** Vault assistant capabilities owned by the wallet. */
	ownedVaultAssistantCaps: PerpetualsVaultCap[];
}

/**
 * API body to process forced withdrawals in a vault.
 */
export interface ApiPerpetualsVaultProcessForceWithdrawRequestTxBody {
	/** Wallet that owns the withdraw request. */
	walletAddress: SuiAddress;
	/** Vault processing the request. */
	vaultId: ObjectId;
	/** Per-market sizes to close as part of force withdraw. */
	sizesToClose: Record<PerpetualsMarketId, Balance>;
	/** Optional recipient of the resulting collateral coin. */
	recipientAddress?: SuiAddress;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Response body for force-withdraw processing transactions.
 *
 * - `txKind` is a serialized transaction kind the client can sign/submit.
 * - `coinOutArg` (if present) is the transaction argument referencing the
 *   withdrawn collateral coin output.
 */
export interface ApiPerpetualsVaultProcessForceWithdrawRequestTxResponse {
	/** Serialized transaction kind for processing the request. */
	txKind: SerializedTransaction;
	/** Sponsor signature returned for a sponsored transaction, if any. */
	sponsorSignature?: string;
	/** PTB argument for the withdrawn collateral coin output. */
	coinOutArg: TransactionObjectArgument | undefined;
}

/** Request body for pausing a vault during force-withdraw processing. */
export interface ApiPerpetualsVaultPauseVaultForForceWithdrawRequestTxBody {
	/** Vault object to pause. */
	vaultId: ObjectId;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * API body to process regular withdraw requests for a vault.
 */
export interface ApiPerpetualsVaultOwnerProcessWithdrawRequestsTxBody {
	/** Vault whose queued user requests are processed. */
	vaultId: ObjectId;
	/** User addresses whose requests are included. */
	userAddresses: SuiAddress[];
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * API body to update slippage parameter for pending vault withdraw
 * request for a specific vault.
 */
export interface ApiPerpetualsVaultUpdateWithdrawRequestSlippageTxBody {
	/** Vault containing the pending request. */
	vaultId: ObjectId;
	/** Minimum collateral output in the collateral coin's smallest unit. */
	minCollateralAmountOut: Balance;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * API body to update the force-withdrawal delay in a vault.
 */
export interface ApiPerpetualsVaultOwnerUpdateForceWithdrawDelayTxBody {
	/** Vault whose force-withdraw delay is updated. */
	vaultId: ObjectId;
	/** New force-withdraw delay in milliseconds. */
	forceWithdrawDelayMs: bigint;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * API body to update the lock period on a vault.
 */
export interface ApiPerpetualsVaultOwnerUpdateLockPeriodTxBody {
	/** Vault whose lock period is updated. */
	vaultId: ObjectId;
	/** New deposit lock period in milliseconds. */
	lockPeriodMs: bigint;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * API body to update the owner's fee percentage on a vault.
 */
export interface ApiPerpetualsVaultOwnerUpdatePerformanceFeeTxBody {
	/** Vault whose performance fee is updated. */
	vaultId: ObjectId;
	/** New performance fee as a decimal fraction. */
	performanceFeePercentage: number;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * API body for the vault owner withdrawing collected fees.
 */
export interface ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxBody {
	/** Vault from which performance fees are withdrawn. */
	vaultId: ObjectId;
	/** Fee amount in the collateral coin's smallest unit. */
	withdrawAmount: Balance;
	/** Optional recipient of the fee coin. */
	recipientAddress?: SuiAddress;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
}

/**
 * Response for owner-fee withdrawal transactions.
 */
export interface ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxResponse {
	/** Serialized transaction kind for withdrawing performance fees. */
	txKind: SerializedTransaction;
	/** Sponsor signature returned for a sponsored transaction, if any. */
	sponsorSignature?: string;
	/** PTB argument for the withdrawn fee coin output. */
	coinOutArg: TransactionObjectArgument | undefined;
}

/**
 * Request body for fetching all withdrawal requests for specific vaults.
 */
export interface ApiPerpetualsVaultsWithdrawRequestsBody {
	/** Vault object IDs whose queued requests are queried. */
	vaultIds: ObjectId[];
}

/**
 * Response payload listing withdrawal requests for the requested vaults.
 *
 * Depending on backend behavior, this may include all queued requests across
 * all specified vaults.
 */
export interface ApiPerpetualsVaultsWithdrawRequestsResponse {
	/** Withdrawal requests returned for the requested vaults. */
	withdrawRequests: PerpetualsVaultWithdrawRequest[];
}

/**
 * Request body for fetching withdrawal requests for a given wallet across
 * its vault positions.
 */
export interface ApiPerpetualsVaultOwnedWithdrawRequestsBody {
	/** Wallet whose vault withdrawal requests are queried. */
	walletAddress: SuiAddress;
	// vaultIds: ObjectId[] | undefined;
}

/**
 * Response payload listing withdrawal requests created by `walletAddress`.
 */
export interface ApiPerpetualsVaultOwnedWithdrawRequestsResponse {
	/** Withdrawal requests owned by the wallet. */
	ownedWithdrawRequests: PerpetualsVaultWithdrawRequest[];
}

/**
 * API body for creating a single withdraw request from a vault.
 */
export interface ApiPerpetualsVaultCreateWithdrawRequestTxBody {
	/** Vault from which LP tokens are withdrawn. */
	vaultId: ObjectId;
	/** Wallet that owns the LP tokens. */
	walletAddress: SuiAddress;
	/** LP amount to withdraw in the LP coin's smallest unit. */
	lpWithdrawAmount: Balance;
	/** Minimum collateral output in the collateral coin's smallest unit. */
	minCollateralAmountOut: Balance;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * API body for withdrawing collateral from a vault as owner.
 */
export interface ApiPerpetualsVaultOwnerWithdrawCollateralTxBody {
	/** Vault from which collateral is withdrawn. */
	vaultId: ObjectId;
	/** LP amount to redeem in the LP coin's smallest unit. */
	lpWithdrawAmount: Balance;
	/** Minimum collateral output in the collateral coin's smallest unit. */
	minCollateralAmountOut: Balance;
	/** Optional recipient of the collateral coin. */
	recipientAddress?: SuiAddress;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
}

/**
 * Response body for vault owner withdraw-collateral transactions.
 *
 * The SDK typically uses `txKind` to reconstruct a transaction locally.
 */
export interface ApiPerpetualsVaultOwnerWithdrawCollateralTxResponse {
	/** Serialized transaction kind for the withdrawal. */
	txKind: SerializedTransaction;
	/** Sponsor signature returned for a sponsored transaction, if any. */
	sponsorSignature?: string;
	/** PTB argument for the withdrawn collateral coin output. */
	coinOutArg: TransactionObjectArgument | undefined;
}

/**
 * API body for withdrawing the vault owner's locked liquidity.
 */
export interface ApiPerpetualsVaultOwnerWithdrawLockedLiquidityTxBody {
	/** Vault whose locked liquidity is withdrawn. */
	vaultId: ObjectId;
	/** Locked liquidity amount in the collateral coin's smallest unit. */
	amount: Balance;
	/** Minimum collateral output in the collateral coin's smallest unit. */
	minCollateralAmountOut: Balance;
	/** Optional recipient of the collateral coin. */
	recipientAddress?: SuiAddress;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
}

/**
 * Response body for vault owner withdraw-locked-liquidity transactions.
 */
export interface ApiPerpetualsVaultOwnerWithdrawLockedLiquidityTxResponse {
	/** Serialized transaction kind for the withdrawal. */
	txKind: SerializedTransaction;
	/** PTB argument for the withdrawn collateral coin output. */
	coinOutArg: TransactionObjectArgument | undefined;
}

/**
 * API body for canceling withdrawal requests across vaults for a wallet.
 */
export interface ApiPerpetualsVaultCancelWithdrawRequestTxBody {
	/** Vault containing the request to cancel. */
	vaultId: ObjectId;
	/** Wallet that owns the request. */
	walletAddress: SuiAddress;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
}

/**
 * Request body for depositing into a vault.
 *
 * Deposit can be specified as a numeric amount or as an existing coin object.
 */
export type ApiPerpetualsVaultDepositTxBody = {
	/** Vault receiving the deposit. */
	vaultId: ObjectId;
	/** Wallet depositing collateral. */
	walletAddress: SuiAddress;
	/** Minimum LP output in the LP coin's smallest unit. */
	minLpAmountOut: Balance;
	/** Optional serialized transaction kind to extend. */
	txKind?: SerializedTransaction;
	/** Whether the transaction uses sponsored gas. */
	isSponsoredTx?: boolean;
	/** Optional cached gas-pool sponsorship data. */
	sponsor?: PerpetualsSponsorConfig;
} & (
	| {
			/** Deposit amount in the collateral coin's smallest unit. */
			depositAmount: Balance;
			/** Collateral coin type for `depositAmount`. */
			collateralCoinType: CoinType;
	  }
	| {
			/** Existing collateral coin PTB argument to deposit. */
			depositCoinArg: TransactionObjectArgument;
	  }
);

/**
 * Request body for previewing a vault withdrawal request.
 */
export interface ApiPerpetualsVaultPreviewCreateWithdrawRequestBody {
	/** Vault from which LP tokens are withdrawn. */
	vaultId: ObjectId;
	/** Wallet that owns the LP tokens. */
	walletAddress: SuiAddress;
	/** LP amount to withdraw in the LP coin's smallest unit. */
	lpWithdrawAmount: Balance;
}

/**
 * Response body for vault withdrawal preview.
 */
export type ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Collateral output in the collateral coin's smallest unit. */
			collateralAmountOut: Balance;
			/** Collateral price used by the preview, in USD. */
			collateralPrice: number;
	  };

/**
 * Request body for previewing a vault owner collateral withdrawal.
 */
export interface ApiPerpetualsVaultPreviewOwnerWithdrawCollateralBody {
	/** Vault from which LP liquidity is withdrawn. */
	vaultId: ObjectId;
	/** LP amount to redeem in the LP coin's smallest unit. */
	lpWithdrawAmount: Balance;
}

/**
 * Response body for vault owner collateral withdrawal preview.
 */
export type ApiPerpetualsVaultPreviewOwnerWithdrawCollateralResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Collateral output in the collateral coin's smallest unit. */
			collateralAmountOut: Balance;
			/** Collateral price used by the preview, in USD. */
			collateralPrice: number;
	  };

/**
 * Request body for previewing a vault owner locked liquidity withdrawal.
 */
export interface ApiPerpetualsVaultPreviewOwnerWithdrawLockedLiquidityBody {
	/** Vault whose locked liquidity is withdrawn. */
	vaultId: ObjectId;
	/** Locked liquidity amount in the collateral coin's smallest unit. */
	amount: Balance;
}

/**
 * Response body for vault owner locked liquidity withdrawal preview.
 */
export type ApiPerpetualsVaultPreviewOwnerWithdrawLockedLiquidityResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Collateral output in the collateral coin's smallest unit. */
			collateralAmountOut: Balance;
			/** Collateral price used by the preview, in USD. */
			collateralPrice: number;
	  };

/**
 * Request body for previewing a vault deposit.
 */
export interface ApiPerpetualsVaultPreviewDepositBody {
	/** Vault receiving the deposit. */
	vaultId: ObjectId;
	// TODO: rename collateralDepositAmount ?
	/** Deposit amount in the collateral coin's smallest unit. */
	depositAmount: Balance;
}

/**
 * Response body for vault deposit preview.
 */
export type ApiPerpetualsVaultPreviewDepositResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** LP output in the LP coin's smallest unit. */
			lpAmountOut: Balance;
			/** Collateral price used by the preview, in USD. */
			collateralPrice: number;
			/** Deposit value converted to USD. */
			depositedAmountUsd: number;
	  };

/**
 * Request body for previewing forced withdraw processing for a vault.
 */
export interface ApiPerpetualsVaultPreviewProcessForceWithdrawRequestBody {
	/** Vault processing the force-withdraw request. */
	vaultId: ObjectId;
	/** Wallet that owns the force-withdraw request. */
	walletAddress: SuiAddress;
}

/**
 * Response body for forced withdraw processing preview.
 */
export type ApiPerpetualsVaultPreviewProcessForceWithdrawRequestResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Collateral output in the collateral coin's smallest unit. */
			collateralAmountOut: Balance;
			/** Collateral price used by the preview, in USD. */
			collateralPrice: number;
			// TODO: change to arr ?
			/** Position sizes that must be closed to process the force-withdraw request. */
			sizesToClose: Record<PerpetualsMarketId, bigint>;
			/** Estimated price impact of processing the force-withdraw request. */
			priceImpact: Percentage;
			/** Performance fees charged by the operation, denominated in USD. */
			performanceFeesChargedUsd: number;
			/** Whether the result remains within the withdrawal request's slippage tolerance. */
			isWithinWithdrawRequestSlippage: boolean;
			/** Minimum collateral amount that must be received to satisfy the request. */
			minCollateralAmountOut: Balance;
	  };

/** Request body for previewing a vault pause during force-withdraw processing. */
export interface ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestBody {
	/** Vault object ID to inspect. */
	vaultId: ObjectId;
	/** Wallet address used for the backend authorization and preview. */
	walletAddress: SuiAddress;
}

/** Response from a vault pause preview, or an error returned by the backend. */
export type ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestResponse =
	| {
			/** Backend explanation when the vault cannot be paused. */
			error: string;
	  }
	| {
			/** Whether the vault can be paused now. */
			isPausable: boolean;
			/** Earliest next pause timestamp in Unix milliseconds. */
			minNextPauseTimestamp: bigint;
	  };

/**
 * Request body for previewing normal withdraw requests processing for a vault.
 */
export interface ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsBody {
	/** Vault whose queued requests are previewed. */
	vaultId: ObjectId;
	/** Wallets whose requests are included. */
	userAddresses: SuiAddress[];
}

/**
 * Response body for previewing normal withdraw requests processing.
 */
export type ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Per-user withdrawal previews returned by the operation. */
			userPreviews: {
				userAddress: SuiAddress;
				collateralAmountOut: Balance;
			}[];
			/** Collateral asset price used by the preview. */
			collateralPrice: number;
	  };

/**
 * Request body for previewing maximum performance fees withdrawable from a vault.
 */
export interface ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesBody {
	/** Vault whose withdrawable fees are previewed. */
	vaultId: ObjectId;
}

/**
 * Response body for previewing vault performance fee withdrawal.
 */
export type ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesResponse =
	| {
			/** Error message returned when the operation cannot be completed. */
			error: string;
	  }
	| {
			/** Maximum performance-fee amount available to withdraw. */
			maxFeesToWithdraw: Balance;
			// maxFeesToWithdrawUsd: number;
			/** Coin type used to pay or receive the performance fees. */
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
	/** Optional transaction to extend with the operation. */
	tx?: Transaction;
	/** Optional stop-loss and take-profit configuration. */
	slTp?: {
		/** Optional gas coin argument used when extending the transaction. */
		gasCoinArg?: TransactionObjectArgument;
		/** Whether the transaction is sponsored rather than paid directly by the wallet. */
		isSponsoredTx?: boolean;
		/** Order size in base units. */
		size?: bigint;
		/** Stop-loss trigger price. */
		stopLossPrice?: number;
		/** Take-profit trigger price. */
		takeProfitPrice?: number;
		/**
		 * Which on-chain price the trigger uses: 0 = index (default), 1 = book, 2 = mark.
		 */
		triggerPriceType?: PerpetualsStopOrderTriggerPriceType;
		/** Optional integrator fee configuration applied when the SL/TP fires. */
		builderCode?: PerpetualsBuilderCodeParamaters;
	};
	// & (
	// 	| {
	// 			stopLossPrice: number;
	// 			takeProfitPrice: number;
	// 	  }
	// 	| {
	// 			stopLossPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitPrice: number;
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
	/** Optional transaction to extend with the operation. */
	tx?: Transaction;
	/** Optional stop-loss and take-profit configuration. */
	slTp?: {
		/** Optional gas coin argument used when extending the transaction. */
		gasCoinArg?: TransactionObjectArgument;
		/** Whether the transaction is sponsored rather than paid directly by the wallet. */
		isSponsoredTx?: boolean;
		/** Order size in base units. */
		size?: bigint;
		/** Stop-loss trigger price. */
		stopLossPrice?: number;
		/** Take-profit trigger price. */
		takeProfitPrice?: number;
		/**
		 * Which on-chain price the trigger uses: 0 = index (default), 1 = book, 2 = mark.
		 */
		triggerPriceType?: PerpetualsStopOrderTriggerPriceType;
		/** Optional integrator fee configuration applied when the SL/TP fires. */
		builderCode?: PerpetualsBuilderCodeParamaters;
	};
	// & (
	// 	| {
	// 			stopLossPrice: number;
	// 			takeProfitPrice: number;
	// 	  }
	// 	| {
	// 			stopLossPrice: number;
	// 	  }
	// 	| {
	// 			takeProfitPrice: number;
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
 * SDK-level inputs for placing a scale order from a client.
 */
export type SdkPerpetualsPlaceScaleOrderInputs = Omit<
	ApiPerpetualsScaleOrderBody,
	"accountId" | "txKind" | "walletAddress"
> & {
	/** Optional transaction to extend with the operation. */
	tx?: Transaction;
};

/**
 * SDK-level inputs for previewing a scale order.
 */
export type SdkPerpetualsPlaceScaleOrderPreviewInputs = Omit<
	ApiPerpetualsPreviewPlaceScaleOrderBody,
	"collateralCoinType" | "accountId"
>;

/**
 * SDK-level inputs for building a cancel-and-place-orders transaction.
 */
export type SdkPerpetualsCancelAndPlaceOrdersInputs = Omit<
	ApiPerpetualsCancelAndPlaceOrdersBody,
	"accountId" | "txKind" | "walletAddress"
> & {
	/** Optional transaction to extend with the operation. */
	tx?: Transaction;
};

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
	/** Market subscription discriminator and payload. */
	market: {
		/** Market object ID to subscribe to. */
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for subscribing to user/account updates,
 * optionally including special-order (stop and TWAP order) data (via
 * signature).
 */
export interface PerpetualsWsUpdatesUserSubscriptionType {
	/** User subscription discriminator and payload. */
	user: {
		/** Perpetuals account ID to subscribe to. */
		accountId: PerpetualsAccountId;
		/** Optional signed request for stop and TWAP order data. */
		withStopOrders:
			| {
					/** Wallet that signed the stop-order data request. */
					walletAddress: SuiAddress;
					/** Message bytes covered by `signature`. */
					bytes: string;
					/** Signature authorizing the request. */
					signature: string;
			  }
			| undefined;
	};
}

/**
 * Websocket subscription payload for market oracle price updates.
 */
export interface PerpetualsWsUpdatesOracleSubscriptionType {
	/** Oracle subscription discriminator and payload. */
	oracle: {
		/** Market object ID whose oracle updates are streamed. */
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for orderbook updates.
 */
export interface PerpetualsWsUpdatesOrderbookSubscriptionType {
	/** Orderbook subscription discriminator and payload. */
	orderbook: {
		/** Market object ID whose orderbook updates are streamed. */
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for market orders stream.
 */
export interface PerpetualsWsUpdatesMarketOrdersSubscriptionType {
	/** Market-order subscription discriminator and payload. */
	marketOrders: {
		/** Market object ID whose order history is streamed. */
		marketId: PerpetualsMarketId;
	};
}

/**
 * Websocket subscription payload for user-specific order updates.
 */
export interface PerpetualsWsUpdatesUserOrdersSubscriptionType {
	/** User-order subscription discriminator and payload. */
	userOrders: {
		/** Perpetuals account ID whose order history is streamed. */
		accountId: PerpetualsAccountId;
	};
}

/**
 * Websocket subscription payload for user-specific collateral changes.
 */
export interface PerpetualsWsUpdatesUserCollateralChangesSubscriptionType {
	/** User-collateral subscription discriminator and payload. */
	userCollateralChanges: {
		/** Perpetuals account ID whose collateral changes are streamed. */
		accountId: PerpetualsAccountId;
	};
}

/**
 * Websocket subscription payload for bucketed orderbook snapshots
 * (top of orderbook) for a specific market.
 */
export interface PerpetualsWsUpdatesTopOfOrderbookSubscriptionType {
	/** Top-of-orderbook subscription discriminator and payload. */
	topOfOrderbook: {
		/** Market object ID whose bucketed book is streamed. */
		marketId: PerpetualsMarketId;
		/** Price width of each orderbook bucket, in quote units. */
		priceBucketSize: number;
		/** Number of price buckets to return per side. */
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
	| PerpetualsWsUpdatesTopOfOrderbookSubscriptionType
	| PerpetualsWsUpdatesMarketCandlesSubscriptionType;

/**
 * Websocket subscription type for market candle (OHLCV) updates.
 */
export interface PerpetualsWsUpdatesMarketCandlesSubscriptionType {
	/** Market-candle subscription discriminator and payload. */
	marketCandles: {
		/** Market object ID whose candles are streamed. */
		marketId: PerpetualsMarketId;
		/** Candle interval requested from the stream. */
		interval: PerpetualsCandleResolution;
	};
}

/**
 * Websocket payload for oracle price updates.
 */
export interface PerpetualsWsUpdatesOraclePayload {
	/** Market object ID for the price update. */
	marketId: PerpetualsMarketId;
	/** Current base-asset oracle price, in quote units. */
	basePrice: number;
	/** Current collateral price, in USD. */
	collateralPrice: number;
	/**
	 * Current mark price — what positions are marked against for PnL and
	 * liquidation, as opposed to the raw index price.
	 */
	markPrice: number;
	/**
	 * Raw orderbook mid price, or `null` when either side of the book is empty.
	 * Nullable where `markPrice` is not: mark falls back to the index price
	 * upstream, whereas a raw mid has none.
	 */
	bookPrice: number | null;
}

/**
 * Websocket payload for market orders stream.
 */
export interface PerpetualsWsUpdatesMarketOrdersPayload {
	/** Market object ID for the order update. */
	marketId: PerpetualsMarketId;
	/** Market-wide order records included in this update. */
	orders: PerpetualsMarketOrderHistoryData[];
}

/**
 * Websocket payload for user-specific orders stream.
 */
export interface PerpetualsWsUpdatesUserOrdersPayload {
	/** Perpetuals account ID for the order update. */
	accountId: PerpetualsAccountId;
	/** Account order records included in this update. */
	orders: PerpetualsAccountOrderHistoryData[];
}

/**
 * Websocket payload for user-specific collateral changes.
 */
export interface PerpetualsWsUpdatesUserCollateralChangesPayload {
	/** Perpetuals account ID for the collateral update. */
	accountId: PerpetualsAccountId;
	/** Collateral changes included in this update. */
	collateralChanges: PerpetualsAccountCollateralChange[];
}

/**
 * Websocket payload for incremental orderbook updates.
 */
export interface PerpetualsWsUpdatesOrderbookPayload {
	/** Market object ID for the orderbook update. */
	marketId: PerpetualsMarketId;
	/** Incremental orderbook changes for the market. */
	orderbookDeltas: PerpetualsOrderbookDeltas;
}

/**
 * A single data point in the bucketed (top of) orderbook.
 */
export interface PerpetualsTopOfOrderbookDataPoint {
	/** Price represented by this bucket, in quote units. */
	price: number;
	/** Size at this bucket in base units. */
	size: number;
	/** Cumulative size through this bucket in base units. */
	totalSize: number;
	/** Size at this bucket valued in USD. */
	sizeUsd: number;
	/** Cumulative bucket size valued in USD. */
	totalSizeUsd: number;
}

/**
 * Bucketed orderbook state for top-of-orderbook updates.
 */
export interface PerpetualsTopOfOrderbook {
	/** Bucketed bid levels. */
	bids: PerpetualsTopOfOrderbookDataPoint[];
	/** Bucketed ask levels. */
	asks: PerpetualsTopOfOrderbookDataPoint[];
	/** Lowest ask price, or `undefined` when there are no asks. */
	minAskPrice: number | undefined;
	/** Highest bid price, or `undefined` when there are no bids. */
	maxBidPrice: number | undefined;
}

/**
 * Websocket payload for bucketed orderbook (top of orderbook) updates.
 */
export interface PerpetualsWsUpdatesTopOfOrderbookPayload {
	/** Market object ID for the bucketed book update. */
	marketId: PerpetualsMarketId;
	/** Bucketed bid levels. */
	bids: PerpetualsTopOfOrderbookDataPoint[];
	/** Bucketed ask levels. */
	asks: PerpetualsTopOfOrderbookDataPoint[];
	/** Lowest ask price, or `undefined` when there are no asks. */
	minAskPrice: number | undefined;
	/** Highest bid price, or `undefined` when there are no bids. */
	maxBidPrice: number | undefined;
}

/**
 * Websocket payload for user account and special-order (stop and TWAP order)
 * updates.
 */
export interface PerpetualsWsUpdatesUserPayload {
	/** Current account snapshot. */
	account: PerpetualsAccountObject;
	/** Stop-order records when the subscription requested them. */
	stopOrders: PerpetualsStopOrderData[] | undefined;
	/** TWAP-order records when the subscription requested them. */
	twapOrders: PerpetualsTwapOrderData[] | undefined;
}

/**
 * Websocket subscription message format sent by clients to manage
 * their subscriptions.
 */
export interface PerpetualsWsUpdatesSubscriptionMessage {
	/** Whether to add or remove the subscription. */
	action: PerpetualsWsUpdatesSubscriptionAction;
	/** Subscription discriminator and parameters. */
	subscriptionType: PerpetualsWsUpdatesSubscriptionType;
}

/**
 * Websocket response message for `/perpetuals/ws/updates`.
 *
 * Each response includes exactly one of the following discriminated unions.
 */
export type PerpetualsWsUpdatesResponseMessage =
	| {
			/** Latest market update, when present. */
			market: PerpetualsMarketData;
	  }
	| {
			/** Latest user or account update, when present. */
			user: PerpetualsWsUpdatesUserPayload;
	  }
	| {
			/** Latest oracle update, when present. */
			oracle: PerpetualsWsUpdatesOraclePayload;
	  }
	| {
			/** Latest orderbook update, when present. */
			orderbook: PerpetualsWsUpdatesOrderbookPayload;
	  }
	| {
			/** Market-order updates, when present. */
			marketOrders: PerpetualsWsUpdatesMarketOrdersPayload;
	  }
	| {
			/** User-order updates, when present. */
			userOrders: PerpetualsWsUpdatesUserOrdersPayload;
	  }
	| {
			/** User collateral-change updates, when present. */
			userCollateralChanges: PerpetualsWsUpdatesUserCollateralChangesPayload;
	  }
	| {
			/** Top-of-book update, when present. */
			topOfOrderbook: PerpetualsWsUpdatesTopOfOrderbookPayload;
	  }
	| {
			/** Market candle updates, when present. */
			marketCandles: PerpetualsWsUpdatesMarketCandlesPayload;
	  };

// /perpetuals/ws/market-candles/{market_id}/{interval_ms}

/**
 * Websocket response message carrying the last candle for a given market
 * and interval.
 */
export interface PerpetualsWsCandleResponseMessage {
	/** Market object ID for the candle stream. */
	marketId: PerpetualsMarketId;
	/** Latest candle, or `undefined` when no candle exists for the interval. */
	lastCandle: PerpetualsMarketCandleDataPoint | undefined;
}

/**
 * Websocket payload for market candle (OHLCV) updates delivered over the
 * general `/perpetuals/ws/updates` stream via a `marketCandles` subscription.
 */
export interface PerpetualsWsUpdatesMarketCandlesPayload {
	/** Market object ID for the candle update. */
	marketId: PerpetualsMarketId;
	/** Candle interval for the update. */
	interval: PerpetualsCandleResolution;
	/** Latest candle for the market and interval. */
	lastCandle: PerpetualsMarketCandleDataPoint;
}
