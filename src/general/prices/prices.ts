import type {
	CoinPriceInfo,
	CoinsToPrice,
	CoinsToPriceInfo,
	CoinType,
} from "../../packages/coin/coinTypes";
import type { CallerConfig } from "../types";
import { Caller } from "../utils/caller";

/**
 * Fetches current USD price information for Sui coin types.
 *
 * Each method sends a JSON POST request to the configured Aftermath
 * `price-info` endpoint, which defaults to `/api/price-info`. Price values are
 * JavaScript `number`s expressed in USD per whole coin unit. The response also
 * includes the service's 24-hour percentage change. Pass an `AbortSignal` to a
 * method when the request must be cancellable. Coin types are passed to the
 * endpoint without local validation. If neither `network` nor `baseUrl` is
 * configured, a request rejects with an `AftermathTransportError` whose `kind`
 * is `"network"`.
 *
 * HTTP failures expose their status and optional retry delay on
 * `AftermathTransportError`. Network, timeout, cancellation, and response
 * decoding failures use the same error type with a corresponding `kind`.
 */
export class Prices extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a price service with optional API host and authentication settings.
	 *
	 * @param config - Optional HTTP caller configuration. Set `network` or
	 * `baseUrl` to select the API host. `baseUrl` takes precedence over `network`.
	 * Set `accessToken` to send a bearer token with each request.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const sdk = await Aftermath.create({ network: "MAINNET" });
	 * const prices = sdk.Prices();
	 * ```
	 */
	constructor(config?: CallerConfig) {
		super(config, "price-info");
	}

	// =========================================================================
	//  Prices
	// =========================================================================

	/**
	 * Fetches price information for one coin type.
	 *
	 * This method sends a one-element `coins` array to the multi-coin price
	 * endpoint and returns the first value in the response record. A successful
	 * response normally contains the requested coin's entry.
	 *
	 * Pass `abortSignal` to cancel the underlying HTTP request. A caller abort is
	 * reported as an `AftermathTransportError` with `kind: "abort"`, unless the
	 * abort reason identifies a timeout.
	 *
	 * @param inputs - The price request.
	 * @param inputs.coin - The Sui coin type to query, such as
	 * `"0x2::sui::SUI"`.
	 * @param abortSignal - Optional caller-owned signal forwarded to `fetch`.
	 * @returns The coin's price in USD per whole coin and its 24-hour percentage
	 * change.
	 * @throws `AftermathTransportError` when the request fails, is cancelled, or
	 * returns a response that cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const sdk = await Aftermath.create({ network: "MAINNET" });
	 * const prices = sdk.Prices();
	 *
	 * const suiPriceInfo = await prices.getCoinPriceInfo({
	 * 	coin: "0x2::sui::SUI",
	 * });
	 * console.log(suiPriceInfo.price, suiPriceInfo.priceChange24HoursPercentage);
	 * ```
	 */
	public async getCoinPriceInfo(
		inputs: { coin: CoinType },
		abortSignal?: AbortSignal
	): Promise<CoinPriceInfo> {
		const coinsToPriceInfo = await this.getCoinsToPriceInfo(
			{
				coins: [inputs.coin],
			},
			abortSignal
		);
		return Object.values(coinsToPriceInfo)[0];
	}

	/**
	 * Fetches price information for multiple coin types.
	 *
	 * This method sends `inputs` as a JSON POST body to the `price-info` endpoint,
	 * which defaults to `/api/price-info`. It returns the response record keyed by
	 * coin type. Each record value contains a USD price per whole coin and the
	 * service's 24-hour percentage change.
	 *
	 * Pass `abortSignal` to cancel the underlying HTTP request.
	 *
	 * @param inputs - The price request.
	 * @param inputs.coins - The Sui coin types to query, such as
	 * `["0x2::sui::SUI"]`.
	 * @param abortSignal - Optional caller-owned signal forwarded to `fetch`.
	 * @returns A record mapping the response coin types to their price information.
	 * @throws `AftermathTransportError` when the request fails, is cancelled, or
	 * returns a response that cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const sdk = await Aftermath.create({ network: "MAINNET" });
	 * const prices = sdk.Prices();
	 * const info = await prices.getCoinsToPriceInfo({
	 * 	coins: ["0x2::sui::SUI"],
	 * });
	 * console.log(info);
	 * ```
	 */
	public async getCoinsToPriceInfo(
		inputs: { coins: CoinType[] },
		abortSignal?: AbortSignal
	): Promise<CoinsToPriceInfo> {
		return this.fetchApi("", inputs, abortSignal);
	}

	/**
	 * Fetches the current USD price for one coin type.
	 *
	 * This method fetches the coin's price information and returns only its `price`
	 * field. The returned number is USD per whole coin unit, not an on-chain
	 * smallest-unit amount.
	 *
	 * Pass `abortSignal` to cancel the underlying HTTP request.
	 *
	 * @param inputs - The price request.
	 * @param inputs.coin - The Sui coin type to query, such as
	 * `"0x2::sui::SUI"`.
	 * @param abortSignal - Optional caller-owned signal forwarded to `fetch`.
	 * @returns The current price in USD per whole coin unit.
	 * @throws `AftermathTransportError` when the request fails, is cancelled, or
	 * returns a response that cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const sdk = await Aftermath.create({ network: "MAINNET" });
	 * const prices = sdk.Prices();
	 * const suiPrice = await prices.getCoinPrice({ coin: "0x2::sui::SUI" });
	 * console.log("SUI price in USD:", suiPrice);
	 * ```
	 */
	public async getCoinPrice(
		inputs: { coin: CoinType },
		abortSignal?: AbortSignal
	): Promise<number> {
		const priceInfo = await this.getCoinPriceInfo(inputs, abortSignal);
		return priceInfo.price;
	}

	/**
	 * Fetches current USD prices for multiple coin types.
	 *
	 * This method fetches detailed price information and projects each response
	 * entry to its `price` field. The returned record keeps the response coin-type
	 * keys and contains USD per whole coin unit.
	 *
	 * Pass `abortSignal` to cancel the underlying HTTP request.
	 *
	 * @param inputs - The price request.
	 * @param inputs.coins - The Sui coin types to query, such as
	 * `["0x2::sui::SUI"]`.
	 * @param abortSignal - Optional caller-owned signal forwarded to `fetch`.
	 * @returns A record mapping response coin types to current USD prices per whole
	 * coin unit.
	 * @throws `AftermathTransportError` when the request fails, is cancelled, or
	 * returns a response that cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const sdk = await Aftermath.create({ network: "MAINNET" });
	 * const prices = sdk.Prices();
	 * const multiPrices = await prices.getCoinsToPrice({
	 * 	coins: ["0x2::sui::SUI"],
	 * });
	 * console.log(multiPrices["0x2::sui::SUI"]); // e.g. 1.23
	 * ```
	 */
	public async getCoinsToPrice(
		inputs: { coins: CoinType[] },
		abortSignal?: AbortSignal
	): Promise<CoinsToPrice> {
		const coinsToPriceInfo = await this.getCoinsToPriceInfo(
			inputs,
			abortSignal
		);
		const coinsToPrice: CoinsToPrice = Object.entries(coinsToPriceInfo).reduce(
			(acc, [coinType, info]) => ({
				...acc,
				[coinType]: info.price,
			}),
			{}
		);
		return coinsToPrice;
	}
}
