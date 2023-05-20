/////////////////////////////////////////////////////////////////////
//// Historical Data
/////////////////////////////////////////////////////////////////////

import { OpUnitType, QUnitType } from "dayjs";
import { CoinType, UniqueId } from "../../types";

export interface CoinGeckoCoinData {
	apiId: UniqueId;
	name: string;
	symbol: string;
	coinType: CoinType;
}

export type CoinHistoricalDataPoint = [timestamp: number, value: number];

export interface CoinHistoricalData {
	prices: CoinHistoricalDataPoint[];
	marketCaps: CoinHistoricalDataPoint[];
	volumes24Hours: CoinHistoricalDataPoint[];
	time: number;
	timeUnit: QUnitType | OpUnitType;
}
