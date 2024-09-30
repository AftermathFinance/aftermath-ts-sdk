import { SuiNetwork } from "../types/suiTypes";
import {
	CoinPriceInfo,
	CoinSymbol,
	CoinSymbolsToPriceInfo,
	CoinType,
	CoinsToPrice,
	CoinsToPriceInfo,
} from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { Url } from "../types";

export class Prices extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork) {
		super(network, "price-info");
	}

	// =========================================================================
	//  Prices
	// =========================================================================

	public async getCoinPriceInfo(inputs: {
		coin: CoinType;
	}): Promise<CoinPriceInfo> {
		const coinsToPriceInfo = await this.getCoinsToPriceInfo({
			coins: [inputs.coin],
		});
		return Object.values(coinsToPriceInfo)[0];
	}

	public async getCoinsToPriceInfo(inputs: {
		coins: CoinType[];
	}): Promise<CoinsToPriceInfo> {
		return this.fetchApi("", inputs);
	}

	public async getCoinPrice(inputs: { coin: CoinType }): Promise<number> {
		const priceInfo = await this.getCoinPriceInfo(inputs);
		return priceInfo.price;
	}

	public async getCoinsToPrice(inputs: {
		coins: CoinType[];
	}): Promise<CoinsToPrice> {
		const coinsToPriceInfo = await this.getCoinsToPriceInfo(inputs);
		const coinsToPrice: CoinsToPrice = Object.entries(
			coinsToPriceInfo
		).reduce(
			(acc, [coinType, info]) => ({
				...acc,
				[coinType]: info.price,
			}),
			{}
		);
		return coinsToPrice;
	}
}
