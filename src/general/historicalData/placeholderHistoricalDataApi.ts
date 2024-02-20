import { CoinSymbol, CoinType } from "../../types";
import {
	CoinGeckoCoinData,
	CoinGeckoCoinSymbolData,
} from "../prices/coingecko/coinGeckoTypes";
import { HistoricalDataApiInterface } from "./historicalDataApiInterface";
import { CoinHistoricalData } from "./historicalDataTypes";

export class PlaceholderHistoricalDataApi
	implements HistoricalDataApiInterface
{
	public fetchAllSuiCoinData = async (): Promise<
		Record<CoinType, CoinGeckoCoinData>
	> => {
		return {};
	};

	public fetchAllCoinData = async (): Promise<
		Record<CoinType, CoinGeckoCoinData>
	> => {
		return {};
	};

	public fetchHistoricalData = async (inputs: {
		coinApiId: string;
		daysAgo: number;
	}): Promise<CoinHistoricalData> => {
		throw new Error("no placeholder historical data");
	};
}
