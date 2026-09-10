import type {
	Balance,
	Event,
	Object,
	ObjectId,
	Percentage,
	Slippage,
	SuiAddress,
	Timestamp,
	Url,
} from "../../general/types/generalTypes";
import type { CoinDecimal, CoinsToBalance, CoinType } from "../coin/coinTypes";
import type { UniqueId } from "../router/routerTypes";

/**
 * Name or label used to identify a pool. e.g., "My Stable Pool" or "SUI-COIN LP".
 */
export type PoolName = string;

/**
 * A pool weight encoded as an on-chain fixed-point integer.
 *
 * `1_000_000_000_000_000_000n` represents `1`. Weights in one pool sum to
 * that value.
 */
export type PoolWeight = bigint;

/**
 * A swap fee encoded as an on-chain fixed-point integer.
 *
 * `1_000_000_000_000_000_000n` represents a 100% fee. The value is stored in
 * the coin metadata and applies to swaps entering or leaving that coin.
 */
export type PoolTradeFee = bigint;

/**
 * A deposit fee encoded as an on-chain fixed-point integer.
 *
 * `1_000_000_000_000_000_000n` represents a 100% fee.
 */
export type PoolDepositFee = bigint;

/**
 * A withdrawal fee encoded as an on-chain fixed-point integer.
 *
 * `1_000_000_000_000_000_000n` represents a 100% fee.
 */
export type PoolWithdrawFee = bigint;

/**
 * The pool's stable-curve flatness parameter in on-chain fixed-point form.
 *
 * `0n` selects the product-style curve and `1_000_000_000_000_000_000n`
 * selects the linear-style curve. The value affects the invariant and every
 * local swap, deposit, and withdrawal estimate.
 */
export type PoolFlatness = bigint;

/**
 * A pool balance scaled by its coin's `decimalsScalar` for AMM calculations.
 * This is not the spendable coin balance. Use `PoolCoin.balance` for the
 * smallest-unit balance returned to callers.
 */
export type NormalizedBalance = bigint;

/**
 * The integer scalar used to normalize a coin's decimals in the AMM math.
 *
 * For example, a coin with 9 decimals commonly uses
 * `1_000_000_000_000_000_000n` as its fixed-point scalar.
 */
export type DecimalsScalar = bigint;

/**
 * A record mapping `CoinType` => a `PoolCoin` structure, describing
 * each coin's weight, balance, fees, and decimal scaling within a pool.
 */
export type PoolCoins = Record<CoinType, PoolCoin>;

/**
 * Details about a coin in the pool, including the on-chain balance,
 * trade fees (in/out), deposit/withdraw fees, and decimal scaling factors.
 */
export interface PoolCoin {
	/**
	 * The coin's fixed-point weight. Divide by `1e18` to read the decimal
	 * fraction used by the invariant.
	 */
	weight: PoolWeight;
	/**
	 * The coin balance in the smallest on-chain unit, such as `1_000_000_000n`
	 * for one 9-decimal coin.
	 */
	balance: Balance;
	/**
	 * The fixed-point fee applied when a swap sends this coin into the pool.
	 */
	tradeFeeIn: PoolTradeFee;
	/**
	 * The fixed-point fee applied when a swap sends this coin out of the pool.
	 */
	tradeFeeOut: PoolTradeFee;
	/**
	 * The fixed-point fee applied when a liquidity deposit adds this coin.
	 */
	depositFee: PoolDepositFee;
	/**
	 * The fixed-point fee applied when a liquidity withdrawal removes this coin.
	 */
	withdrawFee: PoolWithdrawFee;
	/**
	 * The scalar that converts `balance` into `normalizedBalance` for the
	 * invariant calculation.
	 */
	decimalsScalar: DecimalsScalar;
	/**
	 * The normalized balance consumed by the local AMM math.
	 */
	normalizedBalance: NormalizedBalance;
	/**
	 * The coin's display precision. It is absent when the API did not return
	 * coin metadata for this pool.
	 */
	decimals?: CoinDecimal;
}

/**
 * The primary pool object structure stored on-chain.
 * `lpCoinType` is the minted LP token, `coins` is a record of coin data.
 */
