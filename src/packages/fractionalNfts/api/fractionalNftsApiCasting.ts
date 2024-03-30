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
	KioskStorageFieldsOnChain,
	PlainStorageFieldsOnChain,
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
				? this.plainStorageFromFieldsOnChain(
						fields.plain_storage.fields
				  )
				: undefined,
			kioskStorage: fields.kiosk_storage
				? this.kioskStorageFromFieldsOnChain(
						fields.kiosk_storage.fields
				  )
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

	public static kioskStorageFromFieldsOnChain = (
		fields: KioskStorageFieldsOnChain
	): FractionalNftsKioskStorage => {
		return {
			kiosk: {
				objectId: Helpers.addLeadingZeroesToType(
					fields.kiosk.fields.id.id
				),
				profits: BigInt(fields.kiosk.fields.profits),
				owner: Helpers.addLeadingZeroesToType(
					fields.kiosk.fields.owner
				),
				itemCount: BigInt(fields.kiosk.fields.item_count),
				allowExtensions: fields.kiosk.fields.allow_extensions,
			},
			ownerCap: {
				objectId: Helpers.addLeadingZeroesToType(
					fields.owner_cap.fields.id.id
				),
				forObjectId: Helpers.addLeadingZeroesToType(
					fields.owner_cap.fields.for
				),
			},
			balance: BigInt(fields.balance),
			nftDefaultPrice: BigInt(fields.nft_default_price),
		};
	};

	public static plainStorageFromFieldsOnChain = (
		fields: PlainStorageFieldsOnChain
	): FractionalNftsPlainStorage => {
		return {
			nfts: {
				objectId: Helpers.addLeadingZeroesToType(
					fields.nfts.fields.id.id
				),
				size: BigInt(fields.nfts.fields.size),
			},
		};
	};
}
