/////////////////////////////////////////////////////////////////////
//// Historical Data
/////////////////////////////////////////////////////////////////////

export type CoinHistoricalDataPoint = [timestamp: number, value: number];

export interface CoinHistoricalData {
	prices: CoinHistoricalDataPoint[];
	marketCaps: CoinHistoricalDataPoint[];
	volumes24Hours: CoinHistoricalDataPoint[];
}
