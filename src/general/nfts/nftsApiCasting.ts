import {
	DisplayFieldsResponse,
	SuiObjectResponse,
} from "@mysten/sui.js/client";
import {
	Nft,
	NftDisplay,
	NftDisplayOther,
	NftDisplaySuggested,
	NftInfo,
} from "../types";
import { Helpers } from "../utils/helpers";

export class NftsApiCasting {
	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

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
			if (!(field.onChain in other)) continue;

			suggested[field.offChain] = other[field.onChain];
			delete other[field.onChain];
		}

		return {
			suggested,
			other,
		};
	};
}
