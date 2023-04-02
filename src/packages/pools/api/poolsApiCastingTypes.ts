import { ObjectId, SuiAddress } from "@mysten/sui.js/dist/types";
import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	CoinType,
	EventOnChain,
	KeyType,
} from "../../../types";
import { PoolCurveType } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface PoolFieldsOnChain {
	creator: SuiAddress;
	name: string;
	swap_fee: BigIntAsString;
	type_names: CoinType[];
	weights: BigIntAsString[];
	lp_type: CoinType;
	curve_type: PoolCurveType;
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

// TODO: update this type to match same pattern as those below
export interface PoolCreateEventOnChain {
	packageId: ObjectId;
	transactionModule: string;
	sender: SuiAddress;
	type: string;
	parsedJson: {
		coins: CoinType[];
		creator: SuiAddress;
		pool_id: ObjectId;
		weights: BigIntAsString[];
		swap_fee: BigIntAsString;
		lp_type: CoinType; // TODO: make seperate LpCoinType ?
		name: string;
		curve_type: PoolCurveType;
	};
}

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

export interface PoolSpotPriceEventOnChain {
	fields: {
		spot_price: BigIntAsString;
	};
}

/////////////////////////////////////////////////////////////////////
//// Dynamic Fields
/////////////////////////////////////////////////////////////////////

export interface PoolDynamicFieldOnChain<FieldsType> {
	data: {
		fields: FieldsType;
		type: AnyObjectType;
	};
}

export type PoolLpDynamicFieldOnChain = PoolDynamicFieldOnChain<{
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: BigIntAsString;
		};
	};
}>;

export type PoolBalanceDynamicFieldOnChain = PoolDynamicFieldOnChain<{
	id: {
		id: ObjectId;
	};
	value: BigIntAsString;
	name: {
		type: KeyType;
	};
}>;

export type PoolAmountDynamicFieldOnChain = PoolDynamicFieldOnChain<{
	id: {
		id: ObjectId;
	};
	value: BigIntAsString;
	name: {
		fields: {
			type_name: CoinType;
		};
	};
}>;
