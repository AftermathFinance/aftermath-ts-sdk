import { SupplyOnChain } from "../../../general/types/castingTypes";
import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface FractionalNftsVaultFieldsOnChain {
	version: BigIntAsString;
	plain_storage?: PlainStorageOnChain;
	kiosk_storage?: KioskStorageOnChain;
	kiosk_deposit_enabled: boolean;
	// TODO: find best way to handle this data
	// ids: LinkedSet<ID>,
	supply: SupplyOnChain;
	fractions_amount: BigIntAsString;
}

export interface KioskStorageOnChain {
	kiosk: {
		id: ObjectId;
		profits: BigIntAsString;
		owner: SuiAddress;
		item_count: BigIntAsString;
		allow_extensions: boolean;
	};
	owner_cap: {
		id: ObjectId;
		for: ObjectId;
	};
	balance: BigIntAsString;
	nft_default_price: BigIntAsString;
}

export interface PlainStorageOnChain {
	nfts: {
		id: ObjectId;
		size: BigIntAsString;
	};
}
