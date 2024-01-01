import {
	CoinPriceInfo,
	CoinSymbol,
	CoinSymbolsToPriceInfo,
	CoinType,
} from "../../types";
import { CoinGeckoCoinApiId } from "./coingecko/coinGeckoTypes";

export interface PricesApiInterface {
	fetchPrice: (coin: CoinType) => Promise<number>;
	fetchCoinsToPrice: (coins: CoinType[]) => Promise<Record<CoinType, number>>;

	fetchCoinSymbolsToPriceInfo: (inputs: {
		coinSymbolsToApiId: Record<CoinSymbol, CoinGeckoCoinApiId>;
	}) => Promise<CoinSymbolsToPriceInfo>;

	// fetchPriceGivenApiId: (inputs: {
	// 	coinType: CoinType;
	// 	coinApiId: CoinGeckoCoinApiId;
	// }) => Promise<number>;
	// fetchCoinsToPriceGivenApiIds: (inputs: {
	// 	coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	// }) => Promise<Record<CoinType, number>>;

	fetchCoinsToPriceInfo: (inputs: {
		coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	}) => Promise<Record<CoinType, CoinPriceInfo>>;
}
