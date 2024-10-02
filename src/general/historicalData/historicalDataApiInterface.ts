import { CoinSymbol, CoinType } from "../../types";
import {
	CoinGeckoChain,
	CoinGeckoCoinData,
	CoinGeckoCoinSymbolData,
} from "../prices/coingecko/coinGeckoTypes";
import { CoinHistoricalData } from "./historicalDataTypes";

export interface HistoricalDataApiInterface {
	// fetchAllSuiCoinData: () => Promise<Record<CoinType, CoinGeckoCoinData>>;

	fetchAllCoinDataForChains: (inputs: {
		chains: CoinGeckoChain[];
	}) => Promise<
		Partial<
			Record<
				"ethereum" | "arbitrum" | "bsc" | "solana" | "sui",
				Record<CoinType, CoinGeckoCoinData>
			>
		>
	>;

	fetchAllCoinData: () => Promise<
		Record<CoinSymbol, CoinGeckoCoinSymbolData>
	>;

	fetchHistoricalData: (inputs: {
		coinApiId: string;
		daysAgo: number;
	}) => Promise<CoinHistoricalData>;
}
