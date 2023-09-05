// import { SuiNetwork } from "../types/suiTypes";
// import { Caller } from "../utils/caller";
// import { Url } from "../types";
// import { PythPriceFeedId } from "./priceFeedsTypes";

// export class PriceFeeds extends Caller {
// 	// =========================================================================
// 	//  Constructor
// 	// =========================================================================

// 	constructor(public readonly network?: SuiNetwork | Url) {
// 		super(network, "price-feeds");
// 	}

// 	// =========================================================================
// 	//  Price Feeds
// 	// =========================================================================

// 	public async getPrices(inputs: {
// 		priceFeedIds: PythPriceFeedId[];
// 	}): Promise<number[]> {
// 		return this.fetchApi(JSON.stringify(inputs.priceFeedIds));
// 	}

// 	public async getPrice(priceFeedId: PythPriceFeedId): Promise<number> {
// 		return (await this.getPrices({ priceFeedIds: [priceFeedId] }))[0];
// 	}
// }

export default {};
