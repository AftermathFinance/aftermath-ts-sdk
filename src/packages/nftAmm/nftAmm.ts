import { ObjectId } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import { Nft, SuiNetwork } from "../../types";

export class NftAmm extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "nft-amm");
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	// public async getNft(inputs: { objectId: ObjectId }): Promise<Nft> {
	// 	return this.fetchApi(`nfts/${inputs.objectId}`);
	// }

	// public async getNfts(inputs: { objectIds: ObjectId[] }): Promise<Nft[]> {
	// 	return Promise.all(
	// 		inputs.objectIds.map((objectId) => this.getNft({ objectId }))
	// 	);
	// }
}
