import {
	CoinPriceInfo,
	CoinSymbol,
	CoinSymbolsToPriceInfo,
	CoinType,
	CoinsToPrice,
	CoinsToPriceInfo,
} from "../../../types";
import { AftermathApi } from "../../providers";
import { Helpers } from "../../utils";
import { PricesApiInterface } from "../pricesApiInterface";

export class RouterPricesApi implements PricesApiInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Fetching
	// =========================================================================

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Interface Methods
	// =========================================================================

	public fetchPrice = async (inputs: { coin: CoinType }): Promise<number> => {
		return Object.values(
			await this.fetchCoinsToPrice({
				coins: [inputs.coin],
			})
		)[0];
	};

	public fetchCoinsToPrice = async (inputs: {
		coins: CoinType[];
	}): Promise<CoinsToPrice> => {
		const { coins } = inputs;

		const prices: number[] = await this.Provider.indexerCaller.fetchIndexer(
			"prices",
			undefined,
			{
				coin_types: coins,
			},
			undefined,
			undefined,
			true
		);
		return coins.reduce(
			(acc, coin, index) => ({
				...acc,
				[coin]: prices[index] <= 0 ? -1 : prices[index],
			}),
			{}
		);
	};

	// TODO: add single cache by coin type ?
	public fetchCoinsToPriceInfo = this.Provider.withCache({
		key: "routerPricesApi.fetchCoinsToPriceInfo",
		expirationSeconds: 300, // 5 minutes
		callback: async (inputs: {
			coins: CoinType[];
		}): Promise<Record<CoinType, CoinPriceInfo>> => {
			const { coins } = inputs;

			// filter regular vs LP coins
			const [lpCoins, regularCoins] = await Helpers.bifilterAsync(
				coins,
				async (coin) =>
					this.Provider.Pools().fetchIsLpCoinType({
						lpCoinType: coin,
					})
			);

			// get coin price info for regular coins and calc info for LP coins
			const [regularCoinsToPriceInfo, lpCoinsToPrice] = await Promise.all(
				[
					this.fetchCoinsToPriceInfoInternal({ coins: regularCoins }),
					this.Provider.Pools().fetchLpCoinsToPrice({ lpCoins }),
				]
			);

			const lpCoinsToPriceInfo: CoinsToPriceInfo = Object.entries(
				lpCoinsToPrice
			).reduce(
				(acc, [coin, price]) => ({
					...acc,
					[coin]: {
						price,
						priceChange24HoursPercentage: 0,
					},
				}),
				{}
			);

			// fill in missing any price info data
			const missingRegularCoins: CoinsToPriceInfo = regularCoins.reduce(
				(acc, coin) =>
					Helpers.addLeadingZeroesToType(coin) in
					regularCoinsToPriceInfo
						? acc
						: {
								...acc,
								[Helpers.addLeadingZeroesToType(coin)]: {
									price: -1,
									priceChange24HoursPercentage: 0,
								},
						  },
				{}
			);

			// merge all collected data
			const allInfo: CoinsToPriceInfo = {
				...missingRegularCoins,
				...lpCoinsToPriceInfo,
				...regularCoinsToPriceInfo,
			};
			return allInfo;
		},
	});

	// =========================================================================
	//  Private (Non-Interface) Methods
	// =========================================================================

	private fetchCoinsToPriceInfoInternal = this.Provider.withCache({
		key: "routerPricesApi.fetchCoinsToPriceInfoInternal",
		expirationSeconds: 300, // 5 minutes
		callback: async (inputs: {
			coins: CoinType[];
		}): Promise<Record<CoinType, CoinPriceInfo>> => {
			const { coins } = inputs;
			if (coins.length <= 0) return {};

			const singleCacheKey =
				"routerPricesApi.fetchCoinsToPriceInfoInternal_coin";

			const cachedCoinsToPriceInfo: Record<CoinType, CoinPriceInfo> =
				coins.reduce((acc, coin) => {
					const cachedData = this.Provider.getCache<
						CoinType,
						CoinPriceInfo
					>({
						key: singleCacheKey,
						inputs: [coin],
					});
					if (cachedData === "NO_CACHED_DATA") return acc;

					return {
						...acc,
						[coin]: cachedData,
					};
				}, {});

			const nonCachedCoins = coins.filter(
				(coin) => !Object.keys(cachedCoinsToPriceInfo).includes(coin)
			);

			const nonCachedCoinsToPrice = await this.fetchCoinsToPrice({
				coins: nonCachedCoins,
			});
			const nonCachedCoinsInfo: Record<CoinType, CoinPriceInfo> =
				Object.entries(nonCachedCoinsToPrice).reduce(
					(acc, [coin, price]) => {
						return {
							...acc,
							[coin]: {
								price,
								// TODO: add 24hr price change
								priceChange24HoursPercentage: 0,
							},
						};
					},
					{}
				);

			for (const [coin, coinsInfo] of Object.entries(
				nonCachedCoinsInfo
			)) {
				this.Provider.setCache({
					key: singleCacheKey,
					data: coinsInfo,
					inputs: [coin],
					expirationSeconds: 300, // 5 minutes
				});
			}

			return { ...cachedCoinsToPriceInfo, ...nonCachedCoinsInfo };
		},
	});
}
