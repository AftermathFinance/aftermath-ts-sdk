import { SuiNetwork } from "../types/suiTypes";
import { CoinType, CoinsToPrice } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { Url } from "../types";

export class Prices extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "prices");
	}

	/////////////////////////////////////////////////////////////////////
	//// Prices
	/////////////////////////////////////////////////////////////////////

	public async getCoinPrice(inputs: { coin: CoinType }): Promise<number> {
		const coinsToPrice = await this.getCoinsToPrice({
			coins: [inputs.coin],
		});
		return Object.values(coinsToPrice)[0];
	}

	public async getCoinsToPrice(inputs: {
		coins: CoinType[];
	}): Promise<CoinsToPrice> {
		return this.fetchApi(JSON.stringify(inputs.coins));
	}
}
