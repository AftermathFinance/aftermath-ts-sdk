import { CoinSymbol, CoinType } from "../../types";

// =========================================================================
//  Coin Gecko
// =========================================================================

// =========================================================================
//  Name Only
// =========================================================================

export type CoinGeckoCoinApiId = string;

// =========================================================================
//  Data
// =========================================================================

export interface CoinGeckoCoinData {
	apiId: CoinGeckoCoinApiId;
	name: string;
	symbol: CoinSymbol;
	coinType: CoinType;
}

export interface CoinGeckoCoinSymbolData {
	apiId: CoinGeckoCoinApiId;
	name: string;
	symbol: CoinSymbol;
}
