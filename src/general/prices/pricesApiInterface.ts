import { CoinPriceInfo, CoinType } from "../../types";

export interface PricesApiInterface {
	fetchPrice: (inputs: { coin: CoinType }) => Promise<number>;

	fetchCoinsToPrice: (inputs: {
		coins: CoinType[];
	}) => Promise<Record<CoinType, number>>;

	fetchCoinsToPriceInfo: (inputs: {
		coins: CoinType[];
	}) => Promise<Record<CoinType, CoinPriceInfo>>;
}
