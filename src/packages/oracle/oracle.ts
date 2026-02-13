import { AftermathApi } from "../../general/providers/index.ts";
import { Caller } from "../../general/utils/caller.ts";
import { CallerConfig, ObjectId, SuiNetwork, Url } from "../../types.ts";

export class Oracle extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "oracle");
	}

	// =========================================================================
	//  Price Feeds
	// =========================================================================

	public async getPrice(inputs: { priceFeedId: ObjectId }): Promise<number> {
		return this.fetchApi(`${inputs.priceFeedId}/price`);
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

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Oracle();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
