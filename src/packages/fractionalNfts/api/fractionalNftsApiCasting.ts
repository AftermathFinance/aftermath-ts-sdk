import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Helpers } from "../../../general/utils";
import {
	FractionalNftsKioskStorage,
	FractionalNftsPlainStorage,
	FractionalNftsVaultObject,
} from "../fractionalNftsTypes";
import {
	FractionalNftsVaultDisplayFieldsOnChain,
	FractionalNftsVaultFieldsOnChain,
	KioskStorageOnChain,
	PlainStorageOnChain,
} from "./fractionalNftsApiCastingTypes";
import { Coin } from "../..";

export class FractionalNftsApiCasting {
	// =========================================================================
	//  Public Methods
	// =========================================================================

	public static vaultObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): FractionalNftsVaultObject => {
		const objectId = Helpers.getObjectId(data);
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		) as FractionalNftsVaultFieldsOnChain;
		const displayFields = Helpers.getObjectDisplay(data)
			?.data! as unknown as FractionalNftsVaultDisplayFieldsOnChain;

		// TODO: move pattern to helpers or casting class
		const genericTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((type) => Helpers.addLeadingZeroesToType(type));

		return {
			objectId,
			objectType,
			nftType: genericTypes[1],
			fractionalCoinType: genericTypes[0],
			version: BigInt(fields.version),
			plainStorage: fields.plain_storage
				? this.plainStorageFromOnChain(fields.plain_storage)
				: undefined,
			kioskStorage: fields.kiosk_storage
				? this.kioskStorageFromOnChain(fields.kiosk_storage)
				: undefined,
			isKioskDepositEnabled: fields.kiosk_deposit_enabled,
			fractionalCoinSupply: BigInt(fields.supply.fields.value),
			fractionsAmount: BigInt(fields.fractions_amount),
			display: {
				name: displayFields.name,
				imageUrl: displayFields.image_url,
				thumbnailUrl: displayFields.thumbnail_url,
				projectUrl: displayFields.project_url,
				description: displayFields.description,
			},
		};
	};

	public static kioskStorageFromOnChain = (
		data: KioskStorageOnChain
	): FractionalNftsKioskStorage => {
		return {
			kiosk: {
				objectId: Helpers.addLeadingZeroesToType(data.kiosk.id),
				profits: BigInt(data.kiosk.profits),
				owner: Helpers.addLeadingZeroesToType(data.kiosk.owner),
				itemCount: BigInt(data.kiosk.item_count),
				allowExtensions: data.kiosk.allow_extensions,
			},
			ownerCap: {
				objectId: Helpers.addLeadingZeroesToType(data.owner_cap.id),
				forObjectId: Helpers.addLeadingZeroesToType(data.owner_cap.for),
			},
			balance: BigInt(data.balance),
			nftDefaultPrice: BigInt(data.nft_default_price),
		};
	};

	public static plainStorageFromOnChain = (
		data: PlainStorageOnChain
	): FractionalNftsPlainStorage => {
		return {
			nfts: {
				objectId: Helpers.addLeadingZeroesToType(data.nfts.id),
				size: BigInt(data.nfts.size),
			},
		};
	};
}
