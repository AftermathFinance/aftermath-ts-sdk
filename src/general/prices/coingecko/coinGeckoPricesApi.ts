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

	public fetchCoinsToPrice = async (inputs: { coins: CoinType[] }) => {
		const { coins } = inputs;

		const allCoinsData = await this.fetchAllSuiCoinData();
		const onlyInputCoinsData = Helpers.filterObject(allCoinsData, (coin) =>
			coins
				.map(Helpers.addLeadingZeroesToType)
				.includes(Helpers.addLeadingZeroesToType(coin))
		);
		const coinsToApiId: Record<CoinType, CoinGeckoCoinApiId> =
			Object.entries(onlyInputCoinsData).reduce(
				(acc, [coinType, data]) => ({
					...acc,
					[coinType]: data.apiId,
				}),
				{}
			);

		const coinsToPrice = await this.fetchCoinsToPriceGivenApiIds({
			coinsToApiId,
		});
		const missingCoinsToPrice: CoinsToPrice = coins.reduce(
			(acc, coin) =>
				Helpers.addLeadingZeroesToType(coin) in coinsToPrice
					? acc
					: {
							...acc,
							[Helpers.addLeadingZeroesToType(coin)]: -1,
					  },
			{}
		);

		return {
			...missingCoinsToPrice,
			...coinsToPrice,
		};
	};

	// TODO: add single cache by coin type ?
	public fetchCoinsToPriceInfo = this.Provider.withCache({
		key: "fetchCoinsToPriceInfo",
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

			let coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;

			const allSuiCoinData: Record<CoinSymbol, CoinGeckoCoinSymbolData> =
				await this.fetchAllSuiCoinData();
			const neededCoinData = Helpers.filterObject(
				allSuiCoinData,
				(coin) =>
					regularCoins
						.map(Helpers.addLeadingZeroesToType)
						.includes(Helpers.addLeadingZeroesToType(coin))
			);

			coinsToApiId = Object.entries(neededCoinData).reduce(
				(acc, [coin, data]) => ({
					...acc,
					[coin]: data.apiId,
				}),
				{}
			);

			// get coin price info for regular coins and calc info for LP coins
			const [regularCoinsToPriceInfo, lpCoinsToPrice] = await Promise.all(
				[
					this.fetchCoinsToPriceInfoInternal({ coinsToApiId }),
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
