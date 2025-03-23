import { BigIntAsString, CoinType, ObjectId } from "../../../types";
import {
	EventOnChain,
	TableOnChain,
	WrappedEventOnChain,
} from "../../../general/types/castingTypes";
import { SuiObjectData } from "@mysten/sui/client";

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

export interface FarmsStakedPositionFieldsOnChainV1 {
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

export interface FarmsStakedPositionFieldsOnChainV2 {
	id: ObjectId;
	vault_id: ObjectId;
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
	// lock_enforcement: LockEnforcement;
}

export interface FarmsVaultRegistryFieldsOnChain {
	id: ObjectId;
	registered_vaults: TableOnChain;
}

export interface FarmsStakingPoolOwnerCapFieldsOnChainV1 {
	id: ObjectId;
	afterburner_vault_id: ObjectId;
}

export interface FarmsStakingPoolOwnerCapFieldsOnChainV2 {
	id: ObjectId;
	for: ObjectId;
}

export interface FarmsStakingPoolOneTimeAdminCapFieldsOnChainV1 {
	id: ObjectId;
	afterburner_vault_id: ObjectId;
}

export interface FarmsStakingPoolOneTimeAdminCapFieldsOnChainV2 {
	id: ObjectId;
	cap: FarmsStakingPoolOwnerCapFieldsOnChainV2;
}

// =========================================================================
//  Events
// =========================================================================

export type FarmsAddedRewardEventOnChainV1 = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
}>;

export type FarmsAddedRewardEventOnChainV2 = WrappedEventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
}>;

export type FarmsCreatedVaultEventOnChainV1 = EventOnChain<{
	vault_id: ObjectId;
	stake_type: CoinType;
	min_lock_duration_ms: BigIntAsString;
	max_lock_duration_ms: BigIntAsString;
	max_lock_multiplier: BigIntAsString;
	min_stake_amount: BigIntAsString;
}>;

export type FarmsCreatedVaultEventOnChainV2 = WrappedEventOnChain<{
	vault_id: ObjectId;
	stake_type: CoinType;
	min_lock_duration_ms: BigIntAsString;
	max_lock_duration_ms: BigIntAsString;
	max_lock_multiplier: BigIntAsString;
	min_stake_amount: BigIntAsString;
}>;

export type FarmsDepositedPrincipalEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	amount: BigIntAsString;
	stake_type: CoinType;
}>;

export type FarmsDepositedPrincipalEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	amount: BigIntAsString;
	stake_type: CoinType;
}>;

export type FarmsDestroyedStakedPositionEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
}>;

export type FarmsDestroyedStakedPositionEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
}>;

export type FarmsHarvestedRewardsEventOnChainV1 = EventOnChain<{
	afterburner_vault_id: ObjectId;
	reward_types: CoinType[];
	reward_amounts: BigIntAsString[];
}>;

export type FarmsHarvestedRewardsEventOnChainV2 = WrappedEventOnChain<{
	afterburner_vault_id: ObjectId;
	reward_types: CoinType[];
	reward_amounts: BigIntAsString[];
}>;

export type FarmsIncreasedEmissionsEventOnChainV1 = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	emission_schedule_ms: BigIntAsString;
	emission_rate: BigIntAsString;
}>;

export type FarmsUpdatedEmissionsEventOnChainV2 = WrappedEventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	emission_schedule_ms: BigIntAsString;
	emission_rate: BigIntAsString;
}>;

export type FarmsInitializedRewardEventOnChainV1 = EventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
	emission_rate: BigIntAsString;
	emission_start_ms: BigIntAsString;
}>;

export type FarmsInitializedRewardEventOnChainV2 = WrappedEventOnChain<{
	vault_id: ObjectId;
	reward_type: CoinType;
	reward_amount: BigIntAsString;
	emission_rate: BigIntAsString;
	emission_start_ms: BigIntAsString;
}>;

export type FarmsJoinedEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	other_staked_position_id: ObjectId;
}>;

export type FarmsJoinedEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
	other_staked_position_id: ObjectId;
}>;

export type FarmsLockedEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type FarmsLockedEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type FarmsSplitEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	split_staked_position_id: ObjectId;
}>;

export type FarmsSplitEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
	split_staked_position_id: ObjectId;
}>;

export type FarmsStakedEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	multiplied_staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type FarmsStakedEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	multiplier_staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_duration_ms: BigIntAsString;
	lock_multiplier: BigIntAsString;
}>;

export type FarmsStakedRelaxedEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
	lock_start_timestamp_ms: BigIntAsString;
	lock_end_timestamp_ms: BigIntAsString;
}>;

export type FarmsUnlockedEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
}>;

export type FarmsUnlockedEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	staked_type: CoinType;
	staked_amount: BigIntAsString;
}>;

export type FarmsWithdrewPrincipalEventOnChainV1 = EventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	amount: BigIntAsString;
	stake_type: CoinType;
}>;

export type FarmsWithdrewPrincipalEventOnChainV2 = WrappedEventOnChain<{
	staked_position_id: ObjectId;
	vault_id: ObjectId;
	amount: BigIntAsString;
	stake_type: CoinType;
}>;
