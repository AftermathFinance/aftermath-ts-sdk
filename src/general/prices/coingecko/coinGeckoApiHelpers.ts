import { Coin } from "../../../packages";
import { CoinPriceInfo, CoinType } from "../../../types";
import { CoinHistoricalData } from "../../historicalData/historicalDataTypes";
import { Helpers } from "../../utils";
import { CoinGeckoCoinApiId, CoinGeckoCoinData } from "./coinGeckoTypes";

export class CoinGeckoApiHelpers {
	// =========================================================================
	//  Private Static Class Members
	// =========================================================================

	private static readonly constants = {
		coinApiIdsToCoinTypes: {
			"usd-coin-wormhole-from-ethereum": [
				"0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
				"0xe32d3ebafa42e6011b87ef1087bbc6053b499bf6f095807b9013aff5a6ecd7bb::coin::COIN",
				"0x909cba62ce96d54de25bec9502de5ca7b4f28901747bbf96b76c2e63ec5f1cba::coin::COIN",
				"0xdb9ed08481f9dd565fd36b834eb3c2cda1ee5f388048154807cffcb0267ed3b2::coin::COIN",
				"0xb231fcda8bbddb31f2ef02e6161444aec64a514e2c89279584ac9806ce9cf037::coin::COIN",
			],
			tbtc: [
				"0xbc3a676894871284b3ccfb2eec66f428612000e2a6e6d23f592ce8833c27c973::coin::COIN",
			],
			"wrapped-solana": [
				"0xb7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8::coin::COIN",
			],
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly coinGeckoApiKey: string) {}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Coin Data
	// =========================================================================

	public fetchAllCoinData = async (): Promise<
		Record<CoinType, CoinGeckoCoinData>
	> => {
		const coinData = await this.callApi<
			{
				id: string;
				symbol: string;
				name: string;
				platforms: {
					sui?: string;
				};
			}[]
		>("coins/list?include_platform=true");

		const suiCoinData = coinData
			.filter((data) => "sui" in data.platforms || data.id === "sui")
			.map((data) => {
				const coinType =
					data.id === "sui"
						? Coin.constants.suiCoinType
						: data.platforms.sui;

				try {
					if (!coinType) throw new Error("no coin type found");
					return {
						apiId: data.id,
						name: data.name,
						symbol: data.symbol,
						coinType: Helpers.addLeadingZeroesToType(coinType),
					};
				} catch (e) {
					return undefined;
				}
			})
			.filter((data) => data !== undefined) as CoinGeckoCoinData[];

		const partialCoinDataObject: Record<CoinType, CoinGeckoCoinData> =
			suiCoinData.reduce((acc, data) => {
				return {
					[data.coinType]: data,
					...acc,
				};
			}, {});

		const coinDataObject = Object.entries(
			CoinGeckoApiHelpers.constants.coinApiIdsToCoinTypes
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

		return coinDataObject;
	};

	// =========================================================================
	//  Historical Data
	// =========================================================================

	public fetchHistoricalData = async (inputs: {
		coinApiId: CoinGeckoCoinApiId;
		daysAgo: number;
	}): Promise<CoinHistoricalData> => {
		const { coinApiId, daysAgo } = inputs;

		const allData = await this.callApi<{
			prices: [timestamp: number, price: number][];
			market_caps: [timestamp: number, marketCap: number][];
			total_volumes: [timestamp: number, volume: number][];
		}>(`coins/${coinApiId}/market_chart?vs_currency=USD&days=${daysAgo}`);

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
	};

	// =========================================================================
	//  Current Prices
	// =========================================================================

	public fetchCoinsToPriceInfo = async (inputs: {
		coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	}): Promise<Record<CoinType, CoinPriceInfo>> => {
		const { coinsToApiId } = inputs;
		if (Object.keys(coinsToApiId).length <= 0) return {};

		const rawCoinsInfo = await this.callApi<
			Record<CoinGeckoCoinApiId, { usd: number; usd_24h_change: number }>
		>(
			`simple/price?ids=${Helpers.uniqueArray(
				Object.values(coinsToApiId)
			).reduce(
				(acc, apiId) => `${acc},${apiId}`,
				""
			)}&vs_currencies=USD&include_24hr_change=true&precision=full`
		);

		const coinsInfo: Record<CoinType, CoinPriceInfo> = Object.entries(
			coinsToApiId
		).reduce((acc, [coinType, coinApiId]) => {
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
		}, {});

		return coinsInfo;
	};

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
}
