import {
	AnyObjectType,
	Balance,
	Event,
	Object,
	Timestamp,
	Url,
	ObjectId,
	SuiAddress,
} from "../../general/types/generalTypes";

// =========================================================================
//  Name Only
// =========================================================================

/** String identifier for a SuiFren accessory's on-chain type. */
export type SuiFrenAccessoryType = string;

/** Display name assigned to a SuiFren accessory. */
export type SuiFrenAccessoryName = string;

// =========================================================================
//  Objects
// =========================================================================

/** Current CapyLabs application configuration and accounting object. */
export interface CapyLabsAppObject extends Object {
	/** Maximum mix count stored by the application, as a `bigint`. */
	mixingLimit: bigint;
	/** Number of Sui epochs in the application's mixing cooldown period. */
	coolDownPeriodEpochs: bigint;
	/** Mixing price in the configured payment coin's smallest unit. */
	mixingPrice: Balance;
	/** Accumulated SUI profits in the payment coin's smallest unit. */
	suiProfits: Balance;
}

/** Complete public representation of a SuiFren object. */
export interface SuiFrenObject extends Object {
	// object fields
	/** Generation number assigned to the SuiFren. */
	generation: bigint;
	/** Birth timestamp in milliseconds since the Unix epoch. */
	birthdate: Timestamp;
	/** Cohort number assigned to the SuiFren. */
	cohort: bigint;
	/** Raw gene values decoded from the on-chain gene vector. */
	genes: bigint[];
	/** Cosmetic attributes decoded from the on-chain attribute vector. */
	attributes: SuiFrenAttributes;
	/** Human-readable location recorded at birth. */
	birthLocation: string;

	// dynamic fields
	/** Remaining mix count, or `undefined` when the object has no value. */
	mixLimit?: bigint;
	/** Last Sui epoch in which the object was mixed, or `undefined` when absent. */
	lastEpochMixed?: bigint;

	// display fields
	/** Display metadata returned with the object response. */
	display: {
		/** External link for the SuiFren. */
		link: Url;
		/** Image URL returned by the object display data. */
		imageUrl: Url;
		/** Human-readable object description. */
		description: string;
		/** Project URL returned by the object display data. */
		projectUrl: Url;
	};
}

/** A SuiFren object before optional dynamic fields are inspected. */
export type PartialSuiFrenObject = Omit<
	SuiFrenObject,
	"mixLimit" | "lastEpochMixed"
>;

/** Cosmetic attribute values decoded from a SuiFren object. */
export type SuiFrenAttributes = {
	/** Skin pattern. The current on-chain values are `stripes` or `cheetah`. */
	skin: "stripes" | "cheetah";
	/** Main color code without a leading `#`. */
	main: "6FBBEE";
	/** Secondary color code without a leading `#`. */
	secondary: "CF9696";
	/** Facial expression identifier. */
	expression: "bigSmile";
	/** Ear style identifier. */
	ears: "ear1";
};

/** Sort values accepted by the filtered staked-SuiFren query. */
export enum SuiFrensSortOption {
	/** Sort by price from low to high. */
	PriceLowToHigh = "Price (low to high)",
	/** Sort by price from high to low. */
	PriceHighToLow = "Price (high to low)",
}

/** A staked SuiFren together with its vault metadata and optional position. */
export interface StakedSuiFrenInfo {
	/** Complete SuiFren data associated with the stake. */
	suiFren: SuiFrenObject;
	/** Vault metadata that stores stake fees and mix settings. */
	metadata: StakedSuiFrenMetadataV1Object;
	/** Owned staked-position object, when the caller fetched owned positions. */
	position?: StakedSuiFrenPositionObject;
}

/** On-chain position object that links an owner to a staked SuiFren. */
export interface StakedSuiFrenPositionObject extends Object {
	/** ID of the SuiFren represented by the position. */
	suiFrenId: ObjectId;
}

