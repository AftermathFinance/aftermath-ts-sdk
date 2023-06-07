import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	Balance,
	Event,
	Object,
	Timestamp,
	Url,
} from "../../general/types/generalTypes";
import { EpochTimeLock } from "../../general/types/suiTypes";
import {
	AmountInCoinAndUsd,
	CoinType,
	CoinWithBalance,
} from "../coin/coinTypes";

// =========================================================================
//  NEW
// =========================================================================

// =========================================================================
//  Name Only
// =========================================================================

export type SuiFrenAttributes = {
	skin: "stripes" | "cheetah";
	mainColor: "6FBBEE";
	secondaryColor: "CF9696";
	expression: "bigSmile";
	ears: "ear1";
};

// =========================================================================
//  Objects
// =========================================================================

export interface SuiFrenObject extends Object {
	generation: bigint;
	birthdate: Timestamp;
	cohort: bigint;
	genes: bigint[];
	attributes: SuiFrenAttributes;
	birthLocation: string;
	imageUrl: Url;
}

// =========================================================================
//  OLD
// =========================================================================

// =========================================================================
//  Objects
// =========================================================================

// export interface SuiFrenGenes {
// 	sequence: number[];
// }

// export interface SuiFrenAttribute {
// 	name: string;
// 	value: string;
// }

// export interface SuiFrenFields {
// 	gen: number;
// 	url: Url;
// 	link: Url;
// 	genes: SuiFrenGenes;
// 	devGenes: SuiFrenGenes;
// 	itemCount: number;
// 	attributes: SuiFrenAttribute[];
// }

// export interface SuiFrenObject extends Object {
// 	// TODO: remove fields such that object data is in line with object id itself
// 	fields: SuiFrenFields;
// }

export interface StakedSuiFrenObject extends Object {
	suiFren: SuiFrenObject;
	collectedFees: Balance;
}

export interface StakedSuiFrenReceiptObject extends Object {
	suiFrenId: ObjectId;
	unlockEpoch: EpochTimeLock;
}

export interface StakedSuiFrenReceiptWithSuiFrenObject extends Object {
	suiFren: SuiFrenObject;
	unlockEpoch: EpochTimeLock;
}

export interface SuiFrenVaultObject extends Object {
	bredSuiFrens: bigint;
	stakedSuiFrens: bigint;
	globalFees: Balance;
}

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
	bredSuiFrens: bigint;
	stakedSuiFrens: bigint;
	breedingFeeCoin: CoinType;
	breedingFeesGlobal: AmountInCoinAndUsd;
	breedingFeesDaily: AmountInCoinAndUsd;
	breedingVolumeDaily: number;
}

// =========================================================================
//  API
// =========================================================================

export interface ApiStakeSuiFrenBody {
	suiFrenId: ObjectId;
}

export interface ApiUnstakeSuiFrenBody {
	stakingReceiptId: ObjectId;
}

export interface ApiWithdrawSuiFrenFeesAmountBody {
	amount: Balance | undefined;
	stakingReceiptObjectId: ObjectId;
}

export interface ApiBreedSuiFrenBody {
	walletAddress: SuiAddress;
	suiFrenParentOneId: ObjectId;
	suiFrenParentTwoId: ObjectId;
}

export interface StakedSuiFrenFeesEarned {
	individualFees: Balance;
	globalFees: Balance;
}
