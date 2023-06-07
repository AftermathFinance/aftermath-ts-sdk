import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	AnyObjectType,
	BigIntAsString,
	EpochTimeLock,
	Url,
} from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  NEW
// =========================================================================

// =========================================================================
//  Objects
// =========================================================================

export interface SuiFrenFieldsOnChain {
	id: ObjectId;
	generation: BigIntAsString;
	birthdate: BigIntAsString;
	cohort: BigIntAsString;
	genes: BigIntAsString[];
	attributes: string[];
	birth_location: string;
}

// =========================================================================
//  OLD
// =========================================================================

// =========================================================================
//  Objects
// =========================================================================

export interface StakedSuiFrenReceiptFieldsOnChain {
	suiFren_id: ObjectId;
	unlock_epoch: {
		fields: EpochTimeLock;
	};
}

export interface SuiFrenVaultFieldsOnChain {
	bred_suiFrens: BigIntAsString;
	staked_suiFrens: BigIntAsString;
	global_fees: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type SuiFrenBornEventOnChain = EventOnChain<{
	bred_by: SuiAddress;
	id: ObjectId;
	parent_one: ObjectId;
	parent_two: ObjectId;
}>;

export type BreedSuiFrenEventOnChain = EventOnChain<{
	id: ObjectId;
	parentOneId: ObjectId;
	parentTwoId: ObjectId;
	fee: BigIntAsString;
}>;

export type StakeSuiFrenEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	suiFren_id: ObjectId;
}>;

export type UnstakeSuiFrenEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	suiFren_id: ObjectId;
}>;
