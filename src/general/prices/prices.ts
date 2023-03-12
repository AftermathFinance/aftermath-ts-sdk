import { SuiNetwork } from "../types/suiTypes";
import { CoinType } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";

export class Prices extends Caller {
	constructor(public readonly network?: SuiNetwork) {
		super(network, "prices");
	}

	/////////////////////////////////////////////////////////////////////
	//// Prices
	/////////////////////////////////////////////////////////////////////

	public async getPrice(coin: CoinType): Promise<number> {
		return this.fetchApi(JSON.stringify([coin]));
	}

	// TODO: change return type to Record<Coin, number> ?
	public async getPrices(coins: CoinType[]): Promise<number[]> {
		return this.fetchApi(JSON.stringify(coins));
	}
}
