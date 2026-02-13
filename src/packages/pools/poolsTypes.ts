import {
	Balance,
	Event,
	Object,
	ObjectId,
	Percentage,
	Slippage,
	SuiAddress,
	Timestamp,
	Url,
} from "../../general/types/generalTypes.ts";
import { ManipulateType } from "dayjs";
import { CoinDecimal, CoinsToBalance, CoinType } from "../coin/coinTypes.ts";
import { UniqueId } from "../router/routerTypes.ts";

/**
 * Name or label used to identify a pool. e.g., "My Stable Pool" or "SUI-COIN LP".
 */
export type PoolName = string;

/**
 * Represents a coin's weight in a weighted pool, stored as a bigint for
 * 1e9 or 1e18 style scaling.
 */
export type PoolWeight = bigint;

/**
 * Represents the trade fee for a coin in the pool, stored as a bigint
 * in a scaled format (e.g. 1 = 1e9).
 */
export type PoolTradeFee = bigint;

/**
 * Represents the deposit fee for a coin in the pool, stored as a bigint
 * in a scaled format.
 */
export type PoolDepositFee = bigint;

/**
 * Represents the withdrawal fee for a coin in the pool, stored as a bigint
 * in a scaled format.
 */
export type PoolWithdrawFee = bigint;

/**
 * Represents "flatness" in a pool, used for certain advanced pool calculations
 * or invariants. Often 0 or 1, depending on stable vs. uncorrelated logic.
 */
export type PoolFlatness = bigint;

/**
 * Represents a normalized balance in the pool, often used for
 * internal calculations to standardize coin decimals.
 */
export type NormalizedBalance = bigint;

/**
 * A big integer scalar used for decimals conversion (1e9 or 1e18, etc.).
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
	 * The coin's weight in the pool (e.g., for a weight-based AMM).
	 */
	weight: PoolWeight;
	/**
	 * The on-chain balance of this coin in the pool.
	 */
	balance: Balance;
	/**
	 * The inbound trade fee (scaled) for this coin.
	 */
	tradeFeeIn: PoolTradeFee;
	/**
	 * The outbound trade fee (scaled) for this coin.
	 */
	tradeFeeOut: PoolTradeFee;
	/**
	 * The deposit fee (scaled) for adding this coin into the pool.
	 */
	depositFee: PoolDepositFee;
	/**
	 * The withdrawal fee (scaled) for removing this coin from the pool.
	 */
	withdrawFee: PoolWithdrawFee;
	/**
	 * A scaling factor (like 1e9 or 1e18) used to unify coin decimals
	 * for internal math.
	 */
	decimalsScalar: DecimalsScalar;
	/**
	 * The "normalized" balance, factoring in `decimalsScalar`.
	 */
	normalizedBalance: NormalizedBalance;
	/**
	 * The displayed decimals for user-facing reference (e.g., 6, 9, 18).
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
	 * The total supply of LP tokens currently minted.
	 */
	lpCoinSupply: Balance;
	/**
	 * The amount of LP tokens that are illiquid (locked for some reason).
	 */
	illiquidLpCoinSupply: Balance;
	/**
	 * A "flatness" parameter used for stable vs. uncorrelated logic. 0 or 1 typically.
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
	 * An optional DAO fee object, if the pool is configured to support a fee for a DAO or treasury.
	 */
	daoFeePoolObject?: DaoFeePoolObject;
}

/**
 * Minimal information about a user's LP coin in a specific pool,
 * including the pool ID and balance of that LP coin type.
 */
export interface PoolLpInfo {
	lpCoinType: CoinType;
	poolId: ObjectId;
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
	poolId: ObjectId;
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
	daoFeePoolId: ObjectId;
	innerPoolId: ObjectId;
	feeBps: bigint;
	feeRecipient: SuiAddress;
}

/**
 * Fired when the fee basis points in a `DaoFeePoolObject` are updated.
 */
export interface UpdatedFeeBpsEvent extends Event {
	daoFeePoolId: ObjectId;
	oldFeeBps: bigint;
	newFeeBps: bigint;
}

/**
 * Fired when the fee recipient address in a `DaoFeePoolObject` changes.
 */
