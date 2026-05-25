import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig, NftAmmMarketObject, ObjectId } from "../../types";
import { NftAmmMarket } from "./nftAmmMarket";

export class NftAmm extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

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

	public async getMarket(inputs: { objectId: ObjectId }) {
		const market = await this.fetchApi<NftAmmMarketObject>(
			`markets/${inputs.objectId}`
		);
		return new NftAmmMarket(market, this.config);
	}

	public async getMarkets(inputs: { objectIds: ObjectId[] }) {
		const markets = await Promise.all(
			inputs.objectIds.map((objectId) => this.getMarket({ objectId }))
		);
		return markets;
	}

	public async getAllMarkets() {
		const markets = await this.fetchApi<NftAmmMarketObject[]>("markets");
		return markets.map((pool) => new NftAmmMarket(pool, this.config));
	}
}
