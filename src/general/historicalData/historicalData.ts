import { SuiNetwork } from "../types/suiTypes";
import { CoinType } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { Url } from "../types";

export class HistoricalData extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "historical-data");
	}

	/////////////////////////////////////////////////////////////////////
	//// Historical Data
	/////////////////////////////////////////////////////////////////////

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supported-coins");
	}

	public async getCoinHistoricalData(inputs: {
		coin: CoinType;
	}): Promise<HistoricalData> {
		return this.fetchApi(inputs.coin);
	}
}