export interface PoolObject extends Object {
	/**
	 * The human-readable name of the pool (e.g., "My Weighted Pool").
	 */
	name: PoolName;
	/**
	 * The address of the pool's creator.
	 */
	creator: SuiAddress;
	/**
	 * The LP coin type for this pool, e.g., "0x<...>::af_lp::AF_LP_xyz".
	 */
	lpCoinType: CoinType;
	/**
	 * The total LP supply in the LP coin's smallest unit.
	 */
	lpCoinSupply: Balance;
	/**
	 * The LP supply that cannot be withdrawn as liquid liquidity.
	 */
	illiquidLpCoinSupply: Balance;
	/**
	 * The fixed-point curve parameter used by the pool invariant.
	 */
	flatness: PoolFlatness;
	/**
	 * A record of coin data for each coin type in the pool.
	 */
	coins: PoolCoins;
	/**
	 * The decimals used by the LP coin.
	 */
	lpCoinDecimals: CoinDecimal;
	/**
	 * The optional DAO fee configuration layered around this pool.
	 */
	daoFeePoolObject?: DaoFeePoolObject;
}

/**
 * Minimal information about a user's LP coin in a specific pool,
 * including the pool ID and balance of that LP coin type.
 */
export interface PoolLpInfo {
	/** The LP coin type held for the position. */
	lpCoinType: CoinType;
	/** The pool object ID that the LP coin represents. */
	poolId: ObjectId;
	/** The LP balance in the LP coin's smallest unit. */
	balance: Balance;
}

/**
 * An on-chain object representing DAO fee configuration for a pool:
 * it stores the fee basis points and the fee recipient address.
 */
export interface DaoFeePoolObject extends Object {
	/**
	 * The fee in basis points, e.g., 100 => 1%.
	 */
	feeBps: bigint;
	/**
	 * The Sui address receiving the fee portion from trades or other actions.
	 */
	feeRecipient: SuiAddress;
}

/**
 * A capability object indicating ownership of a `DaoFeePoolObject`.
 * Whomever holds this can update the fee parameters or recipient.
 */
export interface DaoFeePoolOwnerCapObject extends Object {
	/**
	 * The `DaoFeePoolObject` ID this cap is associated with.
	 */
	daoFeePoolId: ObjectId;
}

// =========================================================================
//  Events
// =========================================================================

/**
 * Represents a trade event within a pool, indicating coins in/out,
 * final amounts, etc.
 */
export interface PoolTradeEvent extends Event {
	/** The pool object ID in which the swap occurred. */
	poolId: ObjectId;
	/** The address that submitted the swap. */
	trader: SuiAddress;
	/**
	 * The array of coin types that were spent in the trade.
	 */
	typesIn: CoinType[];
	/**
	 * The amounts of each coin type that were spent.
	 */
	amountsIn: Balance[];
	/**
	 * The coin types that were received.
	 */
	typesOut: CoinType[];
	/**
	 * The amounts of each output coin.
	 */
	amountsOut: Balance[];
}

/**
 * Represents a deposit event where a user adds liquidity to a pool,
 * receiving minted LP tokens in return.
 */
export interface PoolDepositEvent extends Event {
	/** The pool object ID receiving the deposit. */
	poolId: ObjectId;
	/**
	 * The address that deposited into the pool.
	 */
	depositor: SuiAddress;
	/**
	 * The coin types that were deposited.
	 */
	types: CoinType[];
	/**
	 * The amounts for each deposited coin type.
	 */
	deposits: Balance[];
	/**
	 * The amount of LP minted for the depositor.
	 */
	lpMinted: Balance;
}

/**
 * Represents a withdrawal event where a user removes liquidity from a pool,
 * burning LP tokens and receiving coin amounts in return.
 */
export interface PoolWithdrawEvent extends Event {
	/** The pool object ID from which liquidity was withdrawn. */
	poolId: ObjectId;
	/**
	 * The user who withdrew from the pool.
	 */
	withdrawer: SuiAddress;
	/**
	 * The coin types that were returned upon withdrawal.
	 */
	types: CoinType[];
	/**
	 * The amounts for each returned coin type.
	 */
	withdrawn: Balance[];
	/**
	 * The amount of LP burned in exchange for these outputs.
	 */
	lpBurned: Balance;
}

/**
 * Fired when a new DAO fee pool is created for a specific internal pool.
 */
export interface CreatedDaoFeePoolEvent extends Event {
	/** The newly created DAO fee pool object ID. */
	daoFeePoolId: ObjectId;
	/** The underlying Aftermath pool object ID. */
	innerPoolId: ObjectId;
	/** The DAO fee in basis points. `100` represents 1%. */
	feeBps: bigint;
	/** The Sui address that receives the DAO fee. */
	feeRecipient: SuiAddress;
}

/**
 * Fired when the fee basis points in a `DaoFeePoolObject` are updated.
 */
