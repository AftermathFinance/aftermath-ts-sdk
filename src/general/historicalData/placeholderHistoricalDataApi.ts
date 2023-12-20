import { HistoricalDataApiInterface } from "./historicalDataApiInterface";
import { CoinHistoricalData } from "./historicalDataTypes";

export class PlaceholderHistoricalDataApi
	implements HistoricalDataApiInterface
{
	public fetchAllSuiCoinData = async () => {
		return {};
	};

	public fetchAllCoinData = async () => {
		return {};
	};

	public fetchHistoricalData = async (inputs: {
		coinApiId: string;
		daysAgo: number;
	}): Promise<CoinHistoricalData> => {
		throw new Error("no placeholder historical data");
	};
}