/** Vault metadata for one staked SuiFren. */
export interface StakedSuiFrenMetadataV1Object extends Object {
	/** ID of the staked SuiFren. */
	suiFrenId: ObjectId;
	/** Fees collected for this position, in the payment coin's smallest unit. */
	collectedFees: Balance;
	/** Whether harvested fees are automatically staked. */
	autoStakeFees: boolean;
	/** Current per-mix fee, in the payment coin's smallest unit. */
	mixFee: Balance;
	/** Fee increment applied per mix, in the payment coin's smallest unit. */
	feeIncrementPerMix: Balance;
	/** Minimum remaining mix count to keep when the SuiFren is staked. */
	minRemainingMixesToKeep: bigint;
}

/** Aggregate state stored by the SuiFrens vault. */
export interface SuiFrenVaultStateV1Object extends Object {
	/** Current number of staked SuiFrens. */
	stakedSuiFrens: bigint;
	/** Total number of mixes recorded by the vault. */
	totalMixes: bigint;
}

/** Public representation of a SuiFren accessory object. */
export interface SuiFrenAccessoryObject extends Object {
	/** Display name of the accessory. */
	name: SuiFrenAccessoryName;
	/** Accessory type identifier used by add and remove transactions. */
	type: SuiFrenAccessoryType;
	/** Image URL returned by the accessory display data. */
	imageUrl: Url;
}

// =========================================================================
//  Events
// =========================================================================

/** Event emitted when a wallet harvests fees from staked SuiFrens. */
export interface HarvestSuiFrenFeesEvent extends Event {
	/** Address that harvested the fees. */
	harvester: SuiAddress;
	/** Harvested amount in the payment coin's smallest unit. */
	fees: bigint;
}

/** Event emitted when a wallet stakes a SuiFren. */
export interface StakeSuiFrenEvent extends Event {
	/** Address that staked the SuiFren. */
	staker: SuiAddress;
	/** ID of the staked SuiFren. */
	suiFrenId: ObjectId;
}

/** Event emitted when a wallet unstakes a SuiFren. */
export interface UnstakeSuiFrenEvent extends Event {
	/** Address that unstaked the SuiFren. */
	unstaker: SuiAddress;
	/** ID of the unstaked SuiFren. */
	suiFrenId: ObjectId;
	/** Fees charged or retained by the unstake, in smallest units. */
	fees: Balance;
}

/** Event emitted when two parent SuiFrens are mixed. */
export interface MixSuiFrensEvent extends Event {
	/** Address that initiated the mix. */
	mixer: SuiAddress;
	/** ID of the first parent SuiFren. */
	parentOneId: ObjectId;
	/** ID of the second parent SuiFren. */
	parentTwoId: ObjectId;
	/** ID of the child SuiFren created by the mix. */
	childId: ObjectId;
	/** Mix fee in the payment coin's smallest unit. */
	fee: Balance;
}

// =========================================================================
//  Stats
// =========================================================================

/** Aggregate SuiFrens statistics returned by the stats endpoint. */
export interface SuiFrenStats {
	/** Total number of mixes recorded by the vault. */
	totalMixes: bigint;
	/** Current number of staked SuiFrens. */
	currentTotalStaked: bigint;
	/** Sum of mix fees during the last 24 hours, in smallest units. */
	mixingFees24hr: Balance;
	/** Number of mix events during the last 24 hours. */
	mixingVolume24hr: number;
}

// =========================================================================
//  API
// =========================================================================

/** Inputs for building a transaction that stakes a SuiFren. */
export interface ApiStakeSuiFrenBody {
	/** ID of the SuiFren object to stake. */
	suiFrenId: ObjectId;
	/** Initial stake fee in the payment coin's smallest unit. */
	baseFee: Balance;
	/** Fee increment per mix in the payment coin's smallest unit. */
	feeIncrementPerMix: Balance;
	/** Minimum mix count to keep, encoded by the Move call as `u8`. */
	minRemainingMixesToKeep: bigint;
	/** Generic Move type argument for the SuiFren object. */
	suiFrenType: AnyObjectType;
	/** Transaction sender and owner expected to supply the SuiFren. */
	walletAddress: SuiAddress;
}