export interface UpdatedFeeBpsEvent extends Event {
	/** The DAO fee pool object ID whose fee changed. */
	daoFeePoolId: ObjectId;
	/** The previous fee in basis points. */
	oldFeeBps: bigint;
	/** The new fee in basis points. */
	newFeeBps: bigint;
}

/**
 * Fired when the fee recipient address in a `DaoFeePoolObject` changes.
 */
export interface UpdatedFeeRecipientEvent extends Event {
	/** The DAO fee pool object ID whose recipient changed. */
	daoFeePoolId: ObjectId;
	/** The previous recipient address. */
	oldFeeAddress: SuiAddress;
	/** The new recipient address. */
	newFeeAddress: SuiAddress;
}

// =========================================================================
//  Stats
// =========================================================================

/**
 * Basic statistical data about a pool, including volume, TVL, supply per LPS,
 * fees, and APR.
 */
export interface PoolStats {
	/**
	 * The 24-hour volume or some aggregated volume metric for the pool.
	 */
	volume: number;
	/**
	 * The total value locked in the pool, often in USD or stablecoin value.
	 */
	tvl: number;
	/**
	 * A representation of the distribution of supply among liquidity providers,
	 * e.g., how many tokens each user holds. May be used for advanced UI.
	 */
	supplyPerLps: number[];
	/**
	 * The price of 1 LP token in reference to a stable baseline (USD).
	 */
	lpPrice: number;
	/**
	 * The total fees generated by the pool in a given period (often 24h or 7d).
	 */
	fees: number;
	/**
	 * The approximate annual percentage rate (yield) derived from fees, volume, or
	 * other data. This can be used to estimate LP profits or compare pools.
	 */
	apr: number;
}

/**
 * Represents a pool object together with the analytics returned by the pool
 * summary endpoint.
 */
export interface PoolSummary {
	/** The pool object returned by the API. */
	pool: PoolObject;
	/** The current analytics for `pool`. */
	stats: PoolStats;
}

/**
 * Represents a data point for pool analytics, including a Unix timestamp (in ms)
 * and a numeric value (e.g., volume or fee data).
 */
export interface PoolDataPoint {
	/** The timestamp supplied by the analytics API. */
	time: Timestamp;
	/** The metric value at `time`. */
	value: number;
}

/**
 * Supported timeframes for graphing or fetching historical data:
 * 1 day, 1 week, 1 month, 3 months, 6 months, or 1 year.
 */
export type PoolGraphDataTimeframeKey = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";

/**
 * Unit of time used to describe a timeframe window (e.g. "day", "week").
 *
 * Mirrors dayjs's `ManipulateType` surface (long, plural, and short forms)
 * so consumers upgrading from pre-2.0 keep compiling.
 */
export type PoolGraphDataTimeUnit =
	// long forms
	| "millisecond"
	| "second"
	| "minute"
	| "hour"
	| "day"
	| "week"
	| "month"
	| "year"
	// plurals
	| "milliseconds"
	| "seconds"
	| "minutes"
	| "hours"
	| "days"
	| "weeks"
	| "months"
	| "years"
	// short forms
	| "ms"
	| "s"
	| "m"
	| "h"
	| "d"
	| "D"
	| "M"
	| "y"
	| "w";

/**
 * An optional object or approach to define timeframe windows.
 * Not always used directly.
 */
export interface PoolGraphDataTimeframe {
	/** The size of the window expressed by `timeUnit`. */
	time: Timestamp;
	/** The unit used with `time`. */
	timeUnit: PoolGraphDataTimeUnit;
}

// =========================================================================
//  Pool Creation
// =========================================================================

/**
 * An object describing how each coin in a newly created pool is configured,
 * including initial deposit, weight, and fees.
 */
export interface PoolCreationCoinInfo {
	/** The Sui coin type deposited into the new pool. */
	coinType: CoinType;
	/** The on-chain fixed-point weight assigned to the coin. */
	weight: PoolWeight;
	/** The coin's decimal precision, when the pool stores decimal metadata. */
	decimals?: CoinDecimal;
	/** The fixed-point fee for swaps that receive this coin. */
	tradeFeeIn: PoolTradeFee;
	/** The fixed-point fee for swaps that pay this coin. */
	tradeFeeOut: PoolTradeFee;
	/** The fixed-point fee for deposits of this coin. */
	depositFee: PoolDepositFee;
	/** The fixed-point fee for withdrawals of this coin. */
	withdrawFee: PoolWithdrawFee;
	/** The initial deposit in the coin's smallest unit. */
	initialDeposit: Balance;
}

