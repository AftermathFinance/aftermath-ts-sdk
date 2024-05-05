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

	public async getPrice(inputs: { priceFeedId: ObjectId }): Promise<number> {
		return this.fetchApi(`price/${inputs.priceFeedId}`);
	}

	public async getPrices(inputs: {
		priceFeedIds: ObjectId[];
	}): Promise<number[]> {
		return Promise.all(
			inputs.priceFeedIds.map((priceFeedId) =>
				this.getPrice({ priceFeedId })
			)
		);
	}
}
