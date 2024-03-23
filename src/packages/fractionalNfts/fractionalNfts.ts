import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import { SuiNetwork } from "../../types";

export class FractionalNfts extends Caller {
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
		super(network, "fractional-nfts");
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
		const provider = this.Provider?.FractionalNfts();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
