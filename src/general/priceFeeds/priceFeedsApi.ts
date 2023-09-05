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

export default {};
