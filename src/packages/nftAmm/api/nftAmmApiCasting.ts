import {
	DisplayFieldsResponse,
	SuiObjectResponse,
	getObjectDisplay,
} from "@mysten/sui.js";
import {
	NftDisplay,
	NftInfo,
	Nft,
	OtherNftDisplay,
	SuggestedNftDisplay,
} from "../nftAmmTypes";
import { Helpers } from "../../../general/utils";

export class NftAmmApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static nftFromSuiObjectResponse = (
		object: SuiObjectResponse
	): Nft => {
		const info = this.nftInfoFromSuiObjectResponse(object);

		const displayFields = getObjectDisplay(object);
		const display = this.nftDisplayFromDisplayFieldsResponse(displayFields);

		return {
			info,
			display,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	private static nftInfoFromSuiObjectResponse = (
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

	private static nftDisplayFromDisplayFieldsResponse = (
		displayFields: DisplayFieldsResponse
	): NftDisplay => {
		const fields = displayFields.data;
		if (fields === null || displayFields.error !== null)
			return {
				suggested: {},
				other: {},
			};

		const suggestedFields: {
			offChain: keyof SuggestedNftDisplay;
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

		let suggested: SuggestedNftDisplay = {};
		let other: OtherNftDisplay = Helpers.deepCopy(fields);

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
