import { ObjectId } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { NftAmmApiHelpers } from "./nftAmmApiHelpers";
import { Nft } from "../nftAmmTypes";
import { NftAmmApiCasting } from "./nftAmmApiCasting";

export class NftAmmApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new NftAmmApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	public fetchNfts = async (objectIds: ObjectId[]): Promise<Nft[]> => {
		const objects = await this.Provider.Objects().fetchObjectBatch(
			objectIds,
			true
		);
		return objects.map(NftAmmApiCasting.nftFromSuiObjectResponse);
	};
}
