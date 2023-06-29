import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	AnyObjectType,
	Balance,
	Event,
	Object,
	Timestamp,
	Url,
} from "../../general/types/generalTypes";
import { CoinWithBalance } from "../coin/coinTypes";

// =========================================================================
//  Name Only
// =========================================================================

export type SuiFrenAccessoryType = string;
export type SuiFrenAccessoryName = string;

// =========================================================================
//  Objects
// =========================================================================

export interface CapyLabsAppObject extends Object {
	mixingLimit: bigint;
	coolDownPeriodEpochs: bigint;
	mixingPrice: Balance;
	suiProfits: Balance;
}

export interface SuiFrenObject extends Object {
	// object fields
	generation: bigint;
	birthdate: Timestamp;
	cohort: bigint;
	genes: bigint[];
	attributes: SuiFrenAttributes;
	birthLocation: string;

	// dynamic fields
	mixLimit?: bigint;
	lastEpochMixed?: bigint;

	// display fields
	display: {
		link: Url;
		imageUrl: Url;
		description: string;
		projectUrl: Url;
	};
}

export type PartialSuiFrenObject = Omit<
	SuiFrenObject,
	"mixLimit" | "lastEpochMixed"
>;

export type SuiFrenAttributes = {
	skin: "stripes" | "cheetah";
	mainColor: "6FBBEE";
	secondaryColor: "CF9696";
	expression: "bigSmile";
	ears: "ear1";
};

export enum SuiFrensSortOption {
	PriceLowToHigh = "Price (low to high)",
	PriceHighToLow = "Price (high to low)",
}

export interface StakedSuiFrenInfo {
	suiFren: SuiFrenObject;
	metadata: StakedSuiFrenMetadataV1Object;
	position?: StakedSuiFrenPositionObject;
}

export interface StakedSuiFrenPositionObject extends Object {
	suiFrenId: ObjectId;
}

export interface StakedSuiFrenMetadataV1Object extends Object {
	suiFrenId: ObjectId;
	collectedFees: Balance;
	autoStakeFees: boolean;
	mixFee: Balance;
	feeIncrementPerMix: Balance;
	minRemainingMixesToKeep: bigint;
}

export interface SuiFrenVaultStateV1Object extends Object {
	stakedSuiFrens: bigint;
	totalMixes: bigint;
}

export interface SuiFrenAccessoryObject extends Object {
	name: SuiFrenAccessoryName;
	type: SuiFrenAccessoryType;
	imageUrl: Url;
}

// =========================================================================
//  Events
// =========================================================================

export interface HarvestSuiFrenFeesEvent extends Event {
	harvester: SuiAddress;
	fees: bigint;
}

export interface StakeSuiFrenEvent extends Event {
	staker: SuiAddress;
	suiFrenId: ObjectId;
}

export interface UnstakeSuiFrenEvent extends Event {
	unstaker: SuiAddress;
	suiFrenId: ObjectId;
	fees: Balance;
}

export interface MixSuiFrensEvent extends Event {
	mixer: SuiAddress;
	parentOneId: ObjectId;
	parentTwoId: ObjectId;
	childId: ObjectId;
	fee: Balance;
}

// =========================================================================
//  Stats
// =========================================================================

export interface SuiFrenStats {
	totalMixes: bigint;
	currentTotalStaked: bigint;
	mixingFees24hr: Balance;
	mixingVolume24hr: number;
}

// =========================================================================
//  API
// =========================================================================

export interface ApiStakeSuiFrenBody {
	suiFrenId: ObjectId;
	baseFee: Balance;
	feeIncrementPerMix: Balance;
	minRemainingMixesToKeep: bigint;
	suiFrenType: AnyObjectType;
	walletAddress: SuiAddress;
}

export interface ApiUnstakeSuiFrenBody {
	suiFrenId: ObjectId;
	suiFrenType: AnyObjectType;
	walletAddress: SuiAddress;
}

export interface ApiMixSuiFrensBody {
	suiFrenParentOne: {
		objectId: ObjectId;
		isStaked: boolean;
	};
	suiFrenParentTwo: {
		objectId: ObjectId;
		isStaked: boolean;
	};
	totalFee: Balance;
	suiFrenType: AnyObjectType;
	walletAddress: SuiAddress;
}

export interface ApiHarvestSuiFrenFeesBody {
	stakedPositionIds: ObjectId[];
	suiFrenType: AnyObjectType;
	walletAddress: SuiAddress;
}

export interface ApiAddSuiFrenAccessoryBody {
	suiFrenId: ObjectId;
	accessoryId: ObjectId;
	isOwned: boolean;
	suiFrenType: AnyObjectType;
	walletAddress: SuiAddress;
}

export type ApiRemoveSuiFrenAccessoryBody = {
	accessoryType: SuiFrenAccessoryType;
	suiFrenType: AnyObjectType;
	walletAddress: SuiAddress;
} & (
	| {
			suiFrenId: ObjectId;
	  }
	| {
			stakedPositionId: ObjectId;
	  }
);

export interface ApiAccessoriesForSuiFrenBody {
	suiFrenId: ObjectId;
}

export interface ApiOwnedSuiFrenAccessoriesBody {
	walletAddress: SuiAddress;
}

export interface ApiOwnedSuiFrensBody {
	walletAddress: SuiAddress;
}

export interface ApiOwnedStakedSuiFrensBody {
	walletAddress: SuiAddress;
}
