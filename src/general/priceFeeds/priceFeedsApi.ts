// import { Url } from "../../types";
// import { SuiPriceServiceConnection } from "@pythnetwork/pyth-sui-js";
// import { PythPriceFeedId } from "./priceFeedsTypes";

// export class PriceFeedsApi {
// 	// =========================================================================
// 	//  Class Members
// 	// =========================================================================

// 	protected readonly connection: SuiPriceServiceConnection;

// 	// =========================================================================
// 	//  Constructor
// 	// =========================================================================

// 	constructor(priceServiceEndpoint: Url) {
// 		this.connection = new SuiPriceServiceConnection(priceServiceEndpoint);
// 	}

// 	// =========================================================================
// 	//  Public Methods
// 	// =========================================================================

// 	public fetchPrices = async (
// 		priceFeedIds: PythPriceFeedId[]
// 	): Promise<number[]> => {
// 		const priceFeeds = await this.connection.getLatestPriceFeeds(
// 			priceFeedIds
// 		);
// 		if (priceFeeds === undefined)
// 			throw new Error("unable to fetch pyth price feeds");

// 		return priceFeeds?.map((feed) =>
// 			feed.getPriceUnchecked().getPriceAsNumberUnchecked()
// 		);
// 	};
// }

/**
 * Empty placeholder for the inactive low-level price-feed API.
 *
 * This export has no methods and performs no network I/O. The prior Pyth
 * client implementation is commented out, so this module does not expose a
 * price-feed constructor or query method.
 */
export default {};