/**
 * Metadata for the newly published LP coin, specifying name, symbol, and optional icon URL.
 */
export interface PoolCreationLpCoinMetadata {
	/** The display name for the newly published LP coin. */
	name: string;
	/** The ticker symbol for the newly published LP coin. */
	symbol: string;
	/** An optional URL for the LP coin icon. */
	iconUrl?: Url;
}

// =========================================================================
//  CoinGecko Integration
// =========================================================================

/**
 * A data structure used for integration with CoinGecko, representing
 * an aggregated ticker ID, base/target coins, price, volumes, and liquidity.
 */
export interface CoinGeckoTickerData {
	/** The ticker identifier used by the CoinGecko integration. */
	ticker_id: UniqueId;
	/** The base coin type in the market pair. */
	base_currency: CoinType;
	/** The quote coin type in the market pair. */
	target_currency: CoinType;
	/** The pool object ID supplying the market data. */
	pool_id: ObjectId;
	/** The latest base-to-target price returned by the integration. */
	last_price: number;
	/** The base-coin volume returned by the integration. */
	base_volume: number;
	/** The target-coin volume returned by the integration. */
	target_volume: number;
	/** The liquidity value returned by the integration. */
	liquidity_in_usd: number;
}

/**
 * Represents a historical trade record for integration with CoinGecko,
 * storing a trade ID, price, volumes, timestamp, and buy/sell type.
 */
export interface CoinGeckoHistoricalTradeData {
	/** The trade identifier used by the CoinGecko integration. */
	trade_id: UniqueId;
	/** The executed base-to-target price. */
	price: number;
	/** The base-coin amount in the trade. */
	base_volume: number;
	/** The target-coin amount in the trade. */
	target_volume: number;
	/** The trade timestamp returned by the integration. */
	trade_timestamp: Timestamp;
	/** Whether the trade bought or sold the base currency. */
	type: "buy" | "sell";
}

// =========================================================================
//  API
// =========================================================================

/**
 * Request body for a user trade, specifying which coin to send in and how much,
 * which coin to receive, plus slippage and optional referral info.
 */
export interface ApiPoolTradeBody {
	/** The wallet that owns the input coins and receives the output coin. */
	walletAddress: SuiAddress;
	/** The input coin's fully qualified Sui type. */
	coinInType: CoinType;
	/** The input amount in the input coin's smallest unit. */
	coinInAmount: Balance;
	/** The output coin's fully qualified Sui type. */
	coinOutType: CoinType;
	/** The maximum decimal fraction of output loss accepted by the transaction. `0.01` is 1%. */
	slippage: Slippage;
	/** An optional referrer address used to register the referral in the transaction. */
	referrer?: SuiAddress;
	/** Whether the coin-selection request is prepared for a sponsored transaction. */
	isSponsoredTx?: boolean;
}

/**
 * Request body for depositing liquidity into a pool, specifying the amounts in,
 * slippage, and optional referral or sponsorship data.
 */
export interface ApiPoolDepositBody {
	/** The wallet that owns the deposit coins and receives the LP coin. */
	walletAddress: SuiAddress;
	/** Input amounts keyed by coin type, each in that coin's smallest unit. */
	amountsIn: CoinsToBalance;
	/** The maximum change in the expected LP result accepted by the transaction. `0.01` is 1%. */
	slippage: Slippage;
	/** An optional referrer address used to register the referral in the transaction. */
	referrer?: SuiAddress;
	/** Whether coin selection is prepared for a sponsored transaction. */
	isSponsoredTx?: boolean;
}

/**
 * Request body for withdrawing specific amounts from the pool, specifying
 * which coins to remove, how much LP is burned, slippage, etc.
 */
export interface ApiPoolWithdrawBody {
	/** The wallet that owns the LP coins and receives the withdrawn coins. */
	walletAddress: SuiAddress;
	/** Non-zero entries describe the relative output direction for each coin type. */
	amountsOutDirection: CoinsToBalance;
	/** The LP amount to burn, in the LP coin's smallest unit. */
	lpCoinAmount: Balance;
	/** The maximum output shortfall accepted by the transaction. `0.01` is 1%. */
	slippage: Slippage;
	/** An optional referrer address used to register the referral in the transaction. */
	referrer?: SuiAddress;
}

/**
 * Request body for withdrawing all coin types from a pool using a single
 * ratio or entire LP amount, simplifying the multi-coin approach.
 */
