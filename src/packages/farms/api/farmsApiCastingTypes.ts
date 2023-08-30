import { ObjectId } from "@mysten/sui.js";
import { BigIntAsString, CoinType } from "../../../types";
import {
	EventOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface FarmsAfterburnerVaultFieldsOnChain {
	id: ObjectId;
	type_names: CoinType[];
	rewards: BigIntAsString[];
	rewards_accumulated_per_share: BigIntAsString[];
	total_staked_amount: BigIntAsString;
	total_staked_amount_with_multiplier: BigIntAsString;
	emission_schedules_ms: BigIntAsString[];
	emission_rates: BigIntAsString[];
	emission_start_timestamps_ms: BigIntAsString[];
	emission_end_timestamp_ms: BigIntAsString;
	last_reward_timestamps_ms: BigIntAsString[];
	lock_enforcement: BigIntAsString;
	min_lock_duration_ms: BigIntAsString;
	max_lock_duration_ms: BigIntAsString;
	max_lock_multiplier: BigIntAsString;
	min_stake_amount: BigIntAsString;
}

export interface FarmsStakedPositionFieldsOnChain {
	id: ObjectId;
	afterburner_vault_id: ObjectId;
	balance: BigIntAsString;
	multiplier_staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
	last_reward_timestamp_ms: BigIntAsString;
	base_rewards_accumulated: BigIntAsString[];
	multiplier_rewards_accumulated: BigIntAsString[];
	base_rewards_debt: BigIntAsString[];
	multiplier_rewards_debt: BigIntAsString[];
}

export interface FarmsVaultRegistryFieldsOnChain {
	id: ObjectId;
	registered_vaults: TableOnChain;
}

export interface FarmsStakingPoolOwnerCapFieldsOnChain {
	id: ObjectId;
	afterburner_vault_id: ObjectId;
}

export interface FarmsStakingPoolOneTimeAdminCapFieldsOnChain {
	id: ObjectId;
	afterburner_vault_id: ObjectId;
}

// =========================================================================
//  Events
// =========================================================================

export type FarmsAddedRewardEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
}>;

export type FarmsCreatedVaultEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	stake_type: CoinType;
	min_lock_duration_ms: BigIntAsString;
	max_lock_duration_ms: BigIntAsString;
	max_lock_multiplier: BigIntAsString;
	min_stake_amount: BigIntAsString;
}>;

export type FarmsDepositedPrincipalEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	amount: BigIntAsString;
	stake_type: CoinType;
}>;

export type FarmsDestroyedStakedPositionEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
}>;

export type FarmsHarvestedRewardsEventOnChain = EventOnChain<{
	afterburner_vault_id: ObjectId;
	reward_types: CoinType[];
	reward_amounts: BigIntAsString[];
}>;

export type FarmsIncreasedEmissionsEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	emission_schedule_ms: BigIntAsString;
	emission_rate: BigIntAsString;
}>;

export type FarmsInitializedRewardEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
	emission_rate: BigIntAsString;
	emission_start_ms: BigIntAsString;
}>;

export type FarmsJoinedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	other_staked_position_id: ObjectId;
}>;

export type FarmsLockedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type FarmsSplitEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	split_staked_position_id: ObjectId;
}>;

export type FarmsStakedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	multiplied_staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type FarmsStakedRelaxedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_end_timestamp_ms: BigIntAsString;
}>;

export type FarmsUnlockedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
}>;

export type FarmsWithdrewPrincipalEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	amount: BigIntAsString;
	stake_type: CoinType;
}>;
