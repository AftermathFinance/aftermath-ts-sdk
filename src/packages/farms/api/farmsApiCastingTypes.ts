import type {
	EventOnChain,
	MoveStructOnChain,
	TableOnChain,
	UidOnChain,
	WrappedEventOnChain,
} from "../../../general/types/castingTypes";
import type { BigIntAsString, CoinType, ObjectId } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

/** Raw V1 staking-pool fields returned by an object read. */
export interface FarmsAfterburnerVaultFieldsOnChain {
	/** UID field from the Move object. */
	id: ObjectId;
	/** Move type names used by the parallel reward arrays. */
	type_names: CoinType[];
	/** Total configured reward amounts, in base units. */
	rewards: BigIntAsString[];
	/** Cumulative reward allocation per fixed-point share, as decimal strings. */
	rewards_accumulated_per_share: BigIntAsString[];
	/** Total staked principal, as a decimal string in base units. */
	total_staked_amount: BigIntAsString;
	/** Total reward-weighted stake, as a decimal string. */
	total_staked_amount_with_multiplier: BigIntAsString;
	/** Emission intervals for the parallel reward arrays, in milliseconds. */
	emission_schedules_ms: BigIntAsString[];
	/** Emission amounts per interval for the parallel reward arrays. */
	emission_rates: BigIntAsString[];
	/** Emission start timestamps for the parallel reward arrays, in milliseconds. */
	emission_start_timestamps_ms: BigIntAsString[];
	/** Pool-wide emission end timestamp, in milliseconds. */
	emission_end_timestamp_ms: BigIntAsString;
	/** Last emission checkpoints for the parallel reward arrays, in milliseconds. */
	last_reward_timestamps_ms: BigIntAsString[];
	/** On-chain numeric encoding of the lock enforcement policy. */
	lock_enforcement: BigIntAsString;
	/** Minimum lock duration, in milliseconds. */
	min_lock_duration_ms: BigIntAsString;
	/** Maximum lock duration used for multiplier calculations, in milliseconds. */
	max_lock_duration_ms: BigIntAsString;
	/** Maximum lock multiplier in 18-decimal fixed-point units. */
	max_lock_multiplier: BigIntAsString;
	/** Minimum stake amount, in base units of the stake coin. */
	min_stake_amount: BigIntAsString;
}

/** Raw V1 staked-position fields returned by an object read. */
export interface FarmsStakedPositionFieldsOnChainV1 {
	/** UID field from the Move object. */
	id: ObjectId;
	/** V1 staking-pool object ID. */
	afterburner_vault_id: ObjectId;
	/** Position principal, as a decimal string in base units. */
	balance: BigIntAsString;
	/** Position principal after applying the lock multiplier. */
	multiplier_staked_amount: BigIntAsString;
	/** Lock start timestamp, in milliseconds. */
	lock_start_timestamp_ms: BigIntAsString;
	/** Lock duration, in milliseconds. */
	lock_duration_ms: BigIntAsString;
	/** Position lock multiplier in 18-decimal fixed-point units. */
	lock_multiplier: BigIntAsString;
	/** Last reward-accounting timestamp, in milliseconds. */
	last_reward_timestamp_ms: BigIntAsString;
	/** Base reward totals for the parallel reward arrays. */
	base_rewards_accumulated: BigIntAsString[];
	/** Multiplier reward totals for the parallel reward arrays. */
	multiplier_rewards_accumulated: BigIntAsString[];
	/** Base reward debt checkpoints for the parallel reward arrays. */
	base_rewards_debt: BigIntAsString[];
	/** Multiplier reward debt checkpoints for the parallel reward arrays. */
	multiplier_rewards_debt: BigIntAsString[];
}

/** Raw V2 staked-position fields returned by an object read. */
export interface FarmsStakedPositionFieldsOnChainV2 {
	/** UID field from the Move object. */
	id: ObjectId;
	/** V2 staking-pool object ID. */
	vault_id: ObjectId;
	/** Position principal, as a decimal string in base units. */
	balance: BigIntAsString;
	/** Position principal after applying the lock multiplier. */
	multiplier_staked_amount: BigIntAsString;
	/** Lock start timestamp, in milliseconds. */
	lock_start_timestamp_ms: BigIntAsString;
	/** Lock duration, in milliseconds. */
	lock_duration_ms: BigIntAsString;
	/** Position lock multiplier in 18-decimal fixed-point units. */
	lock_multiplier: BigIntAsString;
	/** Last reward-accounting timestamp, in milliseconds. */
	last_reward_timestamp_ms: BigIntAsString;
	/** Base reward totals for the parallel reward arrays. */
	base_rewards_accumulated: BigIntAsString[];
	/** Multiplier reward totals for the parallel reward arrays. */
	multiplier_rewards_accumulated: BigIntAsString[];
	/** Base reward debt checkpoints for the parallel reward arrays. */
	base_rewards_debt: BigIntAsString[];
	/** Multiplier reward debt checkpoints for the parallel reward arrays. */
	multiplier_rewards_debt: BigIntAsString[];
	// lock_enforcement: LockEnforcement;
}

