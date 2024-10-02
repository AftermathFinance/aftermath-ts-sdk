import { CoinType } from "../../types";
import { CoinGeckoApiHelpers } from "../prices/coingecko/coinGeckoApiHelpers";
import { CoinGeckoCoinApiId } from "../prices/coingecko/coinGeckoTypes";
import { AftermathApi } from "../providers";
import { HistoricalDataApiInterface } from "./historicalDataApiInterface";

export class HistoricalDataApi
	extends CoinGeckoApiHelpers
	implements HistoricalDataApiInterface
{
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(Provider: AftermathApi, coinGeckoApiKey: string) {
		super(Provider, coinGeckoApiKey);
	}
}
