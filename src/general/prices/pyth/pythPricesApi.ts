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

	public fetchPrice = async (coin: CoinType) => {
		return (await this.fetchPrices([coin]))[0];
	};

	public fetchPrices = async (coins: CoinType[]) => {
		const priceFeeds = await this.fetchPriceFeeds(coins);
		const prices = priceFeeds.map((priceFeed) => {
			// TODO: handle this differently ? - will cause breaking changes in FE
			if (priceFeed === undefined) return -1;

			const price = priceFeed.getPriceAsNumberUnchecked();
			if (price <= 0) return -1;

			return price;
		});

		return prices;
	};

	public fetchCoinsToPrice = async (coins: CoinType[]) => {
		const prices = await this.fetchPrices(coins);
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
