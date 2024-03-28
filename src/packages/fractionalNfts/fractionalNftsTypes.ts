import {
	AnyObjectType,
	Balance,
	CoinType,
	Object,
	ObjectId,
	SuiAddress,
} from "../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface FractionalNftsVaultObject extends Object {
	/**
	 * Protocol version.
	 */
	version: bigint;
	/**
	 * Bag based NFT storage.
	 */
	plainStorage?: FractionalNftsPlainStorage;
	/**
	 * Kiosk based NFT storage.
	 */
	kioskStorage?: FractionalNftsKioskStorage;
	/**
	 * Is depositing to the kiosk based storage enabled.
	 */
	isKioskDepositEnabled: boolean;
	/**
	 * Vault has possibility to mint fractionalized coins.
	 */
	fractionalCoinSupply: Balance;
	/**
	 * Token fractions amount.
	 */
	fractionsAmount: Balance;
	nftType: AnyObjectType;
	fractionalCoinType: CoinType;
}

export interface FractionalNftsKioskStorage {
	kiosk: {
		objectId: ObjectId;
		profits: Balance;
		owner: SuiAddress;
		itemCount: bigint;
		allowExtensions: boolean;
	};
	ownerCap: {
		objectId: ObjectId;
		forObjectId: ObjectId;
	};
	balance: Balance;
	nftDefaultPrice: Balance;
}

export interface FractionalNftsPlainStorage {
	nfts: {
		objectId: ObjectId;
		size: bigint;
	};
}

// =========================================================================
//  API
// =========================================================================
