import { ObjectId, TransactionDigest } from "@mysten/sui.js";
import { AnyObjectType, Url } from "../../types";

/////////////////////////////////////////////////////////////////////
//// Object Display
/////////////////////////////////////////////////////////////////////

export interface ObjectInfoWithDisplay {
	info: ObjectInfo;
	display?: ObjectDisplay;
}

export interface ObjectInfo {
	objectId: ObjectId;
	version: string;
	digest: TransactionDigest;
	type?: AnyObjectType;
}

export interface ObjectDisplay {
	suggested?: SuggestedObjectDisplay;
	other?: OtherObjectDisplay;
}

export interface SuggestedObjectDisplay {
	name?: string;
	link?: Url;
	imageUrl?: Url;
	description?: string;
	projectUrl?: Url;
	creator?: string;
}

export type OtherObjectDisplay = Record<string, string>;
