import { Balance, Percentage } from "../../general/types/generalTypes";

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type CoinDecimal = number;
export type CoinType = string;
export type CoinSymbol = string;

/////////////////////////////////////////////////////////////////////
//// Coin with Amount
/////////////////////////////////////////////////////////////////////

export type CoinWithBalance = { coin: CoinType; balance: Balance };

export interface CoinWithAmount {
	coin: CoinType;
	amount: number;
}
export interface CoinWithAmountOrUndefined {
	coin: CoinType;
	amount: number | undefined;
}

/////////////////////////////////////////////////////////////////////
//// Amounts
/////////////////////////////////////////////////////////////////////

export interface AmountInCoinAndUsd {
	amount: number;
	amountUsd: number;
}

/////////////////////////////////////////////////////////////////////
//// Coins To Data
/////////////////////////////////////////////////////////////////////

export type CoinsToBalance = Record<CoinType, Balance>;
export type CoinsToPrice = Record<CoinType, number>;
export type CoinsToDecimals = Record<CoinType, CoinDecimal>;
export type CoinsToPriceInfo = Record<CoinType, CoinPriceInfo>;
export type CoinSymbolToCoinTypes = Record<CoinSymbol, CoinType[]>;

export interface CoinPriceInfo {
	price: number;
	priceChange24HoursPercentage: Percentage;
}
