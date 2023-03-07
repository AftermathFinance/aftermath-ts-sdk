import { SignableTransaction } from "@mysten/sui.js";
import { Balance, Event, Timestamp } from "../../general/types/generalTypes";
import { ObjectId, SuiAddress } from "@mysten/sui.js/dist/types";
import { ManipulateType } from "dayjs";
import { CoinsToBalance, CoinType } from "../coin/coinTypes";

// TODO: create LpCoinType ?

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type PoolName = string;
export type PoolWeight = bigint;
export type PoolSwapFee = bigint;

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
	swapFee: PoolSwapFee;
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

export type IndicesPoolVolumeDataTimeframeKey = "1D" | "1W" | "1M" | "3M";
export interface IndicesPoolVolumeDataTimeframe {
	time: Timestamp;
	timeUnit: ManipulateType;
}

/////////////////////////////////////////////////////////////////////
//// Router
/////////////////////////////////////////////////////////////////////

export interface IndicesRouterPath {
	pool: PoolObject;
	baseAsset: CoinType;
	quoteAsset: CoinType;
	weight: number;
}

export interface IndicesRouterSwapPathInfo {
	spotPrice: number;
	paths: IndicesRouterPath[];
}

export type IndicesRouterSwapPathInfoWithTransactions =
	IndicesRouterSwapPathInfo & {
		transactions: SignableTransaction[];
	};

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiPoolSpotPriceBody {
	coinInType: CoinType;
	coinOutType: CoinType;
}

export interface ApiPoolSwapAmountOutBody {
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

export interface ApiPoolSwapBody {
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
			path: IndicesRouterPath;
	  }
	| {
			path: IndicesRouterPath;
			fromCoinId: ObjectId;
	  };
