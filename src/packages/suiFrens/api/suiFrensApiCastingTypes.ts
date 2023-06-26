import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

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
	description: string;
	image_url: string;
	link: string;
	project_url: string;
}

export interface SuiFrenAccessoryFieldsOnChain {
	name: string;
	type: string;
}
export interface SuiFrenAccessoryDisplayOnChain {
	image_url: string;
}

// =========================================================================
//  OLD
// =========================================================================

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
