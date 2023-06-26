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
	position: StakedSuiFrenPositionObject;
	metadata: StakedSuiFrenMetadataV1Object;
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

export interface SuiFrenVaultStateObject extends Object {
	totalMixes: bigint;
}

export interface SuiFrenAccessoryObject extends Object {
	name: SuiFrenAccessoryName;
	type: SuiFrenAccessoryType;
	imageUrl: Url;
}

// =========================================================================
//  OLD
// =========================================================================

export interface SuiFrenVaultObject {}

// =========================================================================
//  Events
// =========================================================================

export interface MixSuiFrensEvent extends Event {
	mixer: SuiAddress;
	suiFrenParentOneId: ObjectId;
	suiFrenParentTwoId: ObjectId;
	suiFrenChildId: ObjectId;
	// TODO: remove all CoinWithBalance types
	feeCoinWithBalance: CoinWithBalance;
}

export interface StakeSuiFrenEvent extends Event {
	staker: SuiAddress;
	suiFrenId: ObjectId;
}

export interface UnstakeSuiFrenEvent extends Event {
	unstaker: SuiAddress;
	suiFrenId: ObjectId;
}

export interface SuiFrenBornEvent extends Event {
	mixer: SuiAddress;
	suiFrenParentOneId: ObjectId;
	suiFrenParentTwoId: ObjectId;
	suiFrenChildId: ObjectId;
}

// =========================================================================
//  Stats
// =========================================================================

export interface SuiFrenStats {
	totalMixes: bigint;
	totalStaked: bigint;
	mixingFees24hr: Balance;
	mixingVolume24hr: number;
}

// =========================================================================
//  API
// =========================================================================

export interface ApiStakeSuiFrenBody {
	suiFrenId: ObjectId;
	mixFee: Balance;
	feeIncrementPerMix: Balance;
	minRemainingMixesToKeep: bigint;
}

export interface ApiUnstakeSuiFrenBody {
	stakedPositionId: ObjectId;
}

export interface ApiMixSuiFrensBody {
	walletAddress: SuiAddress;
	suiFrenParentOneId: ObjectId;
	suiFrenParentTwoId: ObjectId;
}

export interface ApiWithdrawStakedSuiFrenFeesBody {
	stakedPositionId: ObjectId;
}

export interface ApiAddSuiFrenAccessoryBody {
	suiFrenId: ObjectId;
	accessoryId: ObjectId;
}

export type ApiRemoveSuiFrenAccessoryBody = {
	accessoryType: SuiFrenAccessoryType;
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
