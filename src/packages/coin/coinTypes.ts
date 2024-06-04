import { CoinMetadata } from "@mysten/sui/client";
import {
	Balance,
	ObjectId,
	Percentage,
} from "../../general/types/generalTypes";

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
export type CoinsToBalanceOrUndefined = Record<CoinType, Balance | undefined>;
export type CoinsToPrice = Record<CoinType, number>;
export type CoinsToDecimals = Record<CoinType, CoinDecimal>;
export type CoinsToPriceInfo = Record<CoinType, CoinPriceInfo>;
export type CoinSymbolsToPriceInfo = Record<CoinSymbol, CoinPriceInfo>;
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

// =========================================================================
//  Services
// =========================================================================

export type ServiceCoinData =
	| { Coin: ObjectId }
	| { Input: number }
	| { Result: number }
	| { NestedResult: [number, number] };

// export type CoinTransactionObjectArgument =
// 	| {
// 			$kind: "Input";
// 			Input: number;
// 			type?: "object" | undefined;
// 	  }
// 	| {
// 			$kind: "Result";
// 			Result: number;
// 	  }
// 	| {
// 			$kind: "NestedResult";
// 			NestedResult: [number, number];
// 	  }
// 	| {
// 			kind: "Input";
// 			index: number;
// 	  }
// 	| {
// 			kind: "NestedResult";
// 			index: number;
// 			resultIndex: number;
// 	  }
// 	| {
// 			kind: "Result";
// 			index: number;
// 	  };
