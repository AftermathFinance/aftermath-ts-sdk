import { CoinType } from "../../types";
import { CoinGeckoApiHelpers } from "../prices/coingecko/coinGeckoApiHelpers";
import { CoinGeckoCoinApiId } from "../prices/coingecko/coinGeckoTypes";
import { HistoricalDataApiInterface } from "./historicalDataApiInterface";

export class HistoricalDataApi implements HistoricalDataApiInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		private readonly coinGeckoApiKey: string,
		private readonly coinApiIdsToCoinTypes: Record<
			CoinGeckoCoinApiId,
			CoinType[]
		>
	) {}

	// =========================================================================
	//  Public
	// =========================================================================

	public fetchAllCoinData = new CoinGeckoApiHelpers(
		this.coinGeckoApiKey,
		this.coinApiIdsToCoinTypes
	).fetchAllCoinData;

	public fetchHistoricalData = new CoinGeckoApiHelpers(
		this.coinGeckoApiKey,
		this.coinApiIdsToCoinTypes
	).fetchHistoricalData;
}
