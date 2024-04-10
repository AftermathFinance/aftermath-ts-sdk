import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Helpers } from "../../../general/utils";
import {
	FractionalNftsDepositedEvent,
	FractionalNftsKioskStorage,
	FractionalNftsPlainStorage,
	FractionalNftsVaultObject,
	FractionalNftsWithdrawnEvent,
} from "../fractionalNftsTypes";
import {
	FractionalNftsDepositedEventOnChain,
	FractionalNftsVaultDisplayFieldsOnChain,
	FractionalNftsVaultFieldsOnChain,
	FractionalNftsWithdrawnEventOnChain,
	KioskStorageFieldsOnChain,
	PlainStorageFieldsOnChain,
} from "./fractionalNftsApiCastingTypes";
import { Coin } from "../..";

export class FractionalNftsApiCasting {
	// =========================================================================
	//  Objects
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

	public static depositedEventFromOnChain = (
		eventOnChain: FractionalNftsDepositedEventOnChain
	): FractionalNftsDepositedEvent => {
		// TODO: move to casting class
		const coinTypes = Coin.getInnerCoinType(eventOnChain.type)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = eventOnChain.parsedJson;
		return {
			fractionalCoinType: coinTypes[0],
			nftType: coinTypes[1],
			vaultId: fields.vault_id,
			nftIds: fields.nft_ids,
			mintedFractionAmount: BigInt(fields.minted_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static withdrawnEventFromOnChain = (
		eventOnChain: FractionalNftsWithdrawnEventOnChain
	): FractionalNftsWithdrawnEvent => {
		const coinTypes = Coin.getInnerCoinType(eventOnChain.type)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = eventOnChain.parsedJson;
		return {
			fractionalCoinType: coinTypes[0],
			nftType: coinTypes[1],
			vaultId: fields.vault_id,
			nftIds: fields.nft_ids,
			burnedFractionAmount: BigInt(fields.burned_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private static kioskStorageFromFieldsOnChain = (
		fields: KioskStorageFieldsOnChain
	): FractionalNftsKioskStorage => {
		return {
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

	private static plainStorageFromFieldsOnChain = (
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
