import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Balance, Event, Url } from "./generalTypes";
import { EpochTimeLock } from "./suiTypes";
import { AmountInCoinAndUsd, CoinType, CoinWithBalance } from "./coinTypes";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface CapyGenes {
	sequence: number[];
}

export interface CapyAttribute {
	name: string;
	value: string;
}

export interface CapyFields {
	gen: number;
	url: Url;
	link: Url;
	genes: CapyGenes;
	devGenes: CapyGenes;
	itemCount: number;
	attributes: CapyAttribute[];
}

export interface Capy {
	objectId: ObjectId;
	fields: CapyFields;
}

export interface StakedCapy {
	objectId: ObjectId;
	capy: Capy;
	collectedFees: Balance;
}

export interface StakingReceipt {
	objectId: ObjectId;
	capyId: ObjectId;
	unlockEpoch: EpochTimeLock;
}

export interface StakingReceiptWithCapy {
	objectId: ObjectId;
	capy: Capy;
	unlockEpoch: EpochTimeLock;
}

export interface CapyVault {
	objectId: ObjectId;
	bredCapys: bigint;
	stakedCapys: bigint;
	globalFees: Balance;
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export interface BreedCapyEvent extends Event {
	breeder: SuiAddress;
	capyParentOneId: ObjectId;
	capyParentTwoId: ObjectId;
	capyChildId: ObjectId;
	feeCoinWithBalance: CoinWithBalance;
}

export interface StakeCapyEvent extends Event {
	staker: SuiAddress;
	capyId: ObjectId;
}

export interface UnstakeCapyEvent extends Event {
	unstaker: SuiAddress;
	capyId: ObjectId;
}

export interface CapyBornEvent extends Event {
	breeder: SuiAddress;
	capyParentOneId: ObjectId;
	capyParentTwoId: ObjectId;
	capyChildId: ObjectId;
}

/////////////////////////////////////////////////////////////////////
//// Stats
/////////////////////////////////////////////////////////////////////

export interface CapyStats {
	bredCapys: bigint;
	stakedCapys: bigint;
	breedingFeeCoin: CoinType;
	breedingFeesGlobal: AmountInCoinAndUsd;
	breedingFeesDaily: AmountInCoinAndUsd;
	breedingVolumeDaily: number;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiStakeCapyBody {
	capyId: ObjectId;
}

export interface ApiUnstakeCapyBody {
	stakingReceiptId: ObjectId;
}

export interface ApiWithdrawCapyFeesAmountBody {
	amount: Balance | undefined;
	stakingReceiptObjectId: ObjectId;
}

export interface ApiBreedCapyBody {
	walletAddress: SuiAddress;
	capyParentOneId: ObjectId;
	capyParentTwoId: ObjectId;
}

export interface CapyFeesEarned {
	capyFeesEarnedIndividual: Balance;
	capyFeesEarnedGlobal: Balance;
}
