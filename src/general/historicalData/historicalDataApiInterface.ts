import { CoinType } from "../../types";
import { CoinGeckoCoinData } from "../prices/coingecko/coinGeckoTypes";
import { CoinHistoricalData } from "./historicalDataTypes";

export interface HistoricalDataApiInterface {
	fetchAllCoinData: () => Promise<Record<string, CoinGeckoCoinData>>;
	fetchHistoricalData: (inputs: {
		coinApiId: string;
		daysAgo: number;
	}) => Promise<CoinHistoricalData>;
}
