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
import {
	CoinGeckoChain,
	CoinGeckoCoinApiId,
	CoinGeckoCoinData,
	CoinGeckoCoinSymbolData,
} from "./coinGeckoTypes";

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
		callback: async (inputs: {
			coins: CoinType[];
		}): Promise<Record<CoinType, number>> => {
			const { coins } = inputs;

			const [suiCoins, nonSuiCoins] = await Helpers.bifilter(
				coins,
				(coin) => Helpers.isValidType(coin)
			);

			const [suiCoinsToPrice, nonSuiCoinsToPrice] = await Promise.all([
				(async () => {
					if (suiCoins.length <= 0) return {};

					// filter regular vs LP coins
					const [lpCoins, regularCoins] = await Helpers.bifilterAsync(
						suiCoins,
						async (coin) =>
							this.Provider.Pools().fetchIsLpCoinType({
								lpCoinType: coin,
							})
					);

					const allSuiCoinData: Record<
						CoinSymbol,
						CoinGeckoCoinSymbolData
					> =
						(
							await this.fetchAllCoinDataForChains({
								chains: ["sui"],
							})
						)["sui"] ?? {};
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
							this.Provider.Pools().fetchLpCoinsToPrice({
								lpCoins,
							}),
							new RouterPricesApi(
								this.Provider
							).fetchCoinsToPrice({
								coins: suiCoins.filter(
									(coin) =>
										!Object.keys(neededCoinData)
											.map(Helpers.addLeadingZeroesToType)
											.includes(
												Helpers.addLeadingZeroesToType(
													coin
												)
											)
								),
							}),
						]);
					return {
						...coinsToPrice,
						...lpCoinsToPrice,
						...missingCoinsToPrice,
					};
				})(),
				async () => {
					if (nonSuiCoins.length <= 0) return {};

					const chains = Helpers.uniqueArray(
						nonSuiCoins.map(
							(coin) => Helpers.splitNonSuiCoinType(coin).chain
						)
					);

					const allNonSuiCoinData: Partial<
						Record<
							CoinGeckoChain,
							Record<CoinType, CoinGeckoCoinData>
						>
					> =
						(await this.fetchAllCoinDataForChains({
							// TODO: handle other chains
							chains,
						})) ?? {};

					const neededCoinData = Object.entries(allNonSuiCoinData)
						.map(([chain, data]) =>
							Helpers.filterObject(
								Object.entries(data)
									.map(([coinType, filteredData]) => ({
										[coinType]: filteredData,
									}))
									.reduce(
										(acc, curr) => ({
											...acc,
											...curr,
										}),
										{}
									),
								(coin) =>
									nonSuiCoins.some(
										(aCoin) =>
											aCoin.toLowerCase() ===
											coin.toLowerCase()
									)
							)
						)
						.reduce(
							(acc, curr) => ({
								...acc,
								...curr,
							}),
							{}
						);

					const coinsToApiId: Record<CoinType, CoinGeckoCoinApiId> =
						Object.entries(neededCoinData).reduce(
							(acc, [coin, data]) => ({
								...acc,
								[coin]: data.apiId,
							}),
							{}
						);

					return this.fetchCoinsToPriceGivenApiIds({
						coinsToApiId,
					});
				},
			]);

			return {
				...suiCoinsToPrice,
				...nonSuiCoinsToPrice,
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

			const [suiCoins, nonSuiCoins] = await Helpers.bifilter(
				coins,
				(coin) => Helpers.isValidType(coin)
			);

			const [suiCoinsPriceInfo, nonSuiCoinsPriceInfo] = await Promise.all(
				[
					(async () => {
						if (suiCoins.length <= 0) return {};

						// filter regular vs LP coins
						const [lpCoins, regularCoins] =
							await Helpers.bifilterAsync(
								suiCoins,
								async (coin) =>
									this.Provider.Pools().fetchIsLpCoinType({
										lpCoinType: coin,
									})
							);

						const allSuiCoinData: Record<
							CoinType,
							CoinGeckoCoinSymbolData
						> =
							(
								await this.fetchAllCoinDataForChains({
									chains: ["sui"],
								})
							)["sui"] ?? {};
						const neededCoinData = Helpers.filterObject(
							allSuiCoinData,
							(coin) =>
								regularCoins
									.map(Helpers.addLeadingZeroesToType)
									.includes(
										Helpers.addLeadingZeroesToType(coin)
									)
						);

						const coinsToApiId: Record<
							CoinType,
							CoinGeckoCoinApiId
						> = Object.entries(neededCoinData).reduce(
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
							this.fetchCoinsToPriceInfoInternal({
								coinsToApiId,
							}),
							this.Provider.Pools().fetchLpCoinsToPrice({
								lpCoins,
							}),
							new RouterPricesApi(
								this.Provider
							).fetchCoinsToPriceInfo({
								coins: suiCoins.filter(
									(coin) =>
										!Object.keys(neededCoinData)
											.map(Helpers.addLeadingZeroesToType)
											.includes(
												Helpers.addLeadingZeroesToType(
													coin
												)
											)
								),
							}),
						]);

						const lpCoinsToPriceInfo: CoinsToPriceInfo =
							Object.entries(lpCoinsToPrice).reduce(
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
					})(),
					(async () => {
						if (nonSuiCoins.length <= 0) return {};

						const chains = Helpers.uniqueArray(
							nonSuiCoins.map(
								(coin) =>
									Helpers.splitNonSuiCoinType(coin).chain
							)
						);

						const allNonSuiCoinData: Partial<
							Record<
								CoinGeckoChain,
								Record<CoinType, CoinGeckoCoinData>
							>
						> =
							(await this.fetchAllCoinDataForChains({
								// TODO: handle other chains
								chains,
							})) ?? {};

						const neededCoinData = Object.entries(allNonSuiCoinData)
							.map(([chain, data]) =>
								Helpers.filterObject(
									Object.entries(data)
										.map(([coinType, filteredData]) => ({
											[coinType]: filteredData,
										}))
										.reduce(
											(acc, curr) => ({
												...acc,
												...curr,
											}),
											{}
										),
									(coin) =>
										nonSuiCoins.some(
											(aCoin) =>
												aCoin.toLowerCase() ===
												coin.toLowerCase()
										)
								)
							)
							.reduce(
								(acc, curr) => ({
									...acc,
									...curr,
								}),
								{}
							);

						const coinsToApiId: Record<
							CoinType,
							CoinGeckoCoinApiId
						> = Object.entries(neededCoinData).reduce(
							(acc, [coin, data]) => ({
								...acc,
								[coin]: data.apiId,
							}),
							{}
						);

						return this.fetchCoinsToPriceInfoInternal({
							coinsToApiId,
						});
					})(),
				]
			);

			return {
				...suiCoinsPriceInfo,
				...nonSuiCoinsPriceInfo,
			};
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
