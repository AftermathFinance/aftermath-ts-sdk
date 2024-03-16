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
import { RouterPricesApi } from "../router/routerPricesApi";
import { CoinGeckoApiHelpers } from "./coinGeckoApiHelpers";
import { CoinGeckoCoinApiId, CoinGeckoCoinSymbolData } from "./coinGeckoTypes";

export class CoinGeckoPricesApi
	extends CoinGeckoApiHelpers
	implements PricesApiInterface
{
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		Provider: AftermathApi,
		coinGeckoApiKey: string,
		coinApiIdsToCoinTypes: Record<CoinGeckoCoinApiId, CoinType[]>
	) {
		super(Provider, coinGeckoApiKey, coinApiIdsToCoinTypes);
	}

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

	// TODO: abstract any duplicate logic with this and price info func below
	public fetchCoinsToPrice = this.Provider.withCache({
		key: "coinGeckoPricesApi.fetchCoinsToPrice",
		expirationSeconds: 300, // 5 minutes
		callback: async (inputs: { coins: CoinType[] }) => {
			const { coins } = inputs;

			// filter regular vs LP coins
			const [lpCoins, regularCoins] = await Helpers.bifilterAsync(
				coins,
				async (coin) =>
					this.Provider.Pools().fetchIsLpCoinType({
						lpCoinType: coin,
					})
			);

			const allSuiCoinData: Record<CoinSymbol, CoinGeckoCoinSymbolData> =
				await this.fetchAllSuiCoinData();
			const neededCoinData = Helpers.filterObject(
				allSuiCoinData,
				(coin) =>
					regularCoins
						.map(Helpers.addLeadingZeroesToType)
						.includes(Helpers.addLeadingZeroesToType(coin))
			);
			const coinsToApiId: Record<CoinType, CoinGeckoCoinApiId> =
				Object.entries(neededCoinData).reduce(
					(acc, [coin, data]) => ({
						...acc,
						[coin]: data.apiId,
					}),
					{}
				);

			const [coinsToPrice, lpCoinsToPrice, missingCoinsToPrice] =
				await Promise.all([
					this.fetchCoinsToPriceGivenApiIds({
						coinsToApiId,
					}),
					this.Provider.Pools().fetchLpCoinsToPrice({ lpCoins }),
					new RouterPricesApi(this.Provider).fetchCoinsToPrice({
						coins: coins.filter(
							(coin) =>
								!Object.keys(neededCoinData)
									.map(Helpers.addLeadingZeroesToType)
									.includes(
										Helpers.addLeadingZeroesToType(coin)
									)
						),
					}),
				]);
			return {
				...coinsToPrice,
				...lpCoinsToPrice,
				...missingCoinsToPrice,
			};
		},
	});

	// TODO: add single cache by coin type ?
	public fetchCoinsToPriceInfo = this.Provider.withCache({
		key: "coinGeckoPricesApi.fetchCoinsToPriceInfo",
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

			const allSuiCoinData: Record<CoinSymbol, CoinGeckoCoinSymbolData> =
				await this.fetchAllSuiCoinData();
			const neededCoinData = Helpers.filterObject(
				allSuiCoinData,
				(coin) =>
					regularCoins
						.map(Helpers.addLeadingZeroesToType)
						.includes(Helpers.addLeadingZeroesToType(coin))
			);

			const coinsToApiId: Record<CoinType, CoinGeckoCoinApiId> =
				Object.entries(neededCoinData).reduce(
					(acc, [coin, data]) => ({
						...acc,
						[coin]: data.apiId,
					}),
					{}
				);

			// get coin price info for regular coins and calc info for LP coins
			const [
				regularCoinsToPriceInfo,
				lpCoinsToPrice,
				missingRegularCoins,
			] = await Promise.all([
				this.fetchCoinsToPriceInfoInternal({ coinsToApiId }),
				this.Provider.Pools().fetchLpCoinsToPrice({ lpCoins }),
				new RouterPricesApi(this.Provider).fetchCoinsToPriceInfo({
					coins: coins.filter(
						(coin) =>
							!Object.keys(neededCoinData)
								.map(Helpers.addLeadingZeroesToType)
								.includes(Helpers.addLeadingZeroesToType(coin))
					),
				}),
			]);

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
	//  Non-Interface Methods
	// =========================================================================

	public fetchCoinsToPriceGivenApiIds = async (inputs: {
		coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	}): Promise<Record<CoinType, number>> => {
		const coinsToPriceInfo = await this.fetchCoinsToPriceInfoInternal(
			inputs
		);
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
	};
}
