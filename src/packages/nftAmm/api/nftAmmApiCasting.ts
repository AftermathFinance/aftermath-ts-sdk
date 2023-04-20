import {
	DisplayFieldsResponse,
	SuiObjectResponse,
	getObjectDisplay,
} from "@mysten/sui.js";
import {
	NftDisplay,
	NftInfo,
	Nft,
	NftDisplayOther,
	NftDisplaySuggested,
	MarketObject,
} from "../nftAmmTypes";
import { Helpers } from "../../../general/utils";

export class NftAmmApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static marketObjectFromSuiObject = (
		suiObject: SuiObjectResponse
	): MarketObject => {
		const objectId = getObjectId(suiObject);

		const poolFieldsOnChain = getObjectFields(
			suiObject
		) as PoolFieldsOnChain;

		const lpCoinType = new Coin(poolFieldsOnChain.lp_supply.type)
			.innerCoinType;

		const coins: PoolCoins = poolFieldsOnChain.type_names.reduce(
			(acc, cur, index) => {
				return {
					...acc,
					["0x" + cur]: {
						weight: BigInt(poolFieldsOnChain.weights[index]),
						balance: BigInt(poolFieldsOnChain.balances[index]),
						tradeFeeIn: BigInt(
							poolFieldsOnChain.fees_swap_in[index]
						),
						tradeFeeOut: BigInt(
							poolFieldsOnChain.fees_swap_out[index]
						),
						depositFee: BigInt(
							poolFieldsOnChain.fees_deposit[index]
						),
						withdrawFee: BigInt(
							poolFieldsOnChain.fees_withdraw[index]
						),
					},
				};
			},
			{} as PoolCoins
		);

		return {
			objectId,
			lpCoinType: lpCoinType,
			name: poolFieldsOnChain.name,
			creator: poolFieldsOnChain.creator,
			lpCoinSupply: BigInt(poolFieldsOnChain.lp_supply.fields.value),
			illiquidLpCoinSupply: BigInt(poolFieldsOnChain.illiquid_lp_supply),
			flatness: BigInt(poolFieldsOnChain.flatness),
			coins,
		};
	};

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
