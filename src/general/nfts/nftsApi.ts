import type {
	AnyObjectType,
	KioskObject,
	KioskOwnerCapObject,
	Nft,
	NftsAddresses,
	ObjectId,
	SuiAddress,
} from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";
import { Casting, Helpers } from "../utils";

/**
 * Fetches NFTs and kiosk data from Sui through the low-level `AftermathApi`.
 *
 * Every fetch method performs gRPC network I/O through the object and dynamic
 * field helpers. NFT reads request Display data and return only objects that
 * can be rendered by `NftsApiCasting`; missing Display output is filtered out.
 * Construct this class only with an `AftermathApi` that has the required NFT
 * package addresses.
 */
export class NftsApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	// private static readonly constants: {
	// 	objectTypes: {
	// 		kiosk: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk";
	// 		kioskOwnerCap: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap";
	// 	};
	// };

	// =========================================================================
	//  Class Members
	// =========================================================================

	/** NFT package addresses used to derive the personal-kiosk type. */
	public readonly addresses: NftsAddresses;
	/**
	 * Fully qualified Move types used by the NFT readers.
	 */
	public readonly objectTypes: {
		/** The personal-kiosk owner-cap type derived from `addresses`. */
		personalKioskCap: AnyObjectType;
	};

	/**
	 * Creates an NFT API for a configured low-level provider.
	 *
	 * @param api - The `AftermathApi` that supplies the gRPC object and dynamic
	 * field readers. Its `addresses.nfts` value must include
	 * `packages.mystenTransferPolicy`.
	 * @throws `Error` when the provider has no NFT addresses.
	 */
	constructor(private readonly api: AftermathApi) {
		if (!this.api.addresses.nfts) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.addresses = this.api.addresses.nfts;

		this.objectTypes = {
			personalKioskCap: `${this.addresses.packages.mystenTransferPolicy}::personal_kiosk::PersonalKioskCap`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	// =========================================================================
	//  Nft Objects
	// =========================================================================

	/**
	 * Fetches renderable NFTs owned by a wallet address.
	 *
	 * This method performs paginated gRPC object reads through
	 * `Objects().fetchOwnedObjects` and requests Display output. Objects without
	 * Display data, with Display errors, or with no non-empty display field are
	 * omitted by the caster.
	 *
	 * @param inputs - The owner's Sui address.
	 * @returns Renderable NFTs in the order returned by the object reader.
	 * @throws Errors from the gRPC object reader or NFT caster.
	 */
	public fetchOwnedNfts = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<Nft[]> => {
		const objects = await this.api.Objects().fetchOwnedObjects({
			...inputs,
			// @dev: `showDisplay` -> `withDisplay`, which becomes
			// `include: { display: true }`. `nftFromSuiObject` reads display, so
			// dropping this would leave every NFT with an empty one.
			withDisplay: true,
		});
		return Casting.nfts.nftsFromSuiObjects(objects);
	};

	/**
	 * Fetches and casts a batch of NFT object IDs.
	 *
	 * This method performs gRPC object reads in batches of at most 50 IDs and
	 * requests Display output. Missing object responses and objects that do not
	 * have usable Display fields are omitted from the returned array.
	 *
	 * @param inputs - The Sui object IDs to fetch.
	 * @returns Renderable NFTs for the successfully fetched IDs.
	 * @throws Errors from the gRPC object reader or NFT caster.
	 */
	public fetchNfts = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<Nft[]> => {
		const objects = await this.api.Objects().fetchObjectBatch({
			...inputs,
			withDisplay: true,
		});
		return Casting.nfts.nftsFromSuiObjects(objects);
	};

	// =========================================================================
	//  Kiosk Objects
	// =========================================================================

	/**
	 * Fetches regular and personal-kiosk owner caps owned by a wallet.
	 *
	 * This method performs two paginated gRPC owned-object queries: one for
	 * `0x2::kiosk::KioskOwnerCap` and one for the derived personal-kiosk cap
	 * type. The returned array concatenates the regular-cap results before the
	 * personal-cap results.
	 *
	 * @param inputs - The owner's Sui address.
	 * @returns Kiosk owner caps owned by the wallet.
	 * @throws Errors from either gRPC owned-object query or its casters.
	 */
	public fetchOwnedKioskOwnerCaps = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<KioskOwnerCapObject[]> => {
		const { walletAddress } = inputs;

		const [kioskOwnerCaps, personalKioskOwnerCaps] = await Promise.all([
			this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType:
					"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap",
				objectFromSuiObjectResponse: Casting.nfts.kioskOwnerCapFromSuiObject,
			}),
			this.api.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.personalKioskCap,
				objectFromSuiObjectResponse:
					Casting.nfts.kioskOwnerCapFromPersonalKioskCapSuiObject,
			}),
		]);
		return [...kioskOwnerCaps, ...personalKioskOwnerCaps];
	};

	/**
	 * Fetches renderable NFTs stored in a kiosk's dynamic fields.
	 *
	 * This method performs paginated gRPC dynamic-field reads and then fetches
	 * the referenced objects with Display output. The dynamic-field helper
	 * consumes all pages before the NFT object batch is loaded.
	 *
	 * @param inputs - The kiosk object ID used as the dynamic-field parent.
	 * @returns Renderable NFTs found in the kiosk.
	 * @throws Errors from dynamic-field, object, or NFT casting operations.
	 */
	public fetchNftsInKiosk = async (inputs: {
		kioskObjectId: ObjectId;
	}): Promise<Nft[]> => {
		const { kioskObjectId } = inputs;
		return this.api.DynamicFields().fetchCastAllDynamicFieldsOfType({
			parentObjectId: kioskObjectId,
			objectsFromObjectIds: (objectIds) => this.fetchNfts({ objectIds }),
		});
	};

	/**
	 * Fetches and casts kiosk owner caps from a list of object IDs.
	 *
	 * This method performs gRPC object-batch reads. It selects the regular or
	 * personal-kiosk caster from each object's Move type and drops per-object
	 * errors handled by the underlying batch reader.
	 *
	 * @param inputs - The owner-cap object IDs to fetch.
	 * @returns Cast kiosk owner caps for objects returned by gRPC.
	 * @throws Errors from a batch request or a caster.
	 */
	public fetchKioskOwnerCaps = async (inputs: {
		kioskOwnerCapIds: ObjectId[];
	}): Promise<KioskOwnerCapObject[]> => {
		const { kioskOwnerCapIds } = inputs;

		return this.api.Objects().fetchCastObjectBatch({
			objectIds: kioskOwnerCapIds,
			objectFromSuiObjectResponse: (object) =>
				object.type &&
				Helpers.addLeadingZeroesToType(object.type) ===
					this.objectTypes.personalKioskCap
					? Casting.nfts.kioskOwnerCapFromPersonalKioskCapSuiObject(object)
					: Casting.nfts.kioskOwnerCapFromSuiObject(object),
		});
	};

	/**
	 * Loads the NFTs for each kiosk represented by owner caps.
	 *
	 * This method performs gRPC dynamic-field and object reads by calling
	 * `fetchNftsInKiosk` once for each cap. The returned kiosks preserve the input
	 * cap order. `isPersonal` is `true` only when the cap's `objectType` equals
	 * `objectTypes.personalKioskCap`.
	 *
	 * @param inputs - The kiosk owner-cap objects to materialize.
	 * @returns One kiosk object per input cap, including its NFT list.
	 * @throws Errors from any kiosk NFT fetch.
	 */
	public fetchKiosks = async (inputs: {
		kioskOwnerCaps: KioskOwnerCapObject[];
	}): Promise<KioskObject[]> => {
		const { kioskOwnerCaps } = inputs;

		const nfts = await Promise.all(
			kioskOwnerCaps.map((kioskOwnerCap) =>
				this.fetchNftsInKiosk({
					kioskObjectId: kioskOwnerCap.kioskObjectId,
				})
			)
		);

		return kioskOwnerCaps.map((kioskOwnerCap, index) => ({
			objectId: kioskOwnerCap.kioskObjectId,
			objectType:
				"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk",
			kioskOwnerCapId: kioskOwnerCap.objectId,
			nfts: nfts[index],
			isPersonal:
				kioskOwnerCap.objectType === this.objectTypes.personalKioskCap,
		}));
	};

	/**
	 * Fetches owner caps by ID and materializes their kiosks.
	 *
	 * This method performs gRPC object, dynamic-field, and NFT Display reads by
	 * composing `fetchKioskOwnerCaps` and `fetchKiosks`.
	 *
	 * @param inputs - The regular or personal-kiosk owner-cap object IDs.
	 * @returns The materialized kiosk objects in owner-cap order.
	 * @throws Errors from the underlying gRPC reads or casters.
	 */
	public fetchKiosksFromOwnerCaps = async (inputs: {
		kioskOwnerCapIds: ObjectId[];
	}): Promise<KioskObject[]> => {
		const kioskOwnerCaps = await this.fetchKioskOwnerCaps(inputs);
		return this.fetchKiosks({ kioskOwnerCaps });
	};

	/**
	 * Fetches all kiosks owned by a wallet and loads their NFTs.
	 *
	 * This method performs paginated gRPC owned-object reads followed by dynamic
	 * field and NFT object reads for each kiosk. It includes both regular and
	 * personal kiosks and marks each result with `isPersonal`.
	 *
	 * @example
	 * ```typescript
	 * import { AftermathApi } from "aftermath-ts-sdk";
	 *
	 * declare const aftermathApi: AftermathApi;
	 * const kiosks = await aftermathApi.Nfts().fetchOwnedKiosks({
	 *	walletAddress: "0x00000000000000000000000000000000000000000000000000000000000000aa",
	 * });
	 * ```
	 *
	 * @param inputs - The wallet address whose kiosk owner caps are queried.
	 * @returns The wallet's kiosks and their renderable NFTs.
	 * @throws Errors from owned-object, dynamic-field, or NFT object reads.
	 */
	public fetchOwnedKiosks = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<KioskObject[]> => {
		const kioskOwnerCaps = await this.fetchOwnedKioskOwnerCaps(inputs);

		const nfts = await Promise.all(
			kioskOwnerCaps.map((kioskOwnerCap) =>
				this.fetchNftsInKiosk({
					kioskObjectId: kioskOwnerCap.kioskObjectId,
				})
			)
		);

		return kioskOwnerCaps.map((kioskOwnerCap, index) => ({
			objectId: kioskOwnerCap.kioskObjectId,
			objectType:
				"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk",
			kioskOwnerCapId: kioskOwnerCap.objectId,
			nfts: nfts[index],
			isPersonal:
				kioskOwnerCap.objectType === this.objectTypes.personalKioskCap,
		}));
	};
}
