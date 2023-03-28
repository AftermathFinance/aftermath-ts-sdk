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

	public async getPrice(coin: CoinType): Promise<number> {
		return this.fetchApi(JSON.stringify([coin]));
	}

	public async getCoinsPrice(coins: CoinType[]): Promise<CoinsToPrice> {
		return this.fetchApi(JSON.stringify(coins));
	}
}
