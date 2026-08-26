import type {
	AnyObjectType,
	Object,
	ObjectId,
	Url,
} from "../types/generalTypes";

// =========================================================================
//  Objects
// =========================================================================

/**
 * A kiosk owner-cap object with the ID of the kiosk it controls.
 *
 * The object identity and `objectType` fields come from the Sui object. The
 * `kioskObjectId` value is normalized to a zero-padded Sui object ID.
 */
export interface KioskOwnerCapObject extends Object {
	/** The object ID of the kiosk controlled by this owner cap. */
	kioskObjectId: ObjectId;
}

/**
 * A kiosk object and the NFTs currently stored in it.
 */
export interface KioskObject extends Object {
	/** The object ID of the owner cap used to access this kiosk. */
	kioskOwnerCapId: ObjectId;
	/** The renderable NFTs found in the kiosk's dynamic fields. */
	nfts: Nft[];
	/** Whether the kiosk uses Mysten's personal-kiosk owner-cap type. */
	isPersonal: boolean;
}

// =========================================================================
//  Object Display
// =========================================================================

/**
 * An NFT assembled from a Sui object identity and its Display fields.
 */
export interface Nft {
	/** The on-chain object identity and Move type. */
	info: NftInfo;
	/** Suggested standard display fields and any remaining display fields. */
	display: NftDisplay;
}

/**
 * The on-chain identity and Move type of an NFT.
 */
export interface NftInfo {
	/** The NFT object's Sui object ID. */
	objectId: ObjectId;
	// version: string;
	// digest: TransactionDigest;
	/** The fully qualified Move type of the NFT object. */
	objectType: AnyObjectType;
}

/**
 * Display data split into common fields and application-specific fields.
 */
export interface NftDisplay {
	/** Common display fields mapped from the on-chain Display template. */
	suggested: NftDisplaySuggested;
	/** Remaining string display fields, keyed by their original on-chain names. */
	other: NftDisplayOther;
}

/**
 * Common NFT display fields.
 *
 * The caster maps `image_url` to `imageUrl` and `project_url` to `projectUrl`.
 * Each field is optional because Display templates may omit it or return a
 * field-level error.
 */
export interface NftDisplaySuggested {
	/** The NFT's display name. */
	name?: string;
	/** A link associated with the NFT. */
	link?: Url;
	/** The NFT image URL. */
	imageUrl?: Url;
	/** The NFT description. */
	description?: string;
	/** The project or collection URL. */
	projectUrl?: Url;
	/** The creator name or identifier. */
	creator?: string;
}

/**
 * String-valued Display fields that do not map to `NftDisplaySuggested`.
 */
export type NftDisplayOther = Record<string, string>;
