import { ObjectId, SuiAddress } from "@mysten/sui.js/dist/types";
import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	CoinType,
	PoolName,
} from "../../../types";
import {
	EventOnChain,
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

export type PoolTradeEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	issuer: SuiAddress;
	types_in: CoinType[];
	amounts_in: Balance[];
	types_out: CoinType[];
	amounts_out: Balance[];
}>;

export type PoolDepositEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	issuer: SuiAddress;
	types: CoinType[];
	deposits: Balance[];
	lp_coins_minted: Balance;
}>;

export type PoolWithdrawEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	issuer: SuiAddress;
	types: CoinType[];
	withdrawn: Balance[];
	lp_coins_burned: Balance;
}>;

export type PoolSpotPriceEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	base_type: CoinType;
	quote_type: CoinType;
	spot_price: BigIntAsString;
}>;
