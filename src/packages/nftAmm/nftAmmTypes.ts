import { ObjectId, TransactionDigest } from "@mysten/sui.js";
import { AnyObjectType, Url } from "../../types";

/////////////////////////////////////////////////////////////////////
//// Object Display
/////////////////////////////////////////////////////////////////////

export interface Nft {
	info: NftInfo;
	display: NftDisplay;
}

export interface NftInfo {
	objectId: ObjectId;
	version: string;
	digest: TransactionDigest;
	type?: AnyObjectType;
}

export interface NftDisplay {
	suggested: SuggestedNftDisplay;
	other: OtherNftDisplay;
}

export interface SuggestedNftDisplay {
	name?: string;
	link?: Url;
	imageUrl?: Url;
	description?: string;
	projectUrl?: Url;
	creator?: string;
}

export type OtherNftDisplay = Record<string, string>;
