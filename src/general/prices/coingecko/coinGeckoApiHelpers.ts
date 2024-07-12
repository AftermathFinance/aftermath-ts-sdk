import { Coin } from "../../../packages";
import {
	CoinDecimal,
	CoinMetadaWithInfo,
	CoinPriceInfo,
	CoinSymbol,
	CoinType,
	Url,
} from "../../../types";
import { CoinHistoricalData } from "../../historicalData/historicalDataTypes";
import { AftermathApi } from "../../providers";
import { Helpers } from "../../utils";
import {
	CoinGeckoChain,
	CoinGeckoCoinApiId,
	CoinGeckoCoinData,
	CoinGeckoCoinSymbolData,
} from "./coinGeckoTypes";

export class CoinGeckoApiHelpers {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		protected readonly Provider: AftermathApi,
		private readonly coinGeckoApiKey: string,
		private readonly coinApiIdsToCoinTypes: Record<
			CoinGeckoCoinApiId,
			CoinType[]
		>
	) {}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Coin Data
	// =========================================================================

	public fetchAllCoinDataForChains = async (inputs: {
		chains: CoinGeckoChain[];
	}): Promise<
		Partial<Record<CoinGeckoChain, Record<CoinType, CoinGeckoCoinData>>>
	> => {
		const { chains } = inputs;
		if (chains.length <= 0) return {};

		const coinData = await this.fetchRawCoinData();
		const chainsCoinData = coinData
			.filter(
				(data) =>
					chains.some((chain) => chain in data.platforms) ||
					chains.some((chain) => chain === data.id)
			)
			.map((data) =>
				chains.map((chain) => {
					const coinType =
						chain === "sui" && data.id === "sui"
							? Coin.constants.suiCoinType
							: data.platforms[chain];
					if (!coinType) return undefined;

					return {
						chain,
						apiId: data.id,
						name: data.name,
						symbol: data.symbol,
						coinType:
							chain === "sui"
								? Helpers.addLeadingZeroesToType(coinType)
								: coinType,
					};
				})
			)
			.reduce((acc, data) => [...acc, ...data], [])
			.filter((data) => data !== undefined) as CoinGeckoCoinData[];

		const partialCoinDataObject: Record<CoinType, CoinGeckoCoinData> =
			chainsCoinData.reduce((acc, data) => {
				return {
					[data.coinType]: data,
					...acc,
				};
			}, {});

		const coinDataObject = Object.entries(
			this.coinApiIdsToCoinTypes
		).reduce((acc, [coinApiId, coinTypes]) => {
			const foundSuiData = Object.values(partialCoinDataObject).find(
				(data) => data.apiId === coinApiId
			);

			let foundData = foundSuiData;

			if (!foundData) {
				const foundCoinData = coinData.find(
					(data) => data.id === coinApiId
				);
				if (!foundCoinData) return acc;

				foundData = {
					apiId: coinApiId,
					name: foundCoinData.name,
					symbol: foundCoinData.symbol,
					coinType: "",
					chain: "",
				};
			}

			if (!foundData) return acc;

			const dataToDuplicate = foundData;
			const newData = coinTypes.reduce(
				(acc, coinType) => ({
					[coinType]: { ...dataToDuplicate, coinType },
					...acc,
				}),
				acc
			);

			return newData;
		}, partialCoinDataObject);

		return Object.entries(coinDataObject).reduce(
			(acc, [coinType, data]) =>
				data.chain === ""
					? {}
					: {
							...acc,
							[data.chain]: {
								...(acc[data.chain] ?? {}),
								[coinType]: data,
							},
					  },
			{} as Partial<
				Record<CoinGeckoChain, Record<CoinType, CoinGeckoCoinData>>
			>
		);
	};

	public fetchAllCoinData = async (): Promise<
		Record<CoinSymbol, CoinGeckoCoinSymbolData>
	> => {
		const coinData = await this.fetchRawCoinData();
		return coinData.reduce((acc, data) => {
			return {
				[data.symbol.toLowerCase()]: {
					apiId: data.id,
					name: data.name,
					symbol: data.symbol.toLowerCase(),
				},
				...acc,
			};
		}, {});
	};

	// TODO: handle multiple
	public fetchCoinMetadata = this.Provider.withCache({
		key: "coinGeckoApiHelpers.fetchCoinMetadata",
		expirationSeconds: -1,
		callback: async (inputs: {
			coinType: CoinType;
			chain: CoinGeckoChain;
		}): Promise<CoinMetadaWithInfo | undefined> => {
			const { coinType, chain } = inputs;

			// Fetch the list of coins and filter by token address
			const coins = await this.fetchRawCoinData();
			const coin = coins.find(
				(c) =>
					c.platforms[chain]?.toLowerCase() === coinType.toLowerCase()
			);
			if (!coin) return undefined;

			// Fetch detailed coin metadata
			const coinDetails = await this.callApi<{
				id: string;
				symbol: string;
				name: string;
				// platforms: Partial<Record<CoinGeckoChain, CoinType>>;
				description: {
					en: string;
				};
				image: {
					small: Url;
				};
				detail_platforms: Partial<
					Record<
						CoinGeckoChain,
						{
							decimal_place: CoinDecimal;
							contract_address: CoinType;
						}
					>
				>;
			}>(
				`coins/${coin.id}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`
			);
			const { detail_platforms, name, symbol, description, image } =
				coinDetails;

			return {
				id: null,
				name,
				symbol: symbol.toUpperCase(),
				description: description.en,
				iconUrl: image.small,
				decimals: detail_platforms.ethereum?.decimal_place ?? -1,
				isGenerated: false,
			};
		},
	});

	// =========================================================================
	//  Historical Data
	// =========================================================================

	public fetchHistoricalData = this.Provider.withCache({
		key: "coinGeckoApiHelpers.fetchHistoricalData",
		expirationSeconds: 3600, // 1 hour
		callback: async (inputs: {
			coinApiId: CoinGeckoCoinApiId;
			daysAgo: number;
		}): Promise<CoinHistoricalData> => {
			const { coinApiId, daysAgo } = inputs;

			const allData = await this.callApi<{
				prices: [timestamp: number, price: number][];
				market_caps: [timestamp: number, marketCap: number][];
				total_volumes: [timestamp: number, volume: number][];
			}>(
				`coins/${coinApiId}/market_chart?vs_currency=USD&days=${daysAgo}`
			);

			const formattedData: CoinHistoricalData = {
				prices: allData.prices,
				marketCaps: allData.market_caps,
				volumes24Hours: allData.total_volumes,
				time: inputs.daysAgo,
				timeUnit: "D",
			};

			if (allData.prices.some((val) => val[0] <= 0))
				throw new Error(
					"invalid historical data for coin api id: " + coinApiId
				);

			return formattedData;
		},
	});

	// =========================================================================
	//  Current Prices
	// =========================================================================

	public fetchCoinsToPriceInfoInternal = this.Provider.withCache({
		key: "coinGeckoApiHelpers.fetchCoinsToPriceInfoInternal",
		expirationSeconds: 300, // 5 minutes
		callback: async (inputs: {
			coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
		}): Promise<Record<CoinType, CoinPriceInfo>> => {
			const { coinsToApiId } = inputs;
			if (Object.keys(coinsToApiId).length <= 0) return {};

			const singleCacheKey =
				"coinGeckoApiHelpers.fetchCoinsToPriceInfoInternal_coin";

			const cachedCoinsToPriceInfo: Record<CoinType, CoinPriceInfo> =
				Object.entries(coinsToApiId).reduce((acc, [coin]) => {
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

			const nonCachedCoinsToApiId = Helpers.filterObject(
				coinsToApiId,
				(coin) => !Object.keys(cachedCoinsToPriceInfo).includes(coin)
			);

			const rawCoinsInfo = await this.callApi<
				Record<
					CoinGeckoCoinApiId,
					{ usd: number; usd_24h_change: number }
				>
			>(
				`simple/price?ids=${Helpers.uniqueArray(
					Object.values(nonCachedCoinsToApiId)
				).reduce(
					(acc, apiId) => `${acc},${apiId}`,
					""
				)}&vs_currencies=USD&include_24hr_change=true&precision=full`
			);

			const nonCachedCoinsInfo: Record<CoinType, CoinPriceInfo> =
				Object.entries(nonCachedCoinsToApiId).reduce(
					(acc, [coinType, coinApiId]) => {
						const info = Object.entries(rawCoinsInfo).find(
							([id]) => id === coinApiId
						)?.[1];

						if (!info)
							throw new Error(
								`coin type: '${coinType}' not found for coingecko coin api id: '${coinApiId}'`
							);

						return {
							...acc,
							[coinType]: {
								price: info.usd ?? -1,
								priceChange24HoursPercentage:
									info.usd_24h_change === undefined
										? 0
										: info.usd_24h_change / 100,
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

	// =========================================================================
	//  Private
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private callApi = async <OutputType>(endpoint: string) => {
		const someJson = await (
			await fetch(
				"https://pro-api.coingecko.com/api/v3/" +
					(endpoint[0] === "/"
						? endpoint.replace("/", "")
						: endpoint) +
					(this.coinGeckoApiKey === ""
						? ""
						: `&x_cg_pro_api_key=${this.coinGeckoApiKey}`)
			)
		).json();

		const castedRes = someJson as OutputType;
		return castedRes;
	};

	private fetchRawCoinData = this.Provider.withCache({
		key: "coinGeckoApiHelpers.fetchRawCoinData",
		expirationSeconds: 86400, // 24 hours
		callback: () => {
			return this.callApi<
				{
					id: string;
					symbol: string;
					name: string;
					platforms: Partial<Record<CoinGeckoChain, CoinType>>;
				}[]
			>("coins/list?include_platform=true");
		},
	});
}
