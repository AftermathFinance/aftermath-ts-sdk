import { Caller } from "../../general/utils/caller";
import { ObjectId, SuiNetwork, Url } from "../../types";

export class Oracle extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork) {
		super(network, "oracle");
	}

	// =========================================================================
	//  Price Feeds
	// =========================================================================

	public async getPrice(inputs: { PriceFeedId: ObjectId }): Promise<number> {
		return this.fetchApi(`price/${inputs.PriceFeedId}`);
	}

	public async getPrices(inputs: {
		PriceFeedIds: ObjectId[];
	}): Promise<number[]> {
		return Promise.all(
			inputs.PriceFeedIds.map((PriceFeedId) =>
				this.getPrice({ PriceFeedId })
			)
		);
	}
}