export interface UpdatedFeeRecipientEvent extends Event {
	daoFeePoolId: ObjectId;
	oldFeeAddress: SuiAddress;
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
 * Represents a data point for pool analytics, including a Unix timestamp (in ms)
 * and a numeric value (e.g., volume or fee data).
 */
export interface PoolDataPoint {
	time: Timestamp;
	value: number;
}

/**
 * Supported timeframes for graphing or fetching historical data:
 * 1 day, 1 week, 1 month, 3 months, 6 months, or 1 year.
 */
export type PoolGraphDataTimeframeKey = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";

/**
 * An optional object or approach to define timeframe windows, using
 * dayjs manipulation. Not always used directly.
 */
export interface PoolGraphDataTimeframe {
	time: Timestamp;
	timeUnit: ManipulateType;
}

// =========================================================================
//  Pool Creation
// =========================================================================

/**
 * An object describing how each coin in a newly created pool is configured,
 * including initial deposit, weight, and fees.
 */
export interface PoolCreationCoinInfo {
	coinType: CoinType;
	weight: PoolWeight;
	decimals?: CoinDecimal;
	tradeFeeIn: PoolTradeFee;
	tradeFeeOut: PoolTradeFee;
	depositFee: PoolDepositFee;
	withdrawFee: PoolWithdrawFee;
	initialDeposit: Balance;
}

/**
 * Metadata for the newly published LP coin, specifying name, symbol, and optional icon URL.
 */
export interface PoolCreationLpCoinMetadata {
	name: string;
	symbol: string;
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
	ticker_id: UniqueId;
	base_currency: CoinType;
	target_currency: CoinType;
	pool_id: ObjectId;
	last_price: number;
	base_volume: number;
	target_volume: number;
	liquidity_in_usd: number;
}

/**
 * Represents a historical trade record for integration with CoinGecko,
 * storing a trade ID, price, volumes, timestamp, and buy/sell type.
 */
export interface CoinGeckoHistoricalTradeData {
	trade_id: UniqueId;
	price: number;
	base_volume: number;
	target_volume: number;
	trade_timestamp: Timestamp;
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
	walletAddress: SuiAddress;
	coinInType: CoinType;
	coinInAmount: Balance;
	coinOutType: CoinType;
	slippage: Slippage;
	referrer?: SuiAddress;
	isSponsoredTx?: boolean;
}

/**
 * Request body for depositing liquidity into a pool, specifying the amounts in,
 * slippage, and optional referral or sponsorship data.
 */
export interface ApiPoolDepositBody {
	walletAddress: SuiAddress;
	amountsIn: CoinsToBalance;
	slippage: Slippage;
	referrer?: SuiAddress;
	isSponsoredTx?: boolean;
}

/**
 * Request body for withdrawing specific amounts from the pool, specifying
 * which coins to remove, how much LP is burned, slippage, etc.
 */
export interface ApiPoolWithdrawBody {
	walletAddress: SuiAddress;
	amountsOutDirection: CoinsToBalance;
	lpCoinAmount: Balance;
	slippage: Slippage;
	referrer?: SuiAddress;
}

/**
 * Request body for withdrawing all coin types from a pool using a single
 * ratio or entire LP amount, simplifying the multi-coin approach.
 */
export interface ApiPoolAllCoinWithdrawBody {
	walletAddress: SuiAddress;
	lpCoinAmount: Balance;
	referrer?: SuiAddress;
}

/**
 * Request body for publishing a new LP coin on-chain,
 * typically specifying the coin's decimals.
 */
export interface ApiPublishLpCoinBody {
	walletAddress: SuiAddress;
	lpCoinDecimals: number;
}

/**
 * Request body for creating a new pool, specifying coin information,
 * the LP coin metadata, and optional DAO fee info.
 */
export interface ApiCreatePoolBody {
	walletAddress: SuiAddress;
	lpCoinType: CoinType;
	lpCoinMetadata: PoolCreationLpCoinMetadata;
	coinsInfo: {
		coinType: CoinType;
		weight: Percentage;
		decimals?: number;
		tradeFeeIn: Percentage;
		initialDeposit: Balance;
	}[];
	poolName: PoolName;
	poolFlatness: 0 | 1;
	createPoolCapId: ObjectId;
	respectDecimals: boolean;
	forceLpDecimals?: CoinDecimal;
	isSponsoredTx?: boolean;
	burnLpCoin?: boolean;
	daoFeeInfo?: {
		feePercentage: Percentage;
		feeRecipient: SuiAddress;
	};
}

/**
 * For retrieving the spot price of a pool, specifying coin in/out.
 * Not always used directly, but present in certain route building contexts.
 */
export interface ApiPoolSpotPriceBody {
	coinInType: CoinType;
	coinOutType: CoinType;
}

/**
 * Request body for obtaining a pool object ID from an LP coin type.
 * Useful to confirm if a coin is indeed an LP token and which pool it references.
 */
export interface ApiPoolObjectIdForLpCoinTypeBody {
	lpCoinTypes: CoinType[];
}

/**
 * Request body for fetching statistics about one or more pools.
 */
export interface ApiPoolsStatsBody {
	poolIds: ObjectId[];
}

/**
 * Request body for listing the owned DAO fee pool owner caps,
 * letting a user see if they can update fees/recipients in certain pools.
 */
export interface ApiPoolsOwnedDaoFeePoolOwnerCapsBody {
	walletAddress: SuiAddress;
}
