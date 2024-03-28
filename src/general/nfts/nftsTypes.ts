import { AnyObjectType, Object, ObjectId, Url } from "../types/generalTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface KioskOwnerCapObject extends Object {
	kioskId: ObjectId;
}

export interface KioskObject extends Object {
	kioskOwnerCapId: ObjectId;
	nfts: Nft[];
}

// =========================================================================
//  Object Display
// =========================================================================

export interface Nft {
	info: NftInfo;
	display: NftDisplay;
	kiosk?: {
		kioskId: ObjectId;
		kioskOwnerCapId: ObjectId;
	};
}

export interface NftInfo {
	objectId: ObjectId;
	// version: string;
	// digest: TransactionDigest;
	objectType: AnyObjectType;
}

export interface NftDisplay {
	suggested: NftDisplaySuggested;
	other: NftDisplayOther;
}

export interface NftDisplaySuggested {
	name?: string;
	link?: Url;
	imageUrl?: Url;
	description?: string;
	projectUrl?: Url;
	creator?: string;
}

export type NftDisplayOther = Record<string, string>;
