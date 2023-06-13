import {
	DisplayFieldsResponse,
	SuiObjectResponse,
	getObjectDisplay,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
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
		const objectId = getObjectId(suiObject);
		const marketType = getObjectType(suiObject);
		if (!marketType) throw new Error("no object type found");

		const fields = getObjectFields(suiObject) as NftAmmMarketFieldsOnChain;

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

		const displayFields = getObjectDisplay(object);
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
		if (object.error !== undefined || object.data === undefined)
			throw new Error(
				"unable to obtain object info from sui object response"
			);

		return {
			objectId: object.data.objectId,
			version: object.data.version,
			digest: object.data.digest,
			type: object.data.type,
		};
	};

	private static nftDisplayFromDisplayFields = (
		displayFields: DisplayFieldsResponse
	): NftDisplay => {
		const fields = displayFields.data;
		if (fields === null || displayFields.error !== null)
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
