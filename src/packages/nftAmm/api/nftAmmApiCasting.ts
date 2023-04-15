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
		const nftDisplay =
			this.nftDisplayFromDisplayFieldsResponse(displayFields);
		const display =
			Object.keys(nftDisplay).length === 0 ? undefined : nftDisplay;

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
		if (fields === null || displayFields.error !== null) return {};

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

		let suggested: SuggestedNftDisplay | undefined = {};
		let other: OtherNftDisplay | undefined = Helpers.deepCopy(fields);

		for (const field of suggestedFields) {
			if (!(field.onChain in field)) continue;

			suggested[field.offChain] = fields[field.onChain];
			delete other[field.offChain];
		}

		if (Object.keys(suggested).length === 0) suggested = undefined;
		if (Object.keys(other).length === 0) other = undefined;

		return {
			suggested,
			other,
		};
	};
}