/** Raw fields for the registry table that stores staking-pool IDs. */
export interface FarmsVaultRegistryFieldsOnChain {
	/** Move table containing registered staking-pool IDs. */
	registered_vaults: TableOnChain;
}

/** Raw V1 owner-cap fields. */
export interface FarmsStakingPoolOwnerCapFieldsOnChainV1 {
	/** V1 staking-pool object ID controlled by the capability. */
	afterburner_vault_id: ObjectId;
}

/**
 * An `authority::AuthorityCap<VAULT<ADMIN>>`'s own Move fields.
 *
 * @remarks Named `…FieldsOnChainV2["fields"]` historically; the envelope that
 * name referred to is JSON-RPC's and no longer exists on the gRPC `json` view,
 * so the fields are declared directly. Wrap in {@link MoveStructOnChain} at the
 * sites where this cap appears as a *nested* field.
 */
export interface FarmsStakingPoolOwnerCapFieldsOnChainV2 {
	/** V2 staking-pool object ID controlled by the capability. */
	for: ObjectId;
	/** UID field of the nested authority capability. */
	id: UidOnChain;
}

/** Raw V1 one-time-admin-cap fields. */
export interface FarmsStakingPoolOneTimeAdminCapFieldsOnChainV1 {
	/** V1 staking-pool object ID associated with the capability. */
	afterburner_vault_id: ObjectId;
}

/** Raw V2 one-time-admin-cap fields, including its nested authority capability. */
export interface FarmsStakingPoolOneTimeAdminCapFieldsOnChainV2 {
	/** Nested authority capability that identifies the staking pool. */
	cap: MoveStructOnChain<FarmsStakingPoolOwnerCapFieldsOnChainV2>;
}

// =========================================================================
//  Events
// =========================================================================

/** V1 direct event payload for adding reward balance to a staking pool. */
export type FarmsAddedRewardEventOnChainV1 = EventOnChain<{
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Reward coin type without the normalized leading-zero address. */
	reward_type: CoinType;
	/** Added reward amount as a decimal string in base units. */
	reward_amount: BigIntAsString;
}>;

/** V2 wrapped event payload for adding reward balance to a staking pool. */
export type FarmsAddedRewardEventOnChainV2 = WrappedEventOnChain<{
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Reward coin type without the normalized leading-zero address. */
	reward_type: CoinType;
	/** Added reward amount as a decimal string in base units. */
	reward_amount: BigIntAsString;
}>;

/** V1 direct event payload for creating a staking pool. */
export type FarmsCreatedVaultEventOnChainV1 = EventOnChain<{
	/** Created staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	stake_type: CoinType;
	/** Minimum lock duration in milliseconds. */
	min_lock_duration_ms: BigIntAsString;
	/** Maximum lock duration in milliseconds. */
	max_lock_duration_ms: BigIntAsString;
	/** Maximum lock multiplier in 18-decimal fixed-point units. */
	max_lock_multiplier: BigIntAsString;
	/** Minimum principal amount in base units. */
	min_stake_amount: BigIntAsString;
}>;

/** V2 wrapped event payload for creating a staking pool. */
export type FarmsCreatedVaultEventOnChainV2 = WrappedEventOnChain<{
	/** Created staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	stake_type: CoinType;
	/** Minimum lock duration in milliseconds. */
	min_lock_duration_ms: BigIntAsString;
	/** Maximum lock duration in milliseconds. */
	max_lock_duration_ms: BigIntAsString;
	/** Maximum lock multiplier in 18-decimal fixed-point units. */
	max_lock_multiplier: BigIntAsString;
	/** Minimum principal amount in base units. */
	min_stake_amount: BigIntAsString;
}>;

/** V1 direct event payload for depositing principal. */
export type FarmsDepositedPrincipalEventOnChainV1 = EventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Deposited amount as a decimal string in base units. */
	amount: BigIntAsString;
	/** Staked coin type. */
	stake_type: CoinType;
}>;

