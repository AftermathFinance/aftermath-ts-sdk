import { SuiNetwork } from "../types/suiTypes";
import {
	CoinPriceInfo,
	CoinSymbol,
	CoinSymbolsToPriceInfo,
	CoinType,
	CoinsToPrice,
	CoinsToPriceInfo,
} from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { CallerConfig, Url } from "../types";

/**
 * The `Prices` class provides methods for fetching price information for various
 * coins on the Sui network, including single-coin or multi-coin queries.
 */
export class Prices extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new `Prices` instance for retrieving coin price data from
	 * Aftermath's backend or other data sources.
	 *
	 * @param config - Optional configuration, including network and access token.
	 */
	constructor(config?: CallerConfig) {
		super(config, "price-info");
	}

	// =========================================================================
	//  Prices
	// =========================================================================

	/**
	 * Retrieves detailed price information (including current price and 24h change)
	 * for a single coin.
	 *
	 * @param inputs - Contains the `coin` type (e.g., "0x2::sui::SUI").
	 * @returns A promise resolving to a `CoinPriceInfo` object.
	 *
	 * @example
	 * ```typescript
	 *
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // initialize provider
	 *
	 * const prices = afSdk.Prices();
	 *
	 * const suiPriceInfo = await prices.getCoinPriceInfo({
	 *   coin: "0x2::sui::SUI"
	 * });
	 * console.log(suiPriceInfo.price, suiPriceInfo.priceChange24HoursPercentage);
	 * ```
	 */
	public async getCoinPriceInfo(inputs: {
		coin: CoinType;
	}): Promise<CoinPriceInfo> {
		const coinsToPriceInfo = await this.getCoinsToPriceInfo({
			coins: [inputs.coin],
		});
		return Object.values(coinsToPriceInfo)[0];
	}

	/**
	 * Retrieves detailed price information for multiple coins simultaneously,
	 * returning a record keyed by `CoinType`.
	 *
	 * @param inputs - An object containing an array of `coins`.
	 * @returns A promise resolving to a `CoinsToPriceInfo` mapping each coin type to its price info.
	 *
	 * @example
	 * ```typescript
	 * const prices = new Prices();
	 * const info = await prices.getCoinsToPriceInfo({
	 *   coins: ["0x2::sui::SUI", "0x<some_other_coin>"]
	 * });
	 * console.log(info);
	 * ```
	 */
	public async getCoinsToPriceInfo(inputs: {
		coins: CoinType[];
	}): Promise<CoinsToPriceInfo> {
		return this.fetchApi("", inputs);
	}

	/**
	 * Fetches only the current price in USD for a single coin.
	 *
	 * @param inputs - Contains the `coin` type.
	 * @returns A promise resolving to a `number` representing the price in USD.
	 *
	 * @example
	 * ```typescript
	 * const prices = new Prices();
	 * const suiPrice = await prices.getCoinPrice({ coin: "0x2::sui::SUI" });
	 * console.log("SUI price in USD:", suiPrice);
	 * ```
	 */
	public async getCoinPrice(inputs: { coin: CoinType }): Promise<number> {
		const priceInfo = await this.getCoinPriceInfo(inputs);
		return priceInfo.price;
	}

	/**
	 * Fetches current prices in USD for multiple coins, returning a record keyed by `CoinType`.
	 *
	 * @param inputs - Contains an array of `coins`.
	 * @returns A promise resolving to a `CoinsToPrice` object mapping coin types to their prices in USD.
	 *
	 * @example
	 * ```typescript
	 * const prices = new Prices();
	 * const multiPrices = await prices.getCoinsToPrice({ coins: ["0x2::sui::SUI", "0x<other>"] });
	 * console.log(multiPrices["0x2::sui::SUI"]); // e.g. 1.23
	 * ```
	 */
	public async getCoinsToPrice(inputs: {
		coins: CoinType[];
	}): Promise<CoinsToPrice> {
		const coinsToPriceInfo = await this.getCoinsToPriceInfo(inputs);
		const coinsToPrice: CoinsToPrice = Object.entries(
			coinsToPriceInfo
		).reduce(
			(acc, [coinType, info]) => ({
				...acc,
				[coinType]: info.price,
			}),
			{}
		);
		return coinsToPrice;
	}
}
