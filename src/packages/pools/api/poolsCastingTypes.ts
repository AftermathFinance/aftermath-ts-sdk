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
	fields: {
		coins: CoinType[];
		creator: SuiAddress;
		pool_id: ObjectId;
		weights: BigIntAsString[];
		swap_fee: BigIntAsString;
		lp_type: CoinType; // TODO: make seperate LpCoinType ?
		name: string;
		curve_type: PoolCurveType;
	};
	bcs: string;
}

export type PoolSwapEventOnChain = EventOnChain<{
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

export interface PoolDynamicFieldOnChain {
	data: {
		fields: any;
		type: AnyObjectType;
	};
}

export interface PoolLpDynamicFieldOnChain {
	data: {
		fields: {
			id: {
				id: ObjectId;
			};
			value: {
				fields: {
					value: BigIntAsString;
				};
			};
		};
	};
}

export interface PoolBalanceDynamicFieldOnChain {
	data: {
		fields: {
			id: {
				id: ObjectId;
			};
			value: BigIntAsString;
			name: {
				type: KeyType;
			};
		};
	};
}

export interface PoolAmountDynamicFieldOnChain {
	data: {
		fields: {
			id: {
				id: ObjectId;
			};
			value: BigIntAsString;
			name: {
				fields: {
					type_name: CoinType;
				};
			};
		};
	};
}
