import { Coin } from "../../../packages/coin/coin";
import {
	CoinPriceInfo,
	CoinSymbolsToPriceInfo,
	CoinType,
	CoinsToPrice,
} from "../../../types";
import { CoinGeckoCoinApiId } from "../coingecko/coinGeckoTypes";
import { PricesApiInterface } from "../pricesApiInterface";

export class PlaceholderPricesApi implements PricesApiInterface {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		prices: {
			usd: 1,
			dai: 1,
			sui: 0.6179,
			eth: 1754.5,
			btc: 25957,
			af: 5.19,
			buck: 1,
		},
	};

	// =========================================================================
	//  Fetching
	// =========================================================================

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Interface Methods
	// =========================================================================

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

	public fetchCoinsToPriceInfo = async (inputs: {
		coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	}): Promise<Record<CoinType, CoinPriceInfo>> => {
		const { coinsToApiId } = inputs;
		if (Object.keys(coinsToApiId).length <= 0) return {};

		const coinsToPrice = await this.fetchCoinsToPrice(
			Object.keys(inputs.coinsToApiId)
		);

		const coinsInfo = Object.entries(coinsToPrice).reduce(
			(acc, [coin, price]) => ({
				...acc,
				[coin]: {
					price,
					priceChange24HoursPercentage:
						Math.random() > 0.5 ? 0 : (Math.random() - 0.5) / 10,
				},
			}),
			{}
		);
		return coinsInfo;
	};

	public async fetchCoinSymbolsToPriceInfo(inputs: {
		coinSymbols: CoinGeckoCoinApiId[];
	}): Promise<CoinSymbolsToPriceInfo> {
		// TODO: check constants for better fake data ?
		return inputs.coinSymbols.reduce(
			(acc, coinSymbol) => ({
				...acc,
				[coinSymbol]: {
					price: Math.random() * 1000,
					priceChange24HoursPercentage:
						Math.random() > 0.5 ? 0 : (Math.random() - 0.5) / 10,
				},
			}),
			{}
		);
	}

	// public fetchPriceGivenApiId = async (inputs: {
	// 	coinType: CoinType;
	// 	coinApiId: CoinGeckoCoinApiId;
	// }): Promise<number> => {
	// 	const charCode = inputs.coinType.charCodeAt(0);
	// 	return isNaN(charCode) ? 0 : charCode;
	// };

	// public fetchCoinsToPriceGivenApiIds = async (inputs: {
	// 	coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	// }): Promise<Record<CoinType, number>> => {
	// 	const coinsToPrice = await this.fetchCoinsToPrice(
	// 		Object.keys(inputs.coinsToApiId)
	// 	);
	// 	return coinsToPrice;
	// };

	// =========================================================================
	//  Private
	// =========================================================================

	private fetchPrices = async (coins: CoinType[]) => {
		const prices = coins.map((coin) => {
			const foundPrice = Object.entries(
				PlaceholderPricesApi.constants.prices
			).find(([coinSymbol, price]) =>
				new Coin(coin).coinTypeSymbol.toLowerCase().includes(coinSymbol)
			);
			return foundPrice?.[1] ?? -1;
		});
		return prices;
	};
}
