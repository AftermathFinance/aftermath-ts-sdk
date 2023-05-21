import { Coin } from "../../../packages";
import { CoinType } from "../../../types";
import { CoinHistoricalData } from "../../historicalData/historicalDataTypes";
import { Helpers } from "../../utils";
import {
	CoinGeckoCoinApiId,
	CoinGeckoCoinData,
	CoinGeckoCoinPriceInfo,
} from "./coinGeckoTypes";

export class CoinGeckoApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly coinGeckoApiKey: string) {}

	/////////////////////////////////////////////////////////////////////
	//// Public
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Coin Data
	/////////////////////////////////////////////////////////////////////

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

		const coinDataObject: Record<CoinType, CoinGeckoCoinData> =
			suiCoinData.reduce((acc, data) => {
				return {
					[data.coinType]: data,
					...acc,
				};
			}, {});

		return coinDataObject;
	};

	/////////////////////////////////////////////////////////////////////
	//// Historical Data
	/////////////////////////////////////////////////////////////////////

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

		return formattedData;
	};

	/////////////////////////////////////////////////////////////////////
	//// Current Prices
	/////////////////////////////////////////////////////////////////////

	public fetchCoinsToPriceInfo = async (inputs: {
		coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	}): Promise<Record<CoinType, CoinGeckoCoinPriceInfo>> => {
		const { coinsToApiId: coinTypeToCoinApiId } = inputs;

		const rawCoinsInfo = await this.callApi<
			Record<CoinGeckoCoinApiId, { usd: number; usd_24h_change: number }>
		>(
			`simple/price/ids=${Object.values(coinTypeToCoinApiId).reduce(
				(acc, apiId) => `${acc},${apiId}`,
				""
			)}&vs_currencies=usd&include_24hr_change=true&precision=full`
		);

		const coinsInfo: Record<CoinType, CoinGeckoCoinPriceInfo> =
			Object.entries(rawCoinsInfo).reduce((acc, [coinApiId, info]) => {
				const coinType = Object.entries(coinTypeToCoinApiId).find(
					([, id]) => id === coinApiId
				)?.[0];

				if (!coinType)
					throw new Error(
						"coin type not found for coingecko api coin id"
					);

				return {
					...acc,
					[coinType]: {
						price: info.usd,
						priceChange24HoursPercentage: info.usd_24h_change / 100,
					},
				};
			}, {});

		return coinsInfo;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private callApi = async <OutputType>(endpoint: string) => {
		const someJson = await (
			await fetch(
				"https://pro-api.coingecko.com/api/v3/" +
					(endpoint[0] === "/"
						? endpoint.replace("/", "")
						: endpoint) +
					`&x_cg_pro_api_key=${this.coinGeckoApiKey}`
			)
		).json();

		const castedRes = someJson as OutputType;
		return castedRes;
	};
}