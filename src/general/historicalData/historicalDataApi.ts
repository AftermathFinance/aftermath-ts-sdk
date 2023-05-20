import { Coin } from "../../packages";
import { CoinType } from "../../types";
import { Helpers } from "../utils";
import { CoinGeckoCoinData, CoinHistoricalData } from "./historicalDataTypes";

export class HistoricalDataApi {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly coinGeckoApiKey: string) {}

	/////////////////////////////////////////////////////////////////////
	//// Public
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

		const coinDataObject = suiCoinData.reduce((acc, data) => {
			return {
				[data.coinType]: data,
				...acc,
			};
		}, {});

		return coinDataObject;
	};

	public fetchHistoricalData = async (inputs: {
		coinApiId: string;
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
