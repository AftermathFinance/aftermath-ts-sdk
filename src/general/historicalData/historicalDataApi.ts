import { CoinGeckoApiHelpers } from "../prices/coingecko/coinGeckoApiHelpers";
import { HistoricalDataApiInterface } from "./historicalDataApiInterface";

export class HistoricalDataApi implements HistoricalDataApiInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly coinGeckoApiKey: string) {}

	// =========================================================================
	//  Public
	// =========================================================================

	public fetchAllCoinData = new CoinGeckoApiHelpers(this.coinGeckoApiKey)
		.fetchAllCoinData;

	public fetchHistoricalData = new CoinGeckoApiHelpers(this.coinGeckoApiKey)
		.fetchHistoricalData;
}
