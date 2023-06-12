import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	Balance,
	Event,
	Object,
	Timestamp,
	Url,
} from "../../general/types/generalTypes";
import { CoinWithBalance } from "../coin/coinTypes";

// =========================================================================
//  NEW
// =========================================================================

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
	generation: bigint;
	birthdate: Timestamp;
	cohort: bigint;
	genes: bigint[];
	attributes: SuiFrenAttributes;
	birthLocation: string;
	imageUrl: Url;
	mixLimit?: bigint;
	lastEpochMixed?: bigint;
}

export type SuiFrenAttributes = {
	skin: "stripes" | "cheetah";
	mainColor: "6FBBEE";
	secondaryColor: "CF9696";
	expression: "bigSmile";
	ears: "ear1";
};

export interface StakedSuiFrenInfo {
	suiFren: SuiFrenObject;
	position: StakedSuiFrenPositionObject;
	metadata: StakedSuiFrenMetadataObject;
}

export interface StakedSuiFrenPositionObject extends Object {
	suiFrenId: ObjectId;
}

export interface StakedSuiFrenMetadataObject extends Object {
	suiFrenId: ObjectId;
	collectedFees: Balance;
	mixFee: Balance;
	feeIncrementPerMix: Balance;
	minRemainingMixesToKeep: bigint;
}

export interface SuiFrenVaultStateObject extends Object {
	totalMixes: bigint;
}

// =========================================================================
//  OLD
// =========================================================================

// =========================================================================
//  Events
// =========================================================================

export interface BreedSuiFrensEvent extends Event {
	breeder: SuiAddress;
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
	breeder: SuiAddress;
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

export interface ApiWithdrawSuiFrenFeesBody {
	stakedPositionId: ObjectId;
}
