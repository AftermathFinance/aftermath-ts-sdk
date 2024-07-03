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
import { UniqueId } from "../router/routerTypes";

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
	decimals?: CoinDecimal;
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

export interface PoolLpInfo {
	lpCoinType: CoinType;
	poolId: ObjectId;
	balance: Balance;
}

export interface DaoFeePoolObject extends Object {
	feeBps: bigint;
	feeRecipient: SuiAddress;
}

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

export interface CreatedDaoFeePoolEvent extends Event {
	daoFeePoolId: ObjectId;
	innerPoolId: ObjectId;
	feeBps: bigint;
	feeRecipient: SuiAddress;
}

export interface UpdatedFeeBpsEvent extends Event {
	daoFeePoolId: ObjectId;
	oldFeeBps: bigint;
	newFeeBps: bigint;
}

export interface UpdatedFeeRecipientEvent extends Event {
	daoFeePoolId: ObjectId;
	oldFeeAddress: SuiAddress;
	newFeeAddress: SuiAddress;
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
	apr: number;
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
//  CoinGecko Integration
// =========================================================================

export interface CoinGeckoTickerData {
	ticker_id: UniqueId;
	base_currency: CoinType;
	target_currency: CoinType;
	pool_id: ObjectId;
	last_price: number;
	base_volume: number;
	target_volume: number;
	liquidity_in_usd: number;
}

export interface CoinGeckoHistoricalTradeData {
	trade_id: UniqueId;
	price: number;
	base_volume: number;
	target_volume: number;
	trade_timestamp: Timestamp;
	type: "buy" | "sell";
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
	isSponsoredTx?: boolean;
}

export interface ApiPoolDepositBody {
	walletAddress: SuiAddress;
	amountsIn: CoinsToBalance;
	slippage: Slippage;
	referrer?: SuiAddress;
	isSponsoredTx?: boolean;
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
	isSponsoredTx?: boolean;
	burnLpCoin?: boolean;
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

export interface ApiPoolsStatsBody {
	poolIds: ObjectId[];
}
