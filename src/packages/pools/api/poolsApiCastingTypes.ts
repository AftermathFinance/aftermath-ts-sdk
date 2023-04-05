import { ObjectId, SuiAddress } from "@mysten/sui.js/dist/types";
import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	CoinType,
	EventOnChain,
	PoolName,
	SupplyOnChain,
	TableOnChain,
} from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface PoolFieldsOnChain {
	name: PoolName;
	creator: SuiAddress;
	lp_supply: SupplyOnChain;
	illiquid_lp_supply: BigIntAsString;
	type_names: CoinType[];
	balances: BigIntAsString[];
	weights: BigIntAsString[];
	flatness: BigIntAsString;
	fees_swap_in: BigIntAsString[];
	fees_swap_out: BigIntAsString[];
	fees_deposit: BigIntAsString[];
	fees_withdraw: BigIntAsString[];
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export type PoolCreateEventOnChain = EventOnChain<
	{
		pool_id: ObjectId;
		lp_type: CoinType; // TODO: make seperate LpCoinType ?
	} & PoolFieldsOnChain
>;

export type PoolTradeEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	issuer: SuiAddress;
	type_in: CoinType;
	value_in: Balance;
	type_out: CoinType;
	value_out: Balance;
}>;

export type PoolSingleDepositEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	issuer: SuiAddress;
	type: CoinType;
	value: Balance;
	lp_coins_minted: Balance;
}>;

export type PoolDepositEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	issuer: SuiAddress;
	types: CoinType[];
	deposits: Balance[];
	lp_coins_minted: Balance;
}>;

export type PoolSingleWithdrawEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	issuer: SuiAddress;
	type: CoinType;
	value: Balance;
	lp_coins_burned: Balance;
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
