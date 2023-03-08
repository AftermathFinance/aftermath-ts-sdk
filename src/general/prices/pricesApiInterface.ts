import { CoinType } from "../../types";

export interface PricesApiInterface {
	fetchPrice: (coin: CoinType) => Promise<number>;
	fetchPrices: (coins: CoinType[]) => Promise<number[]>;
	fetchCoinsToPrice: (coins: CoinType[]) => Promise<Record<CoinType, number>>;
}