export interface ApiPoolAllCoinWithdrawBody {
	/** The wallet that owns the LP coins and receives every pool coin. */
	walletAddress: SuiAddress;
	/** The LP amount to burn, in the LP coin's smallest unit. */
	lpCoinAmount: Balance;
	/** An optional referrer address used to register the referral in the transaction. */
	referrer?: SuiAddress;
}

/**
 * Request body for publishing a new LP coin on-chain,
 * typically specifying the coin's decimals.
 */
export interface ApiPublishLpCoinBody {
	/** The wallet that publishes and receives the LP coin package upgrade cap. */
	walletAddress: SuiAddress;
	/** The decimal precision compiled into the LP coin package. */
	lpCoinDecimals: number;
}

/**
 * Request body for creating a new pool, specifying coin information,
 * the LP coin metadata, and optional DAO fee info.
 */
export interface ApiCreatePoolBody {
	/** The wallet that owns the pool-creation capability and initial coins. */
	walletAddress: SuiAddress;
	/** The fully qualified LP coin type used by the new pool. */
	lpCoinType: CoinType;
	/** Metadata for the LP coin published for the pool. */
	lpCoinMetadata: PoolCreationLpCoinMetadata;
	/** Per-coin weights, fees, decimal metadata, and initial deposits. */
	coinsInfo: {
		/** The fully qualified coin type deposited into the pool. */
		coinType: CoinType;
		/** The decimal weight for this coin. Weights must sum to `1`. */
		weight: Percentage;
		/** Optional display precision stored for this coin. */
		decimals?: number;
		/** The decimal fraction charged when this coin enters a swap. */
		tradeFeeIn: Percentage;
		/** The initial amount in the coin's smallest unit. */
		initialDeposit: Balance;
	}[];
	/** The display name assigned to the pool object. */
	poolName: PoolName;
	/** The pool curve mode passed to Move as a flatness value. */
	poolFlatness: 0 | 1;
	/** The capability object that authorizes pool creation. */
	createPoolCapId: ObjectId;
	/** Whether the transaction should preserve the supplied coin decimals. */
	respectDecimals: boolean;
	/** Optional decimal precision forced for the LP coin. */
	forceLpDecimals?: CoinDecimal;
	/** Whether coin selection is prepared for a sponsored transaction. */
	isSponsoredTx?: boolean;
	/** Whether the LP coin is burned as part of the creation flow. */
	burnLpCoin?: boolean;
	/** Optional DAO fee configuration for the new pool. */
	daoFeeInfo?: {
		/** The DAO fee as a decimal fraction. `0.01` is 1%. */
		feePercentage: Percentage;
		/** The Sui address that receives the DAO fee. */
		feeRecipient: SuiAddress;
	};
}

/**
 * For retrieving the spot price of a pool, specifying coin in/out.
 * Not always used directly, but present in certain route building contexts.
 */
export interface ApiPoolSpotPriceBody {
	/** The coin type used as the price input. */
	coinInType: CoinType;
	/** The coin type used as the price output. */
	coinOutType: CoinType;
}

/**
 * Request body for obtaining a pool object ID from an LP coin type.
 * Useful to confirm if a coin is indeed an LP token and which pool it references.
 */
export interface ApiPoolObjectIdForLpCoinTypeBody {
	/** LP coin types to resolve. The response preserves this order. */
	lpCoinTypes: CoinType[];
	/** Zero-based input offset. */
	cursor?: number;
	/** Maximum number of mappings to return, capped at 32. */
	limit?: number;
}

/**
 * Request body for fetching statistics about one or more pools.
 */
export interface ApiPoolsStatsBody {
	/** Pool object IDs whose analytics should be returned, in response order. */
	poolIds: ObjectId[];
	/** Zero-based input offset. */
	cursor?: number;
	/** Maximum number of statistics to return, capped at 32. */
	limit?: number;
}

/**
 * Request body for fetching pool objects and statistics in one response.
 */
export interface ApiPoolsSummaryBody {
	/** Optional pool IDs to include. Omit the field to request all summaries. */
	poolIds?: ObjectId[];
	/** Zero-based result offset. */
	cursor?: number;
	/** Maximum summaries to return: 32 for explicit IDs or 256 for the catalogue. */
	limit?: number;
}

/**
 * Request body for listing the owned DAO fee pool owner caps,
 * letting a user see if they can update fees/recipients in certain pools.
 */
export interface ApiPoolsOwnedDaoFeePoolOwnerCapsBody {
	/** The wallet whose owned DAO fee capabilities should be indexed. */
	walletAddress: SuiAddress;
}
