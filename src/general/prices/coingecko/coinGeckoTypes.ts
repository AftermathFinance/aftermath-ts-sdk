import { CoinSymbol, CoinType, Percentage } from "../../../types";

// =========================================================================
//  Coin Gecko
// =========================================================================

// TODO: add all supported chains
export type CoinGeckoChain = "sui" | "ethereum";

// =========================================================================
//  Name Only
// =========================================================================

export type CoinGeckoCoinApiId = string;

// =========================================================================
//  Data
// =========================================================================

export interface CoinGeckoCoinData {
	chain: CoinGeckoChain | "";
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
