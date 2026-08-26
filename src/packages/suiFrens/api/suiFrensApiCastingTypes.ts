import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";
import {
	EventOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

/** Raw CapyLabs application fields from a Sui object response. */
export interface CapyLabsAppFieldsOnChain {
	/** Object ID field from the response. */
	id: ObjectId;
	/** Raw inner-hash values serialized as decimal strings. */
	inner_hash: BigIntAsString[];
	/** Raw maximum mixing limit. */
	mixing_limit: BigIntAsString;
	/** Raw cooldown duration in epochs. */
	cool_down_period: BigIntAsString;
	/** Raw mixing price in the payment coin's smallest unit. */
	mixing_price: BigIntAsString;
	/** Raw accumulated profit value. */
	profits: BigIntAsString;
}

/** Raw SuiFren object fields from a Sui object response. */
export interface SuiFrenFieldsOnChain {
	/** Object ID field from the response. */
	id: ObjectId;
	/** Raw generation number. */
	generation: BigIntAsString;
	/** Raw birth timestamp in milliseconds. */
	birthdate: BigIntAsString;
	/** Raw cohort number. */
	cohort: BigIntAsString;
	/** Raw gene values serialized as decimal strings. */
	genes: BigIntAsString[];
	/** Attribute values in the order expected by the caster. */
	attributes: string[];
	/** Raw birth-location string. */
	birth_location: string;
}

/** Raw display fields for a SuiFren object. */
export interface SuiFrenDisplayOnChain {
	/** Object description. */
	description: string;
	/** Object image URL. */
	image_url: string;
	/** External object link. */
	link: string;
	/** Project URL. */
	project_url: string;
}

/** Raw accessory object fields. */
export interface SuiFrenAccessoryFieldsOnChain {
	/** Accessory display name. */
	name: string;
	/** Accessory type identifier. */
	type: string;
}

/** Raw accessory display fields. */
export interface SuiFrenAccessoryDisplayOnChain {
	/** Accessory image URL. */
	image_url: string;
}

/** Raw vault metadata fields for one staked SuiFren. */
export interface StakedSuiFrenMetadataV1FieldsOnChain {
	/** ID of the associated SuiFren. */
	suifren_id: ObjectId;
	/** Full Move type of the associated SuiFren. */
	suifren_type: string;
	/** Raw collected-fee balance. */
	collected_fees: BigIntAsString;
	/** Whether fees are automatically staked. */
	auto_stake_fees: boolean;
	/** Raw per-mix fee. */
	mix_fee: BigIntAsString;
	/** Raw fee increment per mix. */
	fee_increment_per_mix: BigIntAsString;
	/** Raw minimum remaining mix count. */
	min_remaining_mixes_to_keep: BigIntAsString;
	/** Raw last-mixed epoch. */
	last_epoch_mixed: BigIntAsString;
	/** Raw generation number copied into metadata. */
	generation: BigIntAsString;
	/** Raw birth timestamp in milliseconds. */
	birthdate: BigIntAsString;
	/** Raw cohort number. */
	cohort: BigIntAsString;
	/** Raw gene values. */
	genes: BigIntAsString[];
	/** Raw birth-location string. */
	birth_location: string;
	/** Attribute values in caster order. */
	attributes: string[];
}

/** Raw SuiFrens vault-state fields. */
export interface SuiFrenVaultStateV1FieldsOnChain {
	/** Nested table of staked-SuiFren metadata. */
	suifrens_metadata: TableOnChain;
	/** Raw vault-state version. */
	version: BigIntAsString;
	/** Raw total mix count. */
	mixed: BigIntAsString;
}

/** Raw staked-position fields. */
export interface StakedSuiFrenPositionFieldsOnChain {
	/** ID of the SuiFren represented by the position. */
	suifren_id: ObjectId;
}

// =========================================================================
//  Events
// =========================================================================

/** Raw harvested-fees event fields wrapped by `EventOnChain`. */
export type HarvestSuiFrenFeesEventOnChain = EventOnChain<{
	/** Issuer address in the raw event payload. */
	issuer: SuiAddress;
	/** Harvested fee balance serialized as text. */
	fees: BigIntAsString;
}>;

/** Raw stake event fields wrapped by `EventOnChain`. */
export type StakeSuiFrenEventOnChain = EventOnChain<{
	/** Issuer address in the raw event payload. */
	issuer: SuiAddress;
	/** Staked SuiFren ID. */
	suifren_id: ObjectId;
}>;

/** Raw unstake event fields wrapped by `EventOnChain`. */
export type UnstakeSuiFrenEventOnChain = EventOnChain<{
	/** Issuer address in the raw event payload. */
	issuer: SuiAddress;
	/** Unstaked SuiFren ID. */
	suifren_id: ObjectId;
	/** Unstake fee balance serialized as text. */
	fees: BigIntAsString;
}>;

/** Raw mix event fields wrapped by `EventOnChain`. */
export type MixSuiFrensEventOnChain = EventOnChain<{
	/** Issuer address in the raw event payload. */
	issuer: SuiAddress;
	/** Child SuiFren ID. */
	suifren_id: ObjectId;
	/** First parent SuiFren ID. */
	parent_one_id: ObjectId;
	/** Second parent SuiFren ID. */
	parent_two_id: ObjectId;
	/** Mix fee serialized as text. */
	fee: BigIntAsString;
}>;