/** V2 wrapped event payload for depositing principal. */
export type FarmsDepositedPrincipalEventOnChainV2 = WrappedEventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Deposited amount as a decimal string in base units. */
	amount: BigIntAsString;
	/** Staked coin type. */
	stake_type: CoinType;
}>;

/** V1 direct event payload for destroying a staked position. */
export type FarmsDestroyedStakedPositionEventOnChainV1 = EventOnChain<{
	/** Destroyed staked-position object ID. */
	staked_position_id: ObjectId;
}>;

/** V2 wrapped event payload for destroying a staked position. */
export type FarmsDestroyedStakedPositionEventOnChainV2 = WrappedEventOnChain<{
	/** Destroyed staked-position object ID. */
	staked_position_id: ObjectId;
}>;

/** V1 direct event payload for harvesting rewards. */
export type FarmsHarvestedRewardsEventOnChainV1 = EventOnChain<{
	/** Staking-pool object ID. */
	afterburner_vault_id: ObjectId;
	/** Harvested reward coin types, parallel to `reward_amounts`. */
	reward_types: CoinType[];
	/** Harvested amounts as decimal strings in base units. */
	reward_amounts: BigIntAsString[];
}>;

/** V2 wrapped event payload for harvesting rewards. */
export type FarmsHarvestedRewardsEventOnChainV2 = WrappedEventOnChain<{
	/** Staking-pool object ID. */
	afterburner_vault_id: ObjectId;
	/** Harvested reward coin types, parallel to `reward_amounts`. */
	reward_types: CoinType[];
	/** Harvested amounts as decimal strings in base units. */
	reward_amounts: BigIntAsString[];
}>;

/** V1 direct event payload for increasing emissions. */
export type FarmsIncreasedEmissionsEventOnChainV1 = EventOnChain<{
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Reward coin type. */
	reward_type: CoinType;
	/** New emission interval in milliseconds. */
	emission_schedule_ms: BigIntAsString;
	/** New emission amount per interval as a decimal string. */
	emission_rate: BigIntAsString;
}>;

/** V2 wrapped event payload for updating emissions. */
export type FarmsUpdatedEmissionsEventOnChainV2 = WrappedEventOnChain<{
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Reward coin type. */
	reward_type: CoinType;
	/** New emission interval in milliseconds. */
	emission_schedule_ms: BigIntAsString;
	/** New emission amount per interval as a decimal string. */
	emission_rate: BigIntAsString;
}>;

/** V1 direct event payload for initializing a reward coin. */
export type FarmsInitializedRewardEventOnChainV1 = EventOnChain<{
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Initialized reward coin type. */
	reward_type: CoinType;
	/** Initial reward amount as a decimal string in base units. */
	reward_amount: BigIntAsString;
	/** Emission amount per interval as a decimal string. */
	emission_rate: BigIntAsString;
	/** Emission start timestamp in milliseconds. */
	emission_start_ms: BigIntAsString;
}>;

/** V2 wrapped event payload for initializing a reward coin. */
export type FarmsInitializedRewardEventOnChainV2 = WrappedEventOnChain<{
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Initialized reward coin type. */
	reward_type: CoinType;
	/** Initial reward amount as a decimal string in base units. */
	reward_amount: BigIntAsString;
	/** Emission amount per interval as a decimal string. */
	emission_rate: BigIntAsString;
	/** Emission start timestamp in milliseconds. */
	emission_start_ms: BigIntAsString;
}>;


/** V1 direct event payload for joining two staked positions. */
export type FarmsJoinedEventOnChainV1 = EventOnChain<{
	/** Position object ID that remains after the join. */
	staked_position_id: ObjectId;
	/** Position object ID consumed by the join. */
	other_staked_position_id: ObjectId;
}>;

/** V2 wrapped event payload for joining two staked positions. */
export type FarmsJoinedEventOnChainV2 = WrappedEventOnChain<{
	/** Position object ID that remains after the join. */
	staked_position_id: ObjectId;
	/** Position object ID consumed by the join. */
	other_staked_position_id: ObjectId;
}>;

/** V1 direct event payload for locking a position. */
export type FarmsLockedEventOnChainV1 = EventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	staked_type: CoinType;
	/** Position principal as a decimal string in base units. */
	staked_amount: BigIntAsString;
	/** Lock start timestamp in milliseconds. */
	lock_start_timestamp_ms: BigIntAsString;
	/** Lock duration in milliseconds. */
	lock_duration_ms: BigIntAsString;
	/** Lock multiplier in 18-decimal fixed-point units. */
	lock_multiplier: BigIntAsString;
}>;

