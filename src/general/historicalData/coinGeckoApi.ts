import { CoinHistoricalData } from "./historicalDataTypes";

export class HistoricalDataApi {
	// extends PythPricesApiHelpers

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor() {}

	/////////////////////////////////////////////////////////////////////
	//// Public
	/////////////////////////////////////////////////////////////////////

	public fetchAllCoinData = async () => {
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
			.filter((data) => "sui" in data.platforms)
			.map((data) => {
				return {
					apiId: data.id,
					name: data.name,
					symbol: data.symbol,
					coinType: data.platforms.sui ?? "",
				};
			});

		return suiCoinData;
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

		const formattedData = {
			prices: allData.prices,
			marketCaps: allData.market_caps,
			volumes24Hours: allData.total_volumes,
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
		return JSON.parse(
			await (
				await fetch(
					"https://api.coingecko.com/api/v3/" +
						(endpoint[0] === "/"
							? endpoint.replace("/", "")
							: endpoint),
					{
						headers: {
							"x-cg-pro-api-key": "apiKey",
						},
					}
				)
			).json()
		) as OutputType;
	};
}
