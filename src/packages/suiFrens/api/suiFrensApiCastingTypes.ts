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

export interface CapyLabsAppFieldsOnChain {
	id: ObjectId;
	inner_hash: BigIntAsString[];
	mixing_limit: BigIntAsString;
	cool_down_period: BigIntAsString;
	mixing_price: BigIntAsString;
	profits: BigIntAsString;
}

export interface SuiFrenFieldsOnChain {
	id: ObjectId;
	generation: BigIntAsString;
	birthdate: BigIntAsString;
	cohort: BigIntAsString;
	genes: BigIntAsString[];
	attributes: string[];
	birth_location: string;
}

export interface SuiFrenDisplayOnChain {
	name: string;
	description: string;
	image_url: string;
	link: string;
	project_url: string;
	// creator: string;
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

export type MixSuiFrenEventOnChain = EventOnChain<{
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
