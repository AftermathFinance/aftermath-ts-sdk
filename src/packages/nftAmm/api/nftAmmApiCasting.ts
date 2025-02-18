import { NftAmmMarketObject } from "../nftAmmTypes";
import { Helpers } from "../../../general/utils";
import { NftAmmMarketFieldsOnChain } from "./nftAmmApiCastingTypes";
import { Coin } from "../../coin";
import { PoolsApiCasting } from "../../pools/api/poolsApiCasting";
import { SuiObjectResponse } from "@mysten/sui/client";

export class NftAmmApiCasting {
	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public static marketObjectFromSuiObject = (
		suiObject: SuiObjectResponse
	): NftAmmMarketObject => {
		const objectId = Helpers.getObjectId(suiObject);
		const marketType = Helpers.getObjectType(suiObject);
		if (!marketType) throw new Error("no object type found");

		const fields = Helpers.getObjectFields(
			suiObject
		) as NftAmmMarketFieldsOnChain;

		const pool = PoolsApiCasting.poolObjectFromSuiObject(fields.pool);

		const fractionalizedCoinType = Coin.getInnerCoinType(
			fields.supply.type
		);

		const innerMarketTypes = Coin.getInnerCoinType(marketType);
		const genericTypes = innerMarketTypes.replaceAll(" ", "").split(",");

		const assetCoinType = genericTypes[2];
		const nftType = genericTypes[3];

		return {
			objectId,
			pool,
			objectType: marketType,
			nftsTable: {
				objectId: fields.nfts.fields.id.id,
				size: BigInt(fields.nfts.fields.size),
			},
			fractionalizedSupply: BigInt(fields.supply.fields.value),
			fractionalizedCoinAmount: BigInt(fields.fractions_amount),
			fractionalizedCoinType,
			assetCoinType,
			lpCoinType: pool.lpCoinType,
			nftType,
		};
	};
}
