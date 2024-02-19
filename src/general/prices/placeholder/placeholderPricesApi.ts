import { Coin } from "../../../packages/coin/coin";
import {
	CoinPriceInfo,
	CoinSymbol,
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

	public fetchPrice = async (inputs: { coin: CoinType }) => {
		return (await this.fetchPrices([inputs.coin]))[0];
	};

	public fetchCoinsToPrice = async (inputs: { coins: CoinType[] }) => {
		const { coins } = inputs;

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
		coins: CoinType[];
	}): Promise<Record<CoinType, CoinPriceInfo>> => {
		const { coins } = inputs;
		if (coins.length <= 0) return {};

		const coinsToPrice = await this.fetchCoinsToPrice({
			coins,
		});

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
		coinSymbolsToApiId: Record<CoinSymbol, CoinGeckoCoinApiId>;
	}): Promise<CoinSymbolsToPriceInfo> {
		// TODO: check constants for better fake data ?
		return Object.keys(inputs.coinSymbolsToApiId).reduce(
			(acc, symbol) => ({
				...acc,
				[symbol]: {
					price: Math.random() * 1000,
					priceChange24HoursPercentage:
						Math.random() > 0.5 ? 0 : (Math.random() - 0.5) / 10,
				},
			}),
			{}
		);
	}

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
