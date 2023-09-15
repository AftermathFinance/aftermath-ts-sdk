import {
	Balance,
	Event,
	Object,
	ObjectId,
	Slippage,
	SuiAddress,
	Timestamp,
	Url,
} from "../../general/types/generalTypes";
import { ManipulateType } from "dayjs";
import { CoinDecimal, CoinsToBalance, CoinType } from "../coin/coinTypes";
import { RouterSerializablePool } from "../router/routerTypes";

// TODO: create LpCoinType ?

// =========================================================================
//  Name Only
// =========================================================================

export type PoolName = string;
export type PoolWeight = bigint;
export type PoolTradeFee = bigint;
export type PoolDepositFee = bigint;
export type PoolWithdrawFee = bigint;
export type PoolFlatness = bigint;
export type NormalizedBalance = bigint;
export type DecimalsScalar = bigint;

// =========================================================================
//  Objects
// =========================================================================

export type PoolCoins = Record<CoinType, PoolCoin>;

export interface PoolCoin {
	weight: PoolWeight;
	balance: Balance;
	tradeFeeIn: PoolTradeFee;
	tradeFeeOut: PoolTradeFee;
	depositFee: PoolDepositFee;
	withdrawFee: PoolWithdrawFee;
	decimalsScalar: DecimalsScalar;
	normalizedBalance: NormalizedBalance;
}

export interface PoolObject extends Object {
	name: PoolName;
	creator: SuiAddress;
	lpCoinType: CoinType;
	lpCoinSupply: Balance;
	illiquidLpCoinSupply: Balance;
	flatness: PoolFlatness;
	coins: PoolCoins;
	lpCoinDecimals: CoinDecimal;
}

export const isPoolObject = (
	pool: RouterSerializablePool
): pool is PoolObject => {
	return (
		"name" in pool &&
		"creator" in pool &&
		"lpCoinType" in pool &&
		"lpCoinSupply" in pool &&
		"illiquidLpCoinSupply" in pool &&
		"flatness" in pool &&
		"coins" in pool
	);
};

// =========================================================================
//  Events
// =========================================================================

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

// =========================================================================
//  Stats
// =========================================================================

export interface PoolStats {
	volume: number;
	tvl: number;
	supplyPerLps: number[];
	lpPrice: number;
	fees: number;
	apy: number;
}

export interface PoolDataPoint {
	time: Timestamp;
	value: number;
}

// export type PoolGraphDataTimeframeKey = "1D" | "1W" | "1M" | "3M";
export type PoolGraphDataTimeframeKey = "1D";
export interface PoolGraphDataTimeframe {
	time: Timestamp;
	timeUnit: ManipulateType;
}

// =========================================================================
//  Pool Creation
// =========================================================================

export interface PoolCreationCoinInfo {
	coinType: CoinType;
	weight: PoolWeight;
	decimals?: CoinDecimal;
	tradeFeeIn: PoolTradeFee;
	tradeFeeOut: PoolTradeFee;
	depositFee: PoolDepositFee;
	withdrawFee: PoolWithdrawFee;
	initialDeposit: Balance;
}

export interface PoolCreationLpCoinMetadata {
	name: string;
	symbol: string;
	iconUrl?: Url;
}

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Transactions
// =========================================================================

export interface ApiPoolTradeBody {
	walletAddress: SuiAddress;
	coinInType: CoinType;
	coinInAmount: Balance;
	coinOutType: CoinType;
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

export interface ApiPoolAllCoinWithdrawBody {
	walletAddress: SuiAddress;
	lpCoinAmount: Balance;
	referrer?: SuiAddress;
}

export interface ApiPublishLpCoinBody {
	walletAddress: SuiAddress;
	lpCoinDecimals: CoinDecimal;
}

export interface ApiCreatePoolBody {
	walletAddress: SuiAddress;
	lpCoinType: CoinType;
	lpCoinMetadata: PoolCreationLpCoinMetadata;
	coinsInfo: {
		coinType: CoinType;
		weight: number;
		decimals?: CoinDecimal;
		tradeFeeIn: number;
		initialDeposit: Balance;
	}[];
	poolName: PoolName;
	poolFlatness: 0 | 1;
	createPoolCapId: ObjectId;
	respectDecimals: boolean;
	forceLpDecimals?: CoinDecimal;
}

// =========================================================================
//  Inspections
// =========================================================================

export interface ApiPoolSpotPriceBody {
	coinInType: CoinType;
	coinOutType: CoinType;
}

export interface ApiPoolObjectIdForLpCoinTypeBody {
	lpCoinType: CoinType;
}
