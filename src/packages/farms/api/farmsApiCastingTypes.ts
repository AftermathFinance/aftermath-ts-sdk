import { ObjectId } from "@mysten/sui.js";
import { BigIntAsString, CoinType } from "../../../types";
import {
	EventOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface AfterburnerVaultFieldsOnChain {
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

export interface StakedPositionFieldsOnChain {
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

export interface VaultRegistryFieldsOnChain {
	id: ObjectId;
	registered_vaults: TableOnChain;
}

// =========================================================================
//  Events
// =========================================================================

export type AddedRewardEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
}>;

export type CreatedVaultEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	stake_type: CoinType;
	min_lock_duration_ms: BigIntAsString;
	max_lock_duration_ms: BigIntAsString;
	max_lock_multiplier: BigIntAsString;
	min_stake_amount: BigIntAsString;
}>;

export type DepositedPrincipalEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	amount: BigIntAsString;
}>;

export type DestroyedStakedPositionEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
}>;

export type HarvestedRewardsEventOnChain = EventOnChain<{
	afterburner_vault_id: ObjectId;
	reward_types: CoinType[];
	reward_amounts: BigIntAsString[];
}>;

export type HarvestedRewardsEventMetadataOnChain = EventOnChain<{
	afterburner_vault_id: ObjectId;
	reward_types: CoinType[];
	reward_amounts: BigIntAsString[];
}>;

export type IncreasedEmissionsEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	emission_schedule_ms: BigIntAsString;
	emission_rate: BigIntAsString;
}>;

export type InitializedRewardEventOnChain = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
	emission_rate_ms: BigIntAsString;
	emission_start_ms: BigIntAsString;
}>;

export type JoinedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	other_staked_position_id: ObjectId;
}>;

export type LockedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type SplitEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	split_staked_position_id: ObjectId;
}>;

export type StakedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	multiplied_staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type StakedEventRelaxedOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_end_timestamp_ms: BigIntAsString;
}>;

export type UnlockedEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
}>;

export type WithdrewPrincipalEventOnChain = EventOnChain<{
	staked_position_id: ObjectId;
	amount: BigIntAsString;
}>;
