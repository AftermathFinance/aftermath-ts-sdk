import {
	Balance,
	Event,
	Object,
	ObjectId,
	Slippage,
	SuiAddress,
} from "../../general/types/generalTypes";
import { CoinDecimal, CoinsToBalance, CoinType } from "../coin/coinTypes";
import { PoolName } from "../pools/poolsTypes";

/**
 * A record mapping `CoinType` => a `PoolCoin` structure, describing
 * each coin's weight, balance, fees, and decimal scaling within a pool.
 */
export type OraclePoolCoins = Record<CoinType, OraclePoolCoin>;

/**
 * Details about a coin in the pool, including the on-chain balance,
 * trade fees (in/out), deposit/withdraw fees, and decimal scaling factors.
 */
export interface OraclePoolCoin {
	/**
	 * The on-chain balance of this coin in the pool.
	 */
	balance: Balance;
	/**
	 * The displayed decimals for user-facing reference (e.g., 6, 9, 18).
	 */
	decimals: CoinDecimal;
	depositCap: Balance;
	minPriority: Balance;
	maxPriority: Balance;
	flashLoanFee: Balance;
}

export interface OraclePoolFeePair extends Object {
	coinInType: CoinType;
	coinOutType: CoinType;
	minFeeBps: bigint;
	maxFeeBps: bigint;
	targetFeeBps: bigint;
}

/**
 * The primary pool object structure stored on-chain.
 * `lpCoinType` is the minted LP token, `coins` is a record of coin data.
 */
export interface OraclePoolObject extends Object {
	/**
	 * The human-readable name of the pool (e.g., "My Weighted Pool").
	 */
	// TODO: add name ?
	name: PoolName;
	/**
	 * The address of the pool's creator.
	 */
	// TODO: add creator ?
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
	 * A record of coin data for each coin type in the pool.
	 */
	coins: OraclePoolCoins;
	/**
	 * The decimals used by the LP coin.
	 */
	lpCoinDecimals: CoinDecimal;
	feePairs: OraclePoolFeePair[];
}

// =========================================================================
//  Events
// =========================================================================

/**
 * Represents a trade event within a pool, indicating coins in/out,
 * final amounts, etc.
 */
export interface OraclePoolTradeEvent extends Event {
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
export interface OraclePoolDepositEvent extends Event {
	oraclePoolId: ObjectId;
	/**
	 * The address that deposited into the pool.
	 */
	depositor: SuiAddress;
	/**
	 * The coin type that was deposited.
	 */
	coinInType: CoinType;
	/**
	 * The amount for the deposited coin type.
	 */
	coinInAmount: Balance;
	/**
	 * The amount of LP minted for the depositor.
	 */
	lpCoinAmountMinted: Balance;
	// TODO: add exchange rates ?
}

/**
 * Represents a withdrawal event where a user removes liquidity from a pool,
 * burning LP tokens and receiving coin amounts in return.
 */
export interface OraclePoolWithdrawEvent extends Event {
	oraclePoolId: ObjectId;
	/**
	 * The user who withdrew from the pool.
	 */
	withdrawer: SuiAddress;
	/**
	 * The coin type that was returned upon withdrawal.
	 */
	coinOutType: CoinType;
	/**
	 * The amount for the returned coin type.
	 */
	coinOutAmount: Balance;
	/**
	 * The amount of LP burned in exchange for these outputs.
	 */
	lpCoinAmountBurned: Balance;
	coinOutFee: Balance;
	// TODO: add exchange rates ?
}

// =========================================================================
//  API
// =========================================================================

/**
 * Request body for a user trade, specifying which coin to send in and how much,
 * which coin to receive, plus slippage and optional referral info.
 */
export interface ApiOraclePoolTradeBody {
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
export interface ApiOraclePoolDepositBody {
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
export interface ApiOraclePoolWithdrawBody {
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
export interface ApiOraclePoolAllCoinWithdrawBody {
	walletAddress: SuiAddress;
	lpCoinAmount: Balance;
	referrer?: SuiAddress;
}

/**
 * For retrieving the spot price of a pool, specifying coin in/out.
 * Not always used directly, but present in certain route building contexts.
 */
export interface ApiOraclePoolSpotPriceBody {
	coinInType: CoinType;
	coinOutType: CoinType;
}

/**
 * Request body for obtaining a pool object ID from an LP coin type.
 * Useful to confirm if a coin is indeed an LP token and which pool it references.
 */
export interface ApiOraclePoolObjectIdForLpCoinTypeBody {
	lpCoinTypes: CoinType[];
}

/**
 * Request body for fetching statistics about one or more pools.
 */
export interface ApiOraclePoolsStatsBody {
	poolIds: ObjectId[];
}
