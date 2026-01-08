import { CoinMetadata } from "@mysten/sui/client";
import {
	Balance,
	ObjectId,
	Percentage,
} from "../../general/types/generalTypes.ts";
import { CoinGeckoCoinApiId } from "../../types.ts";

/**
 * Represents the decimal precision of a coin (e.g., 9 or 18).
 */
export type CoinDecimal = number;

/**
 * A string that uniquely identifies a coin type in the Sui network
 * (e.g., "0x2::sui::SUI").
 */
export type CoinType = string;

/**
 * Represents a short symbol or ticker for a coin (e.g., "SUI", "BTC").
 */
export type CoinSymbol = string;

/**
 * Represents a coin with an amount in integer or floating form, typically used
 * to specify a user’s holding or a transaction amount.
 */
export interface CoinWithAmount {
	/**
	 * The coin type, e.g. "0x2::sui::SUI".
	 */
	coin: CoinType;
	/**
	 * The amount of the coin, typically expressed as an integer number of smallest units.
	 */
	amount: number;
}

/**
 * Represents a coin with an amount that can be `undefined`, typically for optional or
 * deferred usage scenarios.
 */
export interface CoinWithAmountOrUndefined {
	/**
	 * The coin type, e.g. "0x2::sui::SUI".
	 */
	coin: CoinType;
	/**
	 * The amount of the coin, which can be `undefined`.
	 */
	amount: number | undefined;
}

/**
 * Represents an amount in both coin denomination and USD value for reference.
 */
export interface AmountInCoinAndUsd {
	/**
	 * The amount of the coin in smallest units.
	 */
	amount: number;
	/**
	 * The USD equivalent of that coin amount.
	 */
	amountUsd: number;
}

/**
 * Maps a coin type to a numerical balance. Typically used to store multiple
 * coin balances under their respective coin types.
 */
export type CoinsToBalance = Record<CoinType, Balance>;

/**
 * Maps a coin type to a numerical balance, which may be `undefined`.
 */
export type CoinsToBalanceOrUndefined = Record<CoinType, Balance | undefined>;

/**
 * Maps a coin type to its price, typically as a number in USD or another fiat currency.
 */
export type CoinsToPrice = Record<CoinType, number>;

/**
 * Maps a coin type to its on-chain decimal precision.
 */
export type CoinsToDecimals = Record<CoinType, CoinDecimal>;

/**
 * Maps a coin type to price information, typically containing a price and a 24-hour change.
 */
export type CoinsToPriceInfo = Record<CoinType, CoinPriceInfo>;

/**
 * Maps a coin symbol (e.g., "SUI") to its price information, typically containing a price and a 24-hour change.
 */
export type CoinSymbolsToPriceInfo = Record<CoinSymbol, CoinPriceInfo>;

/**
 * Maps a coin symbol (e.g., "SUI") to an array of possible coin types (e.g., "0x2::sui::SUI").
 */
export type CoinSymbolToCoinTypes = Record<CoinSymbol, CoinType[]>;

/**
 * Represents pricing information for a coin, including current price and 24-hour percentage change.
 */
export interface CoinPriceInfo {
	/**
	 * The current price in USD or another currency.
	 */
	price: number;
	/**
	 * The 24-hour percentage change of the coin price.
	 * @remarks 0.54 = 54%
	 */
	priceChange24HoursPercentage: Percentage;
}

/**
 * Extends the Sui `CoinMetadata` with optional properties relevant to external data
 * sources (e.g., CoinGecko).
 */
export type CoinMetadaWithInfo = CoinMetadata & {
	/**
	 * Indicates whether this coin's metadata was generated automatically.
	 */
	isGenerated?: boolean;
	/**
	 * The associated CoinGecko API ID, if available.
	 */
	coingeckoId?: CoinGeckoCoinApiId;
};

/**
 * Represents a coin reference in the Move environment, using either an on-chain ObjectId
 * or an input index or result index from a transaction.
 */
export type ServiceCoinData =
	| { Coin: ObjectId }
	| { Input: number }
	| { Result: number }
	| { NestedResult: [number, number] };

/**
 * **Legacy type** representing a coin reference in the Move environment, using
 * older transaction output indexing structures.
 */
export type ServiceCoinDataV2 =
	| "Gas"
	| { Input: number }
	| { Result: number }
	| { NestedResult: [number, number] };
