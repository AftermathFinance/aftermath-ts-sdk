import type {
	BytesOnChain,
	EventOnChain,
	SupplyOnChain,
} from "../../../general/types/castingTypes";
import type {
	BigIntAsString,
	CoinType,
	ObjectId,
	PoolName,
	SuiAddress,
} from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

/** Raw fields of an on-chain `Pool<L>` object before conversion to SDK types. */
export interface PoolFieldsOnChain {
	/** The pool name stored on chain. */
	name: PoolName;
	/** The address that created the pool. */
	creator: SuiAddress;
	/** The LP supply wrapper returned by the object API. */
	lp_supply: SupplyOnChain;
	/** The illiquid LP supply as a decimal string. */
	illiquid_lp_supply: BigIntAsString;
	/** Coin type names in the order used by every parallel vector. */
	type_names: CoinType[];
	/** Normalized coin balances as decimal strings. */
	normalized_balances: BigIntAsString[];
	/** Fixed-point coin weights as decimal strings. */
	weights: BigIntAsString[];
	/** The fixed-point flatness parameter as a decimal string. */
	flatness: BigIntAsString;
	/** Fixed-point fees charged when each coin enters a swap. */
	fees_swap_in: BigIntAsString[];
	/** Fixed-point fees charged when each coin leaves a swap. */
	fees_swap_out: BigIntAsString[];
	/** Fixed-point fees charged when each coin enters a deposit. */
	fees_deposit: BigIntAsString[];
	/** Fixed-point fees charged when each coin leaves a withdrawal. */
	fees_withdraw: BigIntAsString[];
	/** Decimal-normalization scalars for the parallel coin vectors. */
	decimal_scalars: BigIntAsString[];
	/** LP coin decimal precision as a decimal string. */
	lp_decimals: BigIntAsString;
	/** Fixed-point scalar associated with the LP coin decimals. */
	lp_decimal_scalar: BigIntAsString;
	/** Optional byte-encoded coin decimal precisions. */
	coin_decimals?: BytesOnChain;
}

/** Raw fields of an on-chain DAO fee pool object. */
export interface DaoFeePoolFieldsOnChain {
	/** The DAO fee in basis points as a decimal string. */
	fee_bps: BigIntAsString;
	/** The address that receives the DAO fee. */
	fee_recipient: SuiAddress;
}

/** Raw fields of the capability that controls a DAO fee pool. */
export interface DaoFeePoolOwnerCapFieldsOnChain {
	/** The capability object's own ID. */
	id: ObjectId;
	/** The DAO fee pool controlled by the capability. */
	dao_fee_pool_id: ObjectId;
}

// =========================================================================
//  Events
// =========================================================================

/** Raw pool-creation event fields, including the newly created pool state. */
export type PoolCreateEventOnChain = EventOnChain<
	{
		/** The newly created pool object ID. */
		pool_id: ObjectId;
		/** The LP coin type parameter of the created pool. */
		lp_type: CoinType; // TODO: make seperate LpCoinType ?
	} & PoolFieldsOnChain
>;

/** Raw spot-price event fields emitted by the pool package. */
export type PoolSpotPriceEventOnChain = EventOnChain<{
	/** The pool object ID whose price was reported. */
	pool_id: ObjectId;
	/** The base coin type in the reported pair. */
	base_type: CoinType;
	/** The quote coin type in the reported pair. */
	quote_type: CoinType;
	/** The fixed-point spot price as a decimal string. */
	spot_price: BigIntAsString;
}>;

// =========================================================================
//  Event Fields
// =========================================================================

/** Parsed fields of a pool swap event before bigint and address casting. */
export interface PoolTradeEventOnChainFields {
	/** The pool object ID where the swap occurred. */
	pool_id: ObjectId;
	/** The swap issuer address. */
	issuer: SuiAddress;
	/** Input coin types, in the same order as `amounts_in`. */
	types_in: CoinType[];
	/** Input amounts as decimal strings in each coin's smallest unit. */
	amounts_in: BigIntAsString[];
	/** Output coin types, in the same order as `amounts_out`. */
	types_out: CoinType[];
	/** Output amounts as decimal strings in each coin's smallest unit. */
	amounts_out: BigIntAsString[];
}

/** Parsed fields of a pool liquidity-deposit event. */
export interface PoolDepositEventFieldsOnChain {
	/** The pool object ID receiving the deposit. */
	pool_id: ObjectId;
	/** The depositing address. */
	issuer: SuiAddress;
	/** Deposited coin types, in the same order as `deposits`. */
	types: CoinType[];
	/** Deposited amounts as decimal strings in smallest units. */
	deposits: BigIntAsString[];
	/** Minted LP amount as a decimal string in LP smallest units. */
	lp_coins_minted: BigIntAsString;
}

/** Parsed fields of a pool liquidity-withdrawal event. */
export interface PoolWithdrawEventFieldsOnChain {
	/** The pool object ID from which liquidity was withdrawn. */
	pool_id: ObjectId;
	/** The withdrawing address. */
	issuer: SuiAddress;
	/** Withdrawn coin types, in the same order as `withdrawn`. */
	types: CoinType[];
	/** Withdrawn amounts as decimal strings in smallest units. */
	withdrawn: BigIntAsString[];
	/** Burned LP amount as a decimal string in LP smallest units. */
	lp_coins_burned: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

/** A complete raw pool swap event, including indexer metadata. */
export type PoolTradeEventOnChain = EventOnChain<PoolTradeEventOnChainFields>;

/** A complete raw pool deposit event, including indexer metadata. */
export type PoolDepositEventOnChain =
	EventOnChain<PoolDepositEventFieldsOnChain>;

/** A complete raw pool withdrawal event, including indexer metadata. */
export type PoolWithdrawEventOnChain =
	EventOnChain<PoolWithdrawEventFieldsOnChain>;
