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

/**
 * Converts gRPC object views into NFT and kiosk domain objects.
 *
 * All methods are local casts. They perform no network I/O and expect the
 * caller to have requested the gRPC `json` view. NFT methods also require the
 * Display view when they need to read `display`.
 */
export class NftsApiCasting {
	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Casts and filters a list of gRPC object views into renderable NFTs.
	 *
	 * Objects without a Display response are omitted. Objects whose Display
	 * response has no suggested or other fields are also omitted. The remaining
	 * objects preserve input order.
	 *
	 * @param objects - gRPC object views with JSON and Display data requested.
	 * @returns Renderable NFT objects in input order.
	 * @throws Errors from the NFT caster when an included object lacks identity.
	 */
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

	/**
	 * Casts one gRPC object view into an NFT.
	 *
	 * Display data with an error or no output becomes empty `suggested` and
	 * `other` maps. This method does not filter the result, so it can return an
	 * NFT with empty display maps even though `nftsFromSuiObjects` would omit it.
	 *
	 * @param object - The gRPC object view with JSON and Display data.
	 * @returns The object's identity and normalized Display fields.
	 * @throws `Error` when the object ID or Move type is absent.
	 */
	public static nftFromSuiObject = (object: SuiObjectView): Nft => {
		const info = this.nftInfoFromSuiObject(object);

		const displayFields = Helpers.getObjectDisplay(object);
		const display = this.nftDisplayFromDisplayFields(displayFields);

		return {
			info,
			display,
		};
	};

	/**
	 * Casts a regular `KioskOwnerCap` gRPC object view.
	 *
	 * The gRPC JSON view must contain the cap's `for` field. The field is
	 * normalized to a zero-padded object ID, and the returned object keeps the
	 * source object's ID and Move type.
	 *
	 * @param object - A gRPC object view for
	 * `0x2::kiosk::KioskOwnerCap`.
	 * @returns The owner cap and the kiosk object ID it controls.
	 * @throws `Error` when the object identity, type, or `for` field is missing.
	 */
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

	/**
	 * Casts a Mysten personal-kiosk owner-cap gRPC object view.
	 *
	 * The gRPC JSON view must contain `cap.for`. The nested `cap` struct is
	 * unwrapped before the kiosk ID is normalized to a zero-padded object ID.
	 *
	 * @param object - A gRPC object view for the personal-kiosk cap type.
	 * @returns The owner cap and the personal kiosk object ID it controls.
	 * @throws `Error` when the object identity, type, nested cap, or `for` field
	 * is missing.
	 */
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
