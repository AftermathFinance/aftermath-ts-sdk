import { CoinType } from "../../../types";
import { AftermathApi } from "../../providers/aftermathApi";
import { PricesApiInterface } from "../pricesApiInterface";
import { PythPricesApiHelpers } from "./pythPricesApiHelpers";

export class PythPricesApi
	extends PythPricesApiHelpers
	implements PricesApiInterface
{
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(Provider: AftermathApi) {
		super(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public fetchCoinsToPrice = async (coins: CoinType[]) => {
		const fetchedPrices = await this.fetchPriceFeeds(coins);
		const prices = fetchedPrices.map((price) => {
			if (price === undefined) return -1; // TODO: handle this differently ? - will cause breaking changes in FE
			return price.getPriceAsNumberUnchecked();
		});

		const coinsToPrice: Record<CoinType, number> = coins.reduce(
			(acc, coin, index) => {
				return {
					...acc,
					[coin]: prices[index],
				};
			},
			{}
		);
		return coinsToPrice;
	};
}