/** V2 wrapped event payload for locking a position. */
export type FarmsLockedEventOnChainV2 = WrappedEventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	staked_type: CoinType;
	/** Position principal as a decimal string in base units. */
	staked_amount: BigIntAsString;
	/** Lock start timestamp in milliseconds. */
	lock_start_timestamp_ms: BigIntAsString;
	/** Lock duration in milliseconds. */
	lock_duration_ms: BigIntAsString;
	/** Lock multiplier in 18-decimal fixed-point units. */
	lock_multiplier: BigIntAsString;
}>;

/** V1 direct event payload for splitting a staked position. */
export type FarmsSplitEventOnChainV1 = EventOnChain<{
	/** Original position object ID. */
	staked_position_id: ObjectId;
	/** Newly created split-position object ID. */
	split_staked_position_id: ObjectId;
}>;

/** V2 wrapped event payload for splitting a staked position. */
export type FarmsSplitEventOnChainV2 = WrappedEventOnChain<{
	/** Original position object ID. */
	staked_position_id: ObjectId;
	/** Newly created split-position object ID. */
	split_staked_position_id: ObjectId;
}>;

/** V1 direct event payload for creating a strictly locked position. */
export type FarmsStakedEventOnChainV1 = EventOnChain<{
	/** Created staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	staked_type: CoinType;
	/** Deposited principal as a decimal string in base units. */
	staked_amount: BigIntAsString;
	/** Principal after applying the lock multiplier. */
	multiplied_staked_amount: BigIntAsString;
	/** Lock start timestamp in milliseconds. */
	lock_start_timestamp_ms: BigIntAsString;
	/** Lock duration in milliseconds. */
	lock_duration_ms: BigIntAsString;
	/** Lock multiplier in 18-decimal fixed-point units. */
	lock_multiplier: BigIntAsString;
}>;

/** V2 wrapped event payload for creating a strictly locked position. */
export type FarmsStakedEventOnChainV2 = WrappedEventOnChain<{
	/** Created staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	staked_type: CoinType;
	/** Deposited principal as a decimal string in base units. */
	staked_amount: BigIntAsString;
	/** Principal after applying the lock multiplier. */
	multiplier_staked_amount: BigIntAsString;
	/** Lock start timestamp in milliseconds. */
	lock_start_timestamp_ms: BigIntAsString;
	/** Lock duration in milliseconds. */
	lock_duration_ms: BigIntAsString;
	/** Lock multiplier in 18-decimal fixed-point units. */
	lock_multiplier: BigIntAsString;
}>;

/** V1 direct event payload for creating a relaxed-lock position. */
export type FarmsStakedRelaxedEventOnChainV1 = EventOnChain<{
	/** Created staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	staked_type: CoinType;
	/** Deposited principal as a decimal string in base units. */
	staked_amount: BigIntAsString;
	/** Lock start timestamp in milliseconds. */
	lock_start_timestamp_ms: BigIntAsString;
	/** Lock end timestamp in milliseconds. */
	lock_end_timestamp_ms: BigIntAsString;
}>;

/** V1 direct event payload for unlocking a position. */
export type FarmsUnlockedEventOnChainV1 = EventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	staked_type: CoinType;
	/** Unlocked principal as a decimal string in base units. */
	staked_amount: BigIntAsString;
}>;

/** V2 wrapped event payload for unlocking a position. */
export type FarmsUnlockedEventOnChainV2 = WrappedEventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Staked coin type. */
	staked_type: CoinType;
	/** Unlocked principal as a decimal string in base units. */
	staked_amount: BigIntAsString;
}>;

/** V1 direct event payload for withdrawing principal. */
export type FarmsWithdrewPrincipalEventOnChainV1 = EventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Withdrawn amount as a decimal string in base units. */
	amount: BigIntAsString;
	/** Staked coin type. */
	stake_type: CoinType;
}>;

/** V2 wrapped event payload for withdrawing principal. */
export type FarmsWithdrewPrincipalEventOnChainV2 = WrappedEventOnChain<{
	/** Staked-position object ID. */
	staked_position_id: ObjectId;
	/** Staking-pool object ID. */
	vault_id: ObjectId;
	/** Withdrawn amount as a decimal string in base units. */
	amount: BigIntAsString;
	/** Staked coin type. */
	stake_type: CoinType;
}>;
