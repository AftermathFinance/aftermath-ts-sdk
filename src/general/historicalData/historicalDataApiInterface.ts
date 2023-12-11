import { CoinSymbol, CoinType } from "../../types";
import {
	CoinGeckoCoinData,
	CoinGeckoCoinSymbolData,
} from "../prices/coingecko/coinGeckoTypes";
import { CoinHistoricalData } from "./historicalDataTypes";

export interface HistoricalDataApiInterface {
	fetchAllSuiCoinData: () => Promise<Record<CoinType, CoinGeckoCoinData>>;

	fetchAllCoinData: () => Promise<
		Record<CoinSymbol, CoinGeckoCoinSymbolData>
	>;

	fetchHistoricalData: (inputs: {
		coinApiId: string;
		daysAgo: number;
	}) => Promise<CoinHistoricalData>;
}