/** Inputs for building a transaction that unstakes a SuiFren position. */
export interface ApiUnstakeSuiFrenBody {
	/** ID of the owned staked-position object. */
	stakedPositionId: ObjectId;
	/** Generic Move type argument for the underlying SuiFren. */
	suiFrenType: AnyObjectType;
	/** Transaction sender and position owner. */
	walletAddress: SuiAddress;
}

/** Inputs for building a transaction that mixes two SuiFrens. */
export interface ApiMixSuiFrensBody {
	/** First parent object and its optional staked mix fee. */
	suiFrenParentOne: {
		/** ID of the first parent SuiFren. */
		objectId: ObjectId;
		/** Staked fee in smallest units, or `undefined` for an owned parent. */
		mixFee: Balance | undefined;
	};
	/** Second parent object and its optional staked mix fee. */
	suiFrenParentTwo: {
		/** ID of the second parent SuiFren. */
		objectId: ObjectId;
		/** Staked fee in smallest units, or `undefined` for an owned parent. */
		mixFee: Balance | undefined;
	};
	/** Base mix fee in the payment coin's smallest unit. */
	baseFee: Balance;
	/** Generic Move type argument shared by both parent objects. */
	suiFrenType: AnyObjectType;
	/** Transaction sender and wallet that pays the calculated total fee. */
	walletAddress: SuiAddress;
	/** Whether coin selection should prepare a sponsored transaction. */
	isSponsoredTx?: boolean;
}

/** Inputs for building a transaction that harvests fees from positions. */
export interface ApiHarvestSuiFrenFeesBody {
	/** Owned staked-position IDs to harvest. */
	stakedPositionIds: ObjectId[];
	/** Transaction sender and fee recipient. */
	walletAddress: SuiAddress;
}

/** Inputs for building a transaction that adds an accessory to a SuiFren. */
export interface ApiAddSuiFrenAccessoryBody {
	/** ID of the SuiFren or staked SuiFren metadata object. */
	suiFrenId: ObjectId;
	/** ID of the accessory object to attach. */
	accessoryId: ObjectId;
	/** Selects the owned-SuiFren Move variant when `true`. */
	isOwned: boolean;
	/** Generic Move type argument for the SuiFren object. */
	suiFrenType: AnyObjectType;
	/** Transaction sender and owner expected by the selected Move call. */
	walletAddress: SuiAddress;
}

/** Inputs for removing an accessory from either an owned or staked SuiFren. */
export type ApiRemoveSuiFrenAccessoryBody = {
	/** Accessory type string passed to the Move call. */
	accessoryType: SuiFrenAccessoryType;
	/** Generic Move type argument for the SuiFren object. */
	suiFrenType: AnyObjectType;
	/** Transaction sender and owner expected by the selected Move call. */
	walletAddress: SuiAddress;
} & (
	| {
			/** ID of an owned SuiFren. */
			suiFrenId: ObjectId;
	  }
	| {
			/** ID of an owned staked-position object. */
			stakedPositionId: ObjectId;
	  }
);

/** Inputs for reading accessories attached to one SuiFren. */
export interface ApiAccessoriesForSuiFrenBody {
	/** ID of the SuiFren object whose dynamic fields are read. */
	suiFrenId: ObjectId;
}

/** Inputs for listing accessories owned by a wallet. */
export interface ApiOwnedSuiFrenAccessoriesBody {
	/** Wallet address whose accessory objects are listed. */
	walletAddress: SuiAddress;
}

/** Inputs for listing SuiFrens owned by a wallet. */
export interface ApiOwnedSuiFrensBody {
	/** Wallet address whose owned SuiFren objects are listed. */
	walletAddress: SuiAddress;
}

/** Inputs for listing staked SuiFrens owned by a wallet. */
export interface ApiOwnedStakedSuiFrensBody {
	/** Wallet address whose staked-position objects are listed. */
	walletAddress: SuiAddress;
}
