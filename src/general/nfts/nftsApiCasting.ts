import type { DisplayFieldsResponse } from "@mysten/sui/jsonRpc";
import type {
	KioskOwnerCapObject,
	Nft,
	NftDisplay,
	NftDisplayOther,
	NftDisplaySuggested,
	NftInfo,
} from "../types";
import { GrpcCasting, type SuiObjectView } from "../utils/grpcCasting";
import { Helpers } from "../utils/helpers";

export class NftsApiCasting {
	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public static nftsFromSuiObjects = (objects: SuiObjectView[]): Nft[] => {
		// @dev: gRPC returns `display: undefined` when `include.display` was not
		// requested and `null` when the object's type has no Display template.
		// Both mean "not an NFT we can render", exactly as a missing
		// `data.display` did under JSON-RPC.
		const nfts = objects.filter((object) => object.display);
		return nfts
			.map((nft) => NftsApiCasting.nftFromSuiObject(nft))
			.filter(
				(nft) =>
					Object.keys(nft.display.suggested).length > 0 ||
					Object.keys(nft.display.other).length > 0
			);
	};

	public static nftFromSuiObject = (object: SuiObjectView): Nft => {
		const info = this.nftInfoFromSuiObject(object);

		const displayFields = Helpers.getObjectDisplay(object);
		const display = this.nftDisplayFromDisplayFields(displayFields);

		return {
			info,
			display,
		};
	};

	public static kioskOwnerCapFromSuiObject = (
		object: SuiObjectView
	): KioskOwnerCapObject => {
		const fields = Helpers.getObjectFields(object);
		const objectId = Helpers.getObjectId(object);
		const objectType = Helpers.getObjectType(object);
		return {
			objectId,
			objectType,
			kioskObjectId: Helpers.addLeadingZeroesToType(fields.for),
		};
	};

	public static kioskOwnerCapFromPersonalKioskCapSuiObject = (
		object: SuiObjectView
	): KioskOwnerCapObject => {
		const fields = Helpers.getObjectFields(object);
		const objectId = Helpers.getObjectId(object);
		const objectType = Helpers.getObjectType(object);
		// @dev: `cap` is a nested `KioskOwnerCap` struct, so it lost JSON-RPC's
		// `{ type, fields }` envelope over gRPC.
		const cap = GrpcCasting.unwrapStructField(fields.cap);
		return {
			objectId,
			objectType,
			kioskObjectId: Helpers.addLeadingZeroesToType(cap.for),
		};
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	private static nftInfoFromSuiObject = (
		object: SuiObjectView
	): NftInfo => {
		const objectType = Helpers.getObjectType(object);
		const objectId = Helpers.getObjectId(object);

		if (!(objectId && objectType)) {
			throw new Error("unable to obtain object info from sui object response");
		}

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
		) {
			return {
				suggested: {},
				other: {},
			};
		}

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

		const suggested: NftDisplaySuggested = {};
		const other = Helpers.deepCopy(fields) as NftDisplayOther;

		for (const field of suggestedFields) {
			if (!(field.onChain in other)) {
				continue;
			}

			suggested[field.offChain] = other[field.onChain];
			delete other[field.onChain];
		}

		return {
			suggested,
			other,
		};
	};
}
