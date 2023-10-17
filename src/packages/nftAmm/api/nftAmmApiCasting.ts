import {
	NftDisplay,
	NftInfo,
	Nft,
	NftDisplayOther,
	NftDisplaySuggested,
	NftAmmMarketObject,
} from "../nftAmmTypes";
import { Helpers } from "../../../general/utils";
import { NftAmmMarketFieldsOnChain } from "./nftAmmApiCastingTypes";
import { Coin } from "../../coin";
import { PoolsApiCasting } from "../../pools/api/poolsApiCasting";
import {
	DisplayFieldsResponse,
	SuiObjectResponse,
} from "@mysten/sui.js/client";

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

		const fractionalizedCoinType = new Coin(fields.supply.type)
			.innerCoinType;

		const innerMarketTypes = new Coin(marketType).innerCoinType;
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

	public static nftFromSuiObject = (object: SuiObjectResponse): Nft => {
		const info = this.nftInfoFromSuiObject(object);

		const displayFields = Helpers.getObjectDisplay(object);
		const display = this.nftDisplayFromDisplayFields(displayFields);

		return {
			info,
			display,
		};
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	private static nftInfoFromSuiObject = (
		object: SuiObjectResponse
	): NftInfo => {
		const objectType = Helpers.getObjectType(object);
		const objectId = Helpers.getObjectId(object);

		if (!objectId || !objectType)
			throw new Error(
				"unable to obtain object info from sui object response"
			);

		return {
			objectId,
			objectType,
		};
	};

	private static nftDisplayFromDisplayFields = (
		displayFields: DisplayFieldsResponse
	): NftDisplay => {
		const fields = displayFields.data;
		if (
			fields === null ||
			fields === undefined ||
			displayFields.error !== null
		)
			return {
				suggested: {},
				other: {},
			};

		const suggestedFields: {
			offChain: keyof NftDisplaySuggested;
			onChain: string;
		}[] = [
			{
				onChain: "name",
				offChain: "name",
			},
			{
				onChain: "link",
				offChain: "link",
			},
			{
				onChain: "image_url",
				offChain: "imageUrl",
			},
			{
				onChain: "description",
				offChain: "description",
			},
			{
				onChain: "project_url",
				offChain: "projectUrl",
			},
			{
				onChain: "creator",
				offChain: "creator",
			},
		];

		let suggested: NftDisplaySuggested = {};
		let other: NftDisplayOther = Helpers.deepCopy(fields);

		for (const field of suggestedFields) {
			if (!(field.onChain in field)) continue;

			suggested[field.offChain] = fields[field.onChain];
			delete other[field.offChain];
		}

		return {
			suggested,
			other,
		};
	};
}
