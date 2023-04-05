import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Balance, Event, Object, Url } from "../../general/types/generalTypes";
import { EpochTimeLock } from "../../general/types/suiTypes";
import {
	AmountInCoinAndUsd,
	CoinType,
	CoinWithBalance,
} from "../coin/coinTypes";

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

export interface CapyObject extends Object {
	// TODO: remove fields such that object data is in line with object id itself
	fields: CapyFields;
}

export interface StakedCapyObject extends Object {
	capy: CapyObject;
	collectedFees: Balance;
}

export interface StakedCapyReceiptObject extends Object {
	capyId: ObjectId;
	unlockEpoch: EpochTimeLock;
}

export interface StakedCapyReceiptWithCapyObject extends Object {
	capy: CapyObject;
	unlockEpoch: EpochTimeLock;
}

export interface CapyVaultObject extends Object {
	bredCapys: bigint;
	stakedCapys: bigint;
	globalFees: Balance;
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export interface BreedCapysEvent extends Event {
	breeder: SuiAddress;
	capyParentOneId: ObjectId;
	capyParentTwoId: ObjectId;
	capyChildId: ObjectId;
	// TODO: remove all CoinWithBalance types
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

export interface StakedCapyFeesEarned {
	individualFees: Balance;
	globalFees: Balance;
}
