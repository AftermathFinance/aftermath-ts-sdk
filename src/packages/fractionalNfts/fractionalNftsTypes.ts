import {
	AnyObjectType,
	Balance,
	CoinType,
	Event,
	Object,
	ObjectId,
	SuiAddress,
	Url,
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
	display: {
		name: string;
		imageUrl: Url;
		thumbnailUrl: Url;
		projectUrl: Url;
		description: string;
	};
}

export interface FractionalNftsKioskStorage {
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
//  Events
// =========================================================================

export interface FractionalNftsDepositedEvent extends Event {
	vaultId: ObjectId;
	nftIds: ObjectId[];
}

export interface FractionalNftsWithdrawnEvent extends Event {
	vaultId: ObjectId;
	nftIds: ObjectId[];
}
