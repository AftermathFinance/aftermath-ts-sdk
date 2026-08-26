import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig, NftAmmMarketObject, ObjectId } from "../../types";
import { NftAmmMarket } from "./nftAmmMarket";

/**
 * Provides high-level reads for NFT AMM markets and creates market facades for
 * pricing, NFT reads, and transaction construction.
 *
 * @example
 * ```ts
 * import { Aftermath } from "aftermath-ts-sdk";
 *
 * const sdk = await Aftermath.create({ network: "MAINNET" });
 * const market = await sdk.NftAmm().getMarket({
 * 	objectId: "0x<market-object-id>",
 * });
 * ```
 */
export class NftAmm extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/** Reserved NFT AMM constants. No public constants are defined currently. */
	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an NFT AMM facade without making a request.
	 *
	 * The optional `api` is stored for callers that construct the facade with a
	 * low-level provider. Requests still require a configured API host through
	 * `config`.
	 *
	 * @param config - Optional network, API host, endpoint, or access-token configuration.
	 * @param api - Optional `AftermathApi` used by NFT AMM transaction helpers.
	 */
	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "nft-amm");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	// =========================================================================
	//  Market Class
	// =========================================================================

	/**
	 * Fetches one NFT AMM market and wraps the response in an `NftAmmMarket`.
	 *
	 * This method performs an HTTP GET through the configured Aftermath API. The
	 * returned facade contains the market and pool data needed for local
	 * calculations. In the current implementation, this method passes `config`
	 * but not the facade's optional `api` to `NftAmmMarket`, so transaction and
	 * NFT-table methods on the returned object throw if it has no API instance.
	 *
	 * @param inputs - The market's on-chain object ID.
	 * @returns The fetched market facade.
	 * @throws `AftermathTransportError` when the HTTP request or JSON response fails.
	 * @throws `Error` when the facade has no API host configured.
	 */
	public async getMarket(inputs: { objectId: ObjectId }) {
		const market = await this.fetchApi<NftAmmMarketObject>(
			`markets/${inputs.objectId}`
		);
		return new NftAmmMarket(market, this.config);
	}

	/**
	 * Fetches several NFT AMM markets concurrently and wraps each response.
	 *
	 * Each ID is requested through `getMarket`, so the method performs one HTTP
	 * request per ID and preserves the input order in the returned array.
	 *
	 * @param inputs - The on-chain market object IDs to fetch.
	 * @returns The market facades in the same order as `inputs.objectIds`.
	 * @throws `AftermathTransportError` when any market request fails.
	 * @throws `Error` when the facade has no API host configured.
	 */
	public async getMarkets(inputs: { objectIds: ObjectId[] }) {
		const markets = await Promise.all(
			inputs.objectIds.map((objectId) => this.getMarket({ objectId }))
		);
		return markets;
	}

	/**
	 * Fetches every NFT AMM market exposed by the Aftermath API.
	 *
	 * @returns All returned market facades.
	 * @throws `AftermathTransportError` when the HTTP request or JSON response fails.
	 * @throws `Error` when the facade has no API host configured.
	 */
	public async getAllMarkets() {
		const markets = await this.fetchApi<NftAmmMarketObject[]>("markets");
		return markets.map((pool) => new NftAmmMarket(pool, this.config));
	}
}
