import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import { ObjectId, SuiNetwork, Url } from "../../types";

export class AfNft extends Caller {
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
		super(network, "af-nft");
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
		const provider = this.Provider?.AfNft();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
