import { AftermathApi } from "../providers/aftermathApi";
import {
	KioskObject,
	KioskOwnerCapObject,
	Nft,
	ObjectId,
	SuiAddress,
} from "../../types";
import { Helpers } from "../utils";
import { NftsApiCasting } from "./nftsApiCasting";

export class NftsApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants: {
		objectTypes: {
			kiosk: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk";
			kioskOwnerCap: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap";
		};
	};

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
		const nfts = objects.filter(
			(object) => object.data?.display !== undefined
		);
		return nfts.map((nft) => NftsApiCasting.nftFromSuiObject(nft));
	};

	public fetchNfts = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<Nft[]> => {
		return this.Provider.Objects().fetchCastObjectBatch({
			...inputs,
			objectFromSuiObjectResponse: NftsApiCasting.nftFromSuiObject,
			options: {
				// NOTE: do we need all of this ?
				showContent: true,
				showOwner: true,
				showType: true,
				showDisplay: true,
			},
		});
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
			objectType: NftsApi.constants.objectTypes.kioskOwnerCap,
			objectFromSuiObjectResponse: (data) => {
				const fields = Helpers.getObjectFields(data);
				const objectId = Helpers.getObjectId(data);
				const objectType = Helpers.getObjectType(data);
				return {
					objectId,
					objectType,
					kioskObjectId: Helpers.addLeadingZeroesToType(fields.for),
				};
			},
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

	public fetchOwnedKiosks = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<KioskObject[]> => {
		const kioskOwnerCaps = await this.fetchOwnedKioskOwnerCaps(inputs);

		const nfts = await Promise.all(
			kioskOwnerCaps.map((kioskOwnerCap) =>
				this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType({
					parentObjectId: kioskOwnerCap.kioskObjectId,
					objectsFromObjectIds: (objectIds) =>
						this.fetchNfts({ objectIds }),
				})
			)
		);

		return kioskOwnerCaps.map((kioskOwnerCap, index) => ({
			objectId: kioskOwnerCap.kioskObjectId,
			objectType: NftsApi.constants.objectTypes.kiosk,
			kioskOwnerCapId: kioskOwnerCap.objectId,
			nfts: nfts[index],
		}));
	};
}
