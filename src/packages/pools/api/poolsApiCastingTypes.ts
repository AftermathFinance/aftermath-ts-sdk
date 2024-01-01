import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	CoinType,
	PoolName,
	ObjectId,
	SuiAddress,
} from "../../../types";
import {
	EventOnChain,
	IndexerEventOnChain,
	SupplyOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface PoolFieldsOnChain {
	name: PoolName;
	creator: SuiAddress;
	lp_supply: SupplyOnChain;
	illiquid_lp_supply: BigIntAsString;
	type_names: CoinType[];
	normalized_balances: BigIntAsString[];
	weights: BigIntAsString[];
	flatness: BigIntAsString;
	fees_swap_in: BigIntAsString[];
	fees_swap_out: BigIntAsString[];
	fees_deposit: BigIntAsString[];
	fees_withdraw: BigIntAsString[];
	decimal_scalars: BigIntAsString[];
	// coin_decimals: Option<vector<u8>>
	lp_decimals: BigIntAsString;
	lp_decimal_scalar: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type PoolCreateEventOnChain = EventOnChain<
	{
		pool_id: ObjectId;
		lp_type: CoinType; // TODO: make seperate LpCoinType ?
	} & PoolFieldsOnChain
>;

export type PoolSpotPriceEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	base_type: CoinType;
	quote_type: CoinType;
	spot_price: BigIntAsString;
}>;

// =========================================================================
//  Event Fields
// =========================================================================

export interface PoolTradeEventOnChainFields {
	pool_id: ObjectId;
	issuer: SuiAddress;
	types_in: CoinType[];
	amounts_in: BigIntAsString[];
	types_out: CoinType[];
	amounts_out: BigIntAsString[];
}

export interface PoolDepositEventFieldsOnChain {
	pool_id: ObjectId;
	issuer: SuiAddress;
	types: CoinType[];
	deposits: BigIntAsString[];
	lp_coins_minted: BigIntAsString;
}

export interface PoolWithdrawEventFieldsOnChain {
	pool_id: ObjectId;
	issuer: SuiAddress;
	types: CoinType[];
	withdrawn: BigIntAsString[];
	lp_coins_burned: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type PoolTradeEventOnChain = EventOnChain<PoolTradeEventOnChainFields>;

export type PoolDepositEventOnChain =
	EventOnChain<PoolDepositEventFieldsOnChain>;

export type PoolWithdrawEventOnChain =
	EventOnChain<PoolWithdrawEventFieldsOnChain>;

