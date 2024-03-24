import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Helpers } from "../../../general/utils";
import {
	FractionalNftsKioskStorage,
	FractionalNftsPlainStorage,
	FractionalNftsVaultObject,
} from "../fractionalNftsTypes";
import {
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
		};
	};

	public static kioskStorageFromOnChain = (
		data: KioskStorageOnChain
	): FractionalNftsKioskStorage => {
		return {
			kiosk: {
				id: Helpers.addLeadingZeroesToType(data.kiosk.id),
				profits: BigInt(data.kiosk.profits),
				owner: Helpers.addLeadingZeroesToType(data.kiosk.owner),
				itemCount: BigInt(data.kiosk.item_count),
				allowExtensions: data.kiosk.allow_extensions,
			},
			ownerCap: {
				id: Helpers.addLeadingZeroesToType(data.owner_cap.id),
				for: Helpers.addLeadingZeroesToType(data.owner_cap.for),
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
				id: Helpers.addLeadingZeroesToType(data.nfts.id),
				size: BigInt(data.nfts.size),
			},
		};
	};
}
