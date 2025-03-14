import { SuiNetwork } from "../types/suiTypes";
import { CoinSymbol, CoinType } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { CallerConfig, Url } from "../types";
import { CoinHistoricalData } from "./historicalDataTypes";
import {
	CoinGeckoCoinData,
	CoinGeckoCoinSymbolData,
} from "../prices/coinGeckoTypes";

export class HistoricalData extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config?: CallerConfig) {
		super(config, "historical-data");
	}

	// =========================================================================
	//  Historical Data
	// =========================================================================

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supported-coins");
	}

	public async getAllSuiCoinData(): Promise<
		Record<CoinType, CoinGeckoCoinData>
	> {
		return this.fetchApi("coins-data");
	}

	public async getAllCoinData(): Promise<
		Record<CoinSymbol, CoinGeckoCoinSymbolData>
	> {
		return this.fetchApi("coin-symbols-data");
	}

	public async getCoinHistoricalData(inputs: {
		coin: CoinType;
	}): Promise<CoinHistoricalData> {
		return this.fetchApi(inputs.coin);
	}
}
