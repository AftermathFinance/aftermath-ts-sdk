import { SuiNetwork } from "../types/suiTypes";
import { CoinType } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { Url } from "../types";
import { CoinHistoricalData } from "./historicalDataTypes";
import { CoinGeckoCoinData } from "../prices/coingecko/coinGeckoTypes";

export class HistoricalData extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "historical-data");
	}

	// =========================================================================
	//  Historical Data
	// =========================================================================

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supported-coins");
	}

	public async getAllCoinData(): Promise<
		Record<CoinType, CoinGeckoCoinData>
	> {
		return this.fetchApi("coins-data");
	}

	public async getCoinHistoricalData(inputs: {
		coin: CoinType;
	}): Promise<CoinHistoricalData> {
		return this.fetchApi(inputs.coin);
	}
}
