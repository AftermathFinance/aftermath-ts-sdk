import { AnyObjectType, Object, ObjectId, Url } from "../types/generalTypes.ts";

// =========================================================================
//  Objects
// =========================================================================

export interface KioskOwnerCapObject extends Object {
	kioskObjectId: ObjectId;
}

export interface KioskObject extends Object {
	kioskOwnerCapId: ObjectId;
	nfts: Nft[];
	isPersonal: boolean;
}

// =========================================================================
//  Object Display
// =========================================================================

export interface Nft {
	info: NftInfo;
	display: NftDisplay;
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
