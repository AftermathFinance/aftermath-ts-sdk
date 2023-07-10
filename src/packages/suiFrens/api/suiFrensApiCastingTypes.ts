import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../types";
import {
	EventOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";

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

export interface StakedSuiFrenMetadataV1FieldsOnChain {
	suifren_id: ObjectId;
	suifren_type: string;
	collected_fees: BigIntAsString;
	auto_stake_fees: boolean;
	mix_fee: BigIntAsString;
	fee_increment_per_mix: BigIntAsString;
	min_remaining_mixes_to_keep: BigIntAsString;
	last_epoch_mixed: BigIntAsString;
	generation: BigIntAsString;
	birthdate: BigIntAsString;
	cohort: BigIntAsString;
	genes: BigIntAsString[];
	birth_location: string;
	attributes: string[];
}

export interface SuiFrenVaultStateV1FieldsOnChain {
	suifrens_metadata: TableOnChain;
	version: BigIntAsString;
	mixed: BigIntAsString;
}

export interface StakedSuiFrenPositionFieldsOnChain {
	suifren_id: ObjectId;
}

// =========================================================================
//  Events
// =========================================================================

export type HarvestSuiFrenFeesEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	fees: BigIntAsString;
}>;

export type StakeSuiFrenEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	suifren_id: ObjectId;
}>;

export type UnstakeSuiFrenEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	suifren_id: ObjectId;
	fees: BigIntAsString;
}>;

export type MixSuiFrensEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	suifren_id: ObjectId;
	parent_one_id: ObjectId;
	parent_two_id: ObjectId;
	fee: BigIntAsString;
}>;
