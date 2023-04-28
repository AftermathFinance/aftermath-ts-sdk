import {
	Balance,
	Event,
	Object,
	SerializedTransaction,
	Slippage,
	Timestamp,
	Url,
} from "../../general/types/generalTypes";
import { ObjectId, SuiAddress } from "@mysten/sui.js/dist/types";
import { ManipulateType } from "dayjs";
import { CoinsToBalance, CoinType } from "../coin/coinTypes";
import { TransactionArgument } from "@mysten/sui.js";

// TODO: create LpCoinType ?

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type PoolName = string;
export type PoolWeight = bigint;
export type PoolTradeFee = bigint;
export type PoolDepositFee = bigint;
export type PoolWithdrawFee = bigint;
export type PoolFlatness = bigint;

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export type PoolCoins = Record<CoinType, PoolCoin>;

export interface PoolCoin {
	weight: PoolWeight;
	balance: Balance;
	tradeFeeIn: PoolTradeFee;
	tradeFeeOut: PoolTradeFee;
	depositFee: PoolDepositFee;
	withdrawFee: PoolWithdrawFee;
}

export interface PoolObject extends Object {
	name: PoolName;
	creator: SuiAddress;
	lpCoinType: CoinType;
	lpCoinSupply: Balance;
	illiquidLpCoinSupply: Balance;
	flatness: PoolFlatness;
	coins: PoolCoins;
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export interface PoolTradeEvent extends Event {
	poolId: ObjectId;
	trader: SuiAddress;
	typesIn: CoinType[];
	amountsIn: Balance[];
	typesOut: CoinType[];
	amountsOut: Balance[];
}

export interface PoolDepositEvent extends Event {
	poolId: ObjectId;
	depositor: SuiAddress;
	types: CoinType[];
	deposits: Balance[];
	lpMinted: Balance;
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

export interface PoolDataPoint {
	time: Timestamp;
	value: number;
}

export type PoolVolumeDataTimeframeKey = "1D" | "1W" | "1M" | "3M";
export interface PoolVolumeDataTimeframe {
	time: Timestamp;
	timeUnit: ManipulateType;
}

/////////////////////////////////////////////////////////////////////
//// Pool Creation
/////////////////////////////////////////////////////////////////////

export interface PoolCreationCoinInfo {
	coinId: ObjectId | TransactionArgument;
	coinType: CoinType;
	weight: PoolWeight;
	tradeFeeIn: PoolTradeFee;
	tradeFeeOut: PoolTradeFee;
	depositFee: PoolDepositFee;
	withdrawFee: PoolWithdrawFee;
}

export interface PoolCreationLpCoinMetadata {
	name: string;
	symbol: string;
	description: string;
	iconUrl: Url;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiPoolTradeBody {
	walletAddress: SuiAddress;
	coinIn: CoinType;
	coinInAmount: Balance;
	coinOut: CoinType;
	slippage: Slippage;
	referrer?: SuiAddress;
}

export interface ApiPoolDepositBody {
	walletAddress: SuiAddress;
	amountsIn: CoinsToBalance;
	slippage: Slippage;
	referrer?: SuiAddress;
}

export interface ApiPoolWithdrawBody {
	walletAddress: SuiAddress;
	amountsOutDirection: CoinsToBalance;
	lpCoinAmount: Balance;
	slippage: Slippage;
	referrer?: SuiAddress;
}

export interface ApiPoolSpotPriceBody {
	coinInType: CoinType;
	coinOutType: CoinType;
}

export interface ApiPoolObjectIdForLpCoinTypeBody {
	lpCoinType: CoinType;
}

export interface ApiPublishLpCoinBody {
	walletAddress: SuiAddress;
}

export interface ApiCreatePoolBody {
	walletAddress: SuiAddress;
	lpCoinType: CoinType;
	lpCoinMetadata: PoolCreationLpCoinMetadata;
	coinsInfo: {
		coinId: ObjectId;
		coinType: CoinType;
		weight: number;
		tradeFeeIn: number;
	}[];
	poolName: PoolName;
	poolFlatness: 0 | 1;
	createPoolCapId?: ObjectId;
}
