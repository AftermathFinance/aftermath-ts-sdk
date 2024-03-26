import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import { NftAmmMarketData, ObjectId, SuiNetwork, Url } from "../../types";
import { AfEggNftAmmMarket } from "./afEggNftAmmMarket";

export class NftAmm extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "nft-amm");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	// =========================================================================
	//  Market Class
	// =========================================================================

	public async getAfEggMarket() {
		const market = await this.fetchApi<NftAmmMarketData>(`markets/af-egg`);
		return new AfEggNftAmmMarket(market, this.network, this.Provider);
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
