import { CoinSymbol, CoinType } from "../../types";
import {
	CoinGeckoChain,
	CoinGeckoCoinData,
	CoinGeckoCoinSymbolData,
} from "../prices/coingecko/coinGeckoTypes";
import { HistoricalDataApiInterface } from "./historicalDataApiInterface";
import { CoinHistoricalData } from "./historicalDataTypes";

export class PlaceholderHistoricalDataApi
	implements HistoricalDataApiInterface
{
	// public fetchAllSuiCoinData = async (): Promise<
	// 	Record<CoinType, CoinGeckoCoinData>
	// > => {
	// 	return {};
	// };

	public fetchAllCoinDataForChains = async (inputs: {
		chains: CoinGeckoChain[];
	}): Promise<
		Partial<
			Record<
				"ethereum" | "arbitrum" | "bsc" | "solana" | "sui",
				Record<CoinType, CoinGeckoCoinData>
			>
		>
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
