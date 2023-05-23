import { Coin } from "../../../packages/coin/coin";
import { CoinType, CoinsToPrice } from "../../../types";
import { CoinGeckoCoinApiId } from "../coingecko/coinGeckoTypes";
import { PricesApiInterface } from "../pricesApiInterface";

export class PlaceholderPricesApi implements PricesApiInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		prices: {
			usdc: 1,
			whusdc: 1,
			lzusdc: 1,
			axlusdc: 1,
			afsui: 3.171,
			sui: 3.02,
			whusdt: 1,
			lzusdt: 1,
			axldai: 1,
			usdt: 1,
			wheth: 1687.234,
			lzeth: 1687.234,
			whbtc: 24_681.2,
			btcb: 24_681.2,
			af: 5.19,
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Public
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Interface Methods
	/////////////////////////////////////////////////////////////////////

	public fetchPrice = async (coin: CoinType) => {
		return (await this.fetchPrices([coin]))[0];
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

	public fetchPriceGivenApiId = async (inputs: {
		coinType: CoinType;
		coinApiId: CoinGeckoCoinApiId;
	}): Promise<number> => {
		const charCode = inputs.coinType.charCodeAt(0);
		return isNaN(charCode) ? 0 : charCode;
	};

	public fetchCoinsToPriceGivenApiIds = async (inputs: {
		coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	}): Promise<Record<CoinType, number>> => {
		const coinsToPrice = await this.fetchCoinsToPrice(
			Object.keys(inputs.coinsToApiId)
		);
		return coinsToPrice;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private
	/////////////////////////////////////////////////////////////////////

	private fetchPrices = async (coins: CoinType[]) => {
		const prices = coins.map((coin) =>
			new Coin(coin).coinTypeSymbol.toLowerCase() in
			PlaceholderPricesApi.constants.prices
				? PlaceholderPricesApi.constants.prices[
						new Coin(
							coin
						).coinTypeSymbol.toLowerCase() as keyof typeof PlaceholderPricesApi.constants.prices
				  ]
				: -1
		);
		return prices;
	};
}
