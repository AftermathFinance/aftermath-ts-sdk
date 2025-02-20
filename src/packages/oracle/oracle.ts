import { Caller } from "../../general/utils/caller";
import { CallerConfig, ObjectId, SuiNetwork, Url } from "../../types";

export class Oracle extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config?: CallerConfig) {
		super(config, "oracle");
	}

	// =========================================================================
	//  Price Feeds
	// =========================================================================

	public async getPrices(inputs: {
		priceFeedIds: ObjectId[];
	}): Promise<number[]> {
		if (inputs.priceFeedIds.length <= 0) return [];
		return this.fetchApi(`prices`, inputs);
	}

	public async getPrice(inputs: { priceFeedId: ObjectId }): Promise<number> {
		return (
			await this.getPrices({ priceFeedIds: [inputs.priceFeedId] })
		)[0];
	}
}
