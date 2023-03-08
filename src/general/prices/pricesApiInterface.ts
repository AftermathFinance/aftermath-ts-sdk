import { CoinType } from "../../types";

export interface PricesApiInterface {
	// NOTE: do we event want/need these first two method at all ?
	// fetchPrice: (coin: CoinType) => Promise<number>;
	// fetchPrices: (coins: CoinType[]) => Promise<number[]>;
	fetchCoinsToPrice: (coins: CoinType[]) => Promise<Record<CoinType, number>>;
}
