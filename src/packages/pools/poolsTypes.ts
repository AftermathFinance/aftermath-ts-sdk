import { Balance, Event, Timestamp } from "../../general/types/generalTypes";
import { ObjectId, SuiAddress } from "@mysten/sui.js/dist/types";
import { ManipulateType } from "dayjs";
import { CoinsToBalance, CoinType } from "../coin/coinTypes";
import { RouterPath } from "../router/routerTypes";

// TODO: create LpCoinType ?

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type PoolName = string;
export type PoolWeight = bigint;
export type PoolTradeFee = bigint;

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface PoolCompleteObject {
	pool: PoolObject;
	dynamicFields: PoolDynamicFields;
}

export interface PoolObject {
	objectId: ObjectId;
	fields: PoolFields;
}

export enum PoolCurveType {
	Uncorrelated = 0,
}

export interface PoolFields {
	name: PoolName;
	creator: SuiAddress;
	coins: CoinType[];
	weights: PoolWeight[];
	tradeFee: PoolTradeFee;
	lpType: CoinType;
	curveType: PoolCurveType;
}

/////////////////////////////////////////////////////////////////////
//// Dynamic Fields
/////////////////////////////////////////////////////////////////////

export interface PoolLpDynamicField {
	objectId: ObjectId;
	value: Balance;
}

export interface PoolBalanceDynamicField {
	objectId: ObjectId;
	coin: CoinType;
	value: Balance;
}

export interface PoolAmountDynamicField {
	objectId: ObjectId;
	coin: CoinType;
	value: Balance;
}

export interface PoolDynamicFields {
	lpFields: PoolLpDynamicField[];
	amountFields: PoolAmountDynamicField[];
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export interface PoolTradeEvent extends Event {
	poolId: ObjectId;
	trader: SuiAddress;
	typeIn: CoinType;
	amountIn: Balance;
	typeOut: CoinType;
	amountOut: Balance;
}

export interface PoolSingleDepositEvent extends Event {
	poolId: ObjectId;
	depositor: SuiAddress;
	type: CoinType;
	amount: Balance;
	lpMinted: Balance;
}

export interface PoolDepositEvent extends Event {
	poolId: ObjectId;
	depositor: SuiAddress;
	types: CoinType[];
	deposits: Balance[];
	lpMinted: Balance;
}

export interface PoolSingleWithdrawEvent extends Event {
	poolId: ObjectId;
	withdrawer: SuiAddress;
	type: CoinType;
	amount: Balance;
	lpBurned: Balance;
}

export interface PoolWithdrawEvent extends Event {
	poolId: ObjectId;
	withdrawer: SuiAddress;
	types: CoinType[];
	withdrawn: Balance[];
	lpBurned: Balance;
}

/////////////////////////////////////////////////////////////////////
//// Stats
/////////////////////////////////////////////////////////////////////

export interface PoolStats {
	volume: number;
	tvl: number;
	supplyPerLps: number[];
	lpPrice: number;
	fees: number;
	aprRange: [number, number];
}

export interface IndicesPoolDataPoint {
	time: Timestamp;
	value: number;
}

export type PoolVolumeDataTimeframeKey = "1D" | "1W" | "1M" | "3M";
export interface PoolVolumeDataTimeframe {
	time: Timestamp;
	timeUnit: ManipulateType;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiPoolSpotPriceBody {
	coinInType: CoinType;
	coinOutType: CoinType;
}

export interface ApiPoolTradeAmountOutBody {
	coinInType: CoinType;
	coinInAmount: Balance;
	coinOutType: CoinType;
}

export interface ApiPoolDepositLpMintAmountBody {
	depositCoinAmounts: CoinsToBalance;
}

export interface ApiPoolDepositBody {
	walletAddress: SuiAddress;
	depositCoinAmounts: CoinsToBalance;
}

export interface ApiPoolWithdrawBody {
	walletAddress: SuiAddress;
	withdrawCoinAmounts: CoinsToBalance;
	withdrawLpTotal: Balance;
}

export interface ApiPoolTradeBody {
	walletAddress: SuiAddress;
	fromCoin: CoinType;
	fromCoinAmount: Balance;
	toCoin: CoinType;
}

export interface ApiTradeBody {
	walletAddress: SuiAddress;
	fromCoin: CoinType;
	fromCoinAmount: Balance;
	toCoin: CoinType;
}

export interface ApiTradeInfoBody {
	fromCoin: CoinType;
	toCoin: CoinType;
}

export type ApiTradeTransactionsBody =
	| {
			walletAddress: SuiAddress;
			fromCoinAmount: Balance;
			path: RouterPath;
	  }
	| {
			path: RouterPath;
			fromCoinId: ObjectId;
	  };
