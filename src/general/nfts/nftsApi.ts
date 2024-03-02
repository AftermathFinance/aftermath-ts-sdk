import { AftermathApi } from "../providers/aftermathApi";
import {
	KioskObject,
	KioskOwnerCapObject,
	Nft,
	ObjectId,
	SuiAddress,
} from "../../types";
import { Casting, Helpers } from "../utils";
import { NftsApiCasting } from "./nftsApiCasting";

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

	constructor(private readonly Provider: AftermathApi) {}

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
		const objects = await this.Provider.Objects().fetchOwnedObjects({
			...inputs,
			options: {
				// NOTE: do we need all of this ?
				showContent: true,
				showOwner: true,
				showType: true,
				showDisplay: true,
			},
		});
		return Casting.nfts.nftsFromSuiObjects(objects);
	};

	public fetchNfts = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<Nft[]> => {
		const objects = await this.Provider.Objects().fetchObjectBatch({
			...inputs,
			options: {
				// NOTE: do we need all of this ?
				showContent: true,
				showOwner: true,
				showType: true,
				showDisplay: true,
			},
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

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType:
				"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap",
			objectFromSuiObjectResponse:
				Casting.nfts.kioskOwnerCapFromSuiObject,
		});
	};

	public fetchNftsInKiosk = async (inputs: {
		kioskObjectId: ObjectId;
	}): Promise<Nft[]> => {
		const { kioskObjectId } = inputs;
		return this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType({
			parentObjectId: kioskObjectId,
			objectsFromObjectIds: (objectIds) => this.fetchNfts({ objectIds }),
		});
	};

	public fetchKioskOwnerCaps = async (inputs: {
		kioskOwnerCapIds: ObjectId[];
	}): Promise<KioskOwnerCapObject[]> => {
		const { kioskOwnerCapIds } = inputs;

		return this.Provider.Objects().fetchCastObjectBatch({
			objectIds: kioskOwnerCapIds,
			objectFromSuiObjectResponse:
				Casting.nfts.kioskOwnerCapFromSuiObject,
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
		}));
	};
}
