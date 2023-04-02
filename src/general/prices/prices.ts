import { SuiNetwork } from "../types/suiTypes";
import { CoinType, CoinsToPrice } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";

export class Prices extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "prices");
	}

	/////////////////////////////////////////////////////////////////////
	//// Prices
	/////////////////////////////////////////////////////////////////////

	public async getCoinPrice(coin: CoinType): Promise<number> {
		return this.fetchApi(JSON.stringify([coin]));
	}

	public async getCoinsToPrice(coins: CoinType[]): Promise<CoinsToPrice> {
		return this.fetchApi(JSON.stringify(coins));
	}
}
