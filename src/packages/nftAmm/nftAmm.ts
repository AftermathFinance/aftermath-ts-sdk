import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	CallerConfig,
	NftAmmMarketObject,
	ObjectId,
	SuiNetwork,
	Url,
} from "../../types";
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
		private readonly Provider?: AftermathApi
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

	// =========================================================================
	//  Objects
	// =========================================================================

	// public async getNft(inputs: { objectId: ObjectId }): Promise<Nft> {
	// 	return this.fetchApi(`nfts/${inputs.objectId}`);
	// }

	// public async getNfts(inputs: { objectIds: ObjectId[] }): Promise<Nft[]> {
	// 	return Promise.all(
	// 		inputs.objectIds.map((objectId) => this.getNft({ objectId }))
	// 	);
	// }

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.NftAmm();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
