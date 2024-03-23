import { Balance, Object, ObjectId, SuiAddress } from "../../types";

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
}

export interface FractionalNftsKioskStorage {
	kiosk: {
		id: ObjectId;
		profits: Balance;
		owner: SuiAddress;
		itemCount: bigint;
		allowExtensions: boolean;
	};
	ownerCap: {
		id: ObjectId;
		for: ObjectId;
	};
	balance: Balance;
	nftDefaultPrice: Balance;
}

export interface FractionalNftsPlainStorage {
	nfts: {
		id: ObjectId;
		size: bigint;
	};
}

// =========================================================================
//  API
// =========================================================================
