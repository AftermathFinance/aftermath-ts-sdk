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

	public readonly addresses: NftsAddresses;
	public readonly objectTypes: {
		personalKioskCap: AnyObjectType;
	};

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

	public fetchNftsInKiosk = async (inputs: {
		kioskObjectId: ObjectId;
	}): Promise<Nft[]> => {
		const { kioskObjectId } = inputs;
		return this.api.DynamicFields().fetchCastAllDynamicFieldsOfType({
			parentObjectId: kioskObjectId,
			objectsFromObjectIds: (objectIds) => this.fetchNfts({ objectIds }),
		});
	};

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

	public fetchKiosksFromOwnerCaps = async (inputs: {
		kioskOwnerCapIds: ObjectId[];
	}): Promise<KioskObject[]> => {
		const kioskOwnerCaps = await this.fetchKioskOwnerCaps(inputs);
		return this.fetchKiosks({ kioskOwnerCaps });
	};

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
