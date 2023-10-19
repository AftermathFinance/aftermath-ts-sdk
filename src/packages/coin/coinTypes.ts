import { CoinMetadata } from "@mysten/sui.js/client";
import { Balance, Percentage } from "../../general/types/generalTypes";
import { OracleCoinSymbol } from "../oracle/oracleTypes";

// =========================================================================
//  Name Only
// =========================================================================

export type CoinDecimal = number;
export type CoinType = string;
export type CoinSymbol = string;

// =========================================================================
//  Coin with Amount
// =========================================================================

export interface CoinWithAmount {
	coin: CoinType;
	amount: number;
}

export interface CoinWithAmountOrUndefined {
	coin: CoinType;
	amount: number | undefined;
}

// =========================================================================
//  Amounts
// =========================================================================

export interface AmountInCoinAndUsd {
	amount: number;
	amountUsd: number;
}

// =========================================================================
//  Coins To Data
// =========================================================================

export type CoinsToBalance = Record<CoinType, Balance>;
export type CoinsToPrice = Record<CoinType, number>;
export type CoinsToDecimals = Record<CoinType, CoinDecimal>;
export type CoinsToPriceInfo = Record<CoinType, CoinPriceInfo>;
export type CoinSymbolsToPriceInfo = Record<OracleCoinSymbol, CoinPriceInfo>;
export type CoinSymbolToCoinTypes = Record<CoinSymbol, CoinType[]>;

export interface CoinPriceInfo {
	price: number;
	priceChange24HoursPercentage: Percentage;
}

// =========================================================================
//  Coin Metadata Extension
// =========================================================================

export type CoinMetadaWithInfo = CoinMetadata & {
	isGenerated?: boolean;
};
