import {
	DisplayFieldsResponse,
	SuiObjectResponse,
	getObjectDisplay,
} from "@mysten/sui.js";
import {
	ObjectDisplay,
	ObjectInfo,
	ObjectInfoWithDisplay,
	OtherObjectDisplay,
	SuggestedObjectDisplay,
} from "../nftAmmTypes";
import { Helpers } from "../../../general/utils";

export class NftAmmApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Object Display
	/////////////////////////////////////////////////////////////////////

	public static objectInfoWithDisplayFromSuiObjectResponse = (
		object: SuiObjectResponse
	): ObjectInfoWithDisplay => {
		const info = this.objectInfoFromSuiObjectResponse(object);

		const displayFields = getObjectDisplay(object);
		const objectDisplay =
			this.objectDisplayFromDisplayFieldsResponse(displayFields);
		const display =
			Object.keys(objectDisplay).length === 0 ? undefined : objectDisplay;

		return {
			info,
			display,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Object Display
	/////////////////////////////////////////////////////////////////////

	public static objectInfoFromSuiObjectResponse = (
		object: SuiObjectResponse
	): ObjectInfo => {
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

	private static objectDisplayFromDisplayFieldsResponse = (
		displayFields: DisplayFieldsResponse
	): ObjectDisplay => {
		const fields = displayFields.data;
		if (fields === null || displayFields.error !== null) return {};

		const suggestedFields: {
			offChain: keyof SuggestedObjectDisplay;
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

		let suggested: SuggestedObjectDisplay | undefined = {};
		let other: OtherObjectDisplay | undefined = Helpers.deepCopy(fields);

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
