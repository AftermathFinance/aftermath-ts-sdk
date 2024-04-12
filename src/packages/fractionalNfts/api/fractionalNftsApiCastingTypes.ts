import {
	EventOnChain,
	SupplyOnChain,
} from "../../../general/types/castingTypes";
import { BigIntAsString, ObjectId, SuiAddress, Url } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface FractionalNftsVaultFieldsOnChain {
	version: BigIntAsString;
	plain_storage?: {
		fields: PlainStorageFieldsOnChain;
	};
	kiosk_storage?: {
		fields: KioskStorageFieldsOnChain;
	};
	kiosk_deposit_enabled: boolean;
	// TODO: find best way to handle this data
	// ids: LinkedSet<ID>,
	fractions_amount: BigIntAsString;
}

export interface FractionalNftsVaultDisplayFieldsOnChain {
	name: string;
	image_url: Url;
	thumbnail_url: Url;
	project_url: Url;
	description: string;
}

export interface KioskStorageFieldsOnChain {
	owner_cap: {
		fields: {
			id: {
				id: ObjectId;
			};
			for: ObjectId;
		};
	};
	balance: BigIntAsString;
	nft_default_price: BigIntAsString;
}

export interface PlainStorageFieldsOnChain {
	nfts: {
		fields: {
			id: {
				id: ObjectId;
			};
			size: BigIntAsString;
		};
	};
}

// =========================================================================
//  Events
// =========================================================================

export type FractionalNftsDepositedEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	nft_ids: ObjectId[];
	minted_amount: BigIntAsString;
}>;

export type FractionalNftsWithdrawnEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	nft_ids: ObjectId[];
	burned_amount: BigIntAsString;
}>;
