import type {
	Balance,
	Event,
	Object,
	Timestamp,
} from "../../general/types/generalTypes";
import type { ObjectId, SuiAddress } from "../../types";
import type { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Name Only
// =========================================================================

/**
 * A lock multiplier stored as an 18-decimal fixed-point `bigint`.
 *
 * `1_000_000_000_000_000_000n` represents `1.0`. The multiplier scales the
 * position's principal for reward-share calculations.
 */
export type FarmsMultiplier = bigint;

/**
 * Identifies the farm contract version that produced an object or event.
 *
 * Version 1 uses the legacy `afterburner_vault` modules. Version 2 uses the
 * `vault` modules and wraps its event payloads under `parsedJson.pos0`.
 */
export type FarmsVersion = 1 | 2;

// =========================================================================
//  Helpers
// =========================================================================

/**
 * Identifies the capability that authorizes a staking-pool administration
 * transaction.
 */
export type FarmOwnerOrOneTimeAdminCap =
	| {
		/** Object ID of the pool owner capability. */
		ownerCapId: ObjectId;
	}
	| {
		/** Object ID of the one-time admin capability. */
		oneTimeAdminCapId: ObjectId;
	};

// =========================================================================
//  Objects
// =========================================================================

// =========================================================================
//  Staking Pool
// =========================================================================

/**
 * Defines how a staking pool treats a position whose lock has not expired.
 *
 * `Strict` prevents principal withdrawal while the position is locked.
 * `Relaxed` permits principal withdrawal while the position is locked, with
 * the on-chain contract applying the relaxed-lock reward rules.
 */
export type FarmsLockEnforcement = "Strict" | "Relaxed";

/**
 * Describes one reward coin's emission schedule and balances in a staking
 * pool. Amounts are in the reward coin's smallest unit, and timestamps and
 * intervals are in milliseconds.
 */
export interface FarmsStakingPoolRewardCoin {
	/** The fully qualified Move type of the reward coin. */
	coinType: CoinType;
	/** The total reward amount configured for this coin, in base units. */
	rewards: Balance;
	/** Cumulative rewards allocated per fixed-point unit of pool share. */
	rewardsAccumulatedPerShare: Balance;
	/** The reward amount emitted at each completed emission interval, in base units. */
	emissionRate: Balance;
	/** The emission interval in milliseconds. */
	emissionSchedulesMs: Timestamp;
	/** The timestamp in milliseconds when emission for this reward coin starts. */
	emissionStartTimestamp: Timestamp;
	/** The last emission checkpoint in milliseconds. */
	lastRewardTimestamp: Timestamp;
	/** The configured reward balance that has not yet been emitted. */
	rewardsRemaining: Balance;
	/** The reward balance currently held by the pool object, in base units. */
	actualRewards: Balance;
}

/**
 * The normalized SDK view of a staking pool, also called a vault on chain.
 *
 * The pool defines the stake coin, minimum and maximum lock durations, the
 * fixed-point multiplier range, and the reward schedules used for positions.
 */
export interface FarmsStakingPoolObject extends Object {
	/** The fully qualified Move type of the coin that users stake. */
	stakeCoinType: CoinType;
	/** The total staked principal, in the stake coin's base units. */
	stakedAmount: Balance;
	/** The total reward-weighted stake, in base units scaled by each position's multiplier. */
	stakedAmountWithMultiplier: Balance;
	/** The shortest accepted lock duration, in milliseconds. */
	minLockDurationMs: Timestamp;
	/** The longest lock duration used when calculating a position's multiplier, in milliseconds. */
	maxLockDurationMs: Timestamp;
	/** The largest lock multiplier, using 18-decimal fixed-point scaling. */
	maxLockMultiplier: FarmsMultiplier;
	/** Reward coin schedules and balances configured for this pool. */
	rewardCoins: FarmsStakingPoolRewardCoin[];
	/** The timestamp in milliseconds after which the pool stops emitting rewards. */
	emissionEndTimestamp: Timestamp;
	/** The minimum principal required for a position, in stake-coin base units. */
	minStakeAmount: Balance;
	/** Whether the pool is forcibly open for position actions, even before lock expiry. */
	isUnlocked: boolean;
	/** The policy that controls principal withdrawal before a position's lock expires. */
	lockEnforcement: FarmsLockEnforcement;
	/** The farm contract version represented by this object. */
	version: FarmsVersion;
}

/**
 * An owner capability that authorizes administrative mutations for one staking
 * pool, such as changing emissions or minimum amounts.
 */
export interface StakingPoolOwnerCapObject extends Object {
	/** The object ID of the staking pool controlled by this capability. */
	stakingPoolId: ObjectId;
}

/**
 * A one-time admin capability for a staking pool. The capability can authorize
 * the one-time reward initialization flow before it is consumed on chain.
 */
export interface StakingPoolOneTimeAdminCapObject extends Object {
	/** The object ID of the staking pool associated with this capability. */
	stakingPoolId: ObjectId;
}

// =========================================================================
//  Staked Position
// =========================================================================

/**
 * A position's reward accounting for one reward coin. All amounts are in the
 * reward coin's base units; debt fields are the last per-share checkpoints used
 * to avoid counting the same emission twice.
 */
export interface FarmsStakedPositionRewardCoin {
	/** The fully qualified Move type of the reward coin. */
	coinType: CoinType;
	/** Base rewards accrued for the position since its last accounting update. */
	baseRewardsAccumulated: Balance;
	/** The total base reward recorded at the last accounting checkpoint. */
	baseRewardsDebt: Balance;
	/** Additional rewards accrued from the position's lock multiplier. */
	multiplierRewardsAccumulated: Balance;
	/** The total multiplier reward recorded at the last accounting checkpoint. */
	multiplierRewardsDebt: Balance;
}

/**
 * The normalized SDK view of a user's staked position.
 *
 * A position keeps its principal, the reward-weighted amount derived from its
 * lock multiplier, its lock window, and per-reward-coin accounting fields.
 */
export interface FarmsStakedPositionObject extends Object {
	/** The object ID of the staking pool that owns this position. */
	stakingPoolObjectId: ObjectId;
	/** The fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** The position's principal, in stake-coin base units. */
	stakedAmount: Balance;
	/** The position's reward-weighted stake, in fixed-point-scaled base units. */
	stakedAmountWithMultiplier: Balance;
	/** The lock start timestamp, in milliseconds. */
	lockStartTimestamp: Timestamp;
	/** The lock duration, in milliseconds. */
	lockDurationMs: Timestamp;
	/** The position's lock multiplier using 18-decimal fixed-point scaling. */
	lockMultiplier: FarmsMultiplier;
	/** Reward accounting records for the pool's reward coin types. */
	rewardCoins: FarmsStakedPositionRewardCoin[];
	/** The last reward-accounting or harvest timestamp, in milliseconds. */
	lastHarvestRewardsTimestamp: Timestamp;
	/** The farm contract version represented by this position. */
	version: FarmsVersion;
}

/**
 * A staked-position view used by legacy ownership reads.
 *
 * The reward entries omit `coinType` because the legacy object response does
 * not include the reward type alongside each parallel reward array.
 */
export type PartialFarmsStakedPositionObject = Omit<
	FarmsStakedPositionObject,
	"rewardCoins"
> & {
	/** Reward accounting entries without a coin type, in on-chain array order. */
	rewardCoins: Omit<FarmsStakedPositionRewardCoin, "coinType">[];
};

// =========================================================================
//  Events
// =========================================================================

/**
 * Union of normalized farm lifecycle events.
 *
 * The variants cover pool creation and reward setup, position creation and
 * mutation, locking and unlocking, reward harvesting, and principal changes.
 */
export type FarmEvent =
	| FarmsAddedRewardEvent
	| FarmsCreatedVaultEvent
	| FarmsDepositedPrincipalEvent
	| FarmsDestroyedStakedPositionEvent
	| FarmsHarvestedRewardsEvent
	| FarmsIncreasedEmissionsEvent
	| FarmsInitializedRewardEvent
	| FarmsJoinedEvent
	| FarmsLockedEvent
	| FarmsSplitEvent
	| FarmsStakedEvent
	| FarmsStakedRelaxedEvent
	| FarmsUnlockedEvent
	| FarmsWithdrewPrincipalEvent;

/**
 * Union of farm events returned by the user-interaction event read.
 *
 * It includes staking, locking, harvesting, principal deposits, unlocks, and
 * principal withdrawals. Pool administration and position join or split
 * events are not part of this union.
 */
export type FarmUserEvent =
	| FarmsDepositedPrincipalEvent
	| FarmsHarvestedRewardsEvent
	| FarmsLockedEvent
	| FarmsStakedEvent
	| FarmsUnlockedEvent
	| FarmsWithdrewPrincipalEvent;
// | FarmsDestroyedStakedPositionEvent
// | FarmsJoinedEvent
// | FarmsSplitEvent
// | FarmsStakedRelaxedEvent

/** Returns `true` when an interaction event records a principal deposit. */
export const isFarmsDepositedPrincipalEvent = (
	event: FarmUserEvent
): event is FarmsDepositedPrincipalEvent => {
	return event.type.toLowerCase().includes("::depositedprincipalevent");
};

/** Returns `true` when an interaction event records reward harvesting. */
export const isFarmsHarvestedRewardsEvent = (
	event: FarmUserEvent
): event is FarmsHarvestedRewardsEvent => {
	return event.type.toLowerCase().includes("::harvestedrewardsevent");
};

/** Returns `true` when an interaction event records a position lock. */
export const isFarmsLockedEvent = (
	event: FarmUserEvent
): event is FarmsLockedEvent => {
	return event.type.toLowerCase().includes("::lockedevent");
};

/** Returns `true` when an interaction event records strict staking. */
export const isFarmsStakedEvent = (
	event: FarmUserEvent
): event is FarmsStakedEvent => {
	return event.type.toLowerCase().includes("::stakedevent");
};

/** Returns `true` when an interaction event records an unlock. */
export const isFarmsUnlockedEvent = (
	event: FarmUserEvent
): event is FarmsUnlockedEvent => {
	return event.type.toLowerCase().includes("::unlockedevent");
};

/** Returns `true` when an interaction event records a principal withdrawal. */
export const isFarmsWithdrewPrincipalEvent = (
	event: FarmUserEvent
): event is FarmsWithdrewPrincipalEvent => {
	return event.type.toLowerCase().includes("::withdrewprincipalevent");
};

/** Fired when additional reward tokens are added to a staking pool. */
export interface FarmsAddedRewardEvent extends Event {
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the reward coin. */
	rewardType: CoinType;
	/** The added reward amount, in the reward coin's base units. */
	rewardAmount: Balance;
}

/** Fired when a new staking pool is created. */
export interface FarmsCreatedVaultEvent extends Event {
	/** The object ID of the created staking pool. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the staked coin. */
	stakeType: CoinType;
	/** The pool's minimum lock duration, in milliseconds. */
	minLockDurationMs: Timestamp;
	/** The pool's maximum lock duration, in milliseconds. */
	maxLockDurationMs: Timestamp;
	/** The pool's maximum lock multiplier in 18-decimal fixed-point units. */
	maxLockMultiplier: FarmsMultiplier;
	/** The minimum principal required for a position, in base units. */
	minStakeAmount: Balance;
}

/** Fired when additional principal is deposited into a staked position. */
export interface FarmsDepositedPrincipalEvent extends Event {
	/** The staked-position object ID. */
	stakedPositionId: ObjectId;
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The deposited amount, in the stake coin's base units. */
	amount: Balance;
	/** The fully qualified Move type of the staked coin. */
	stakeType: CoinType;
}

/** Fired when an empty staked-position object is destroyed. */
export interface FarmsDestroyedStakedPositionEvent extends Event {
	/** The destroyed staked-position object ID. */
	stakedPositionId: ObjectId;
}

/** Fired when rewards are harvested from one or more staked positions. */
export interface FarmsHarvestedRewardsEvent extends Event {
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** Reward coin types in the same order as `rewardAmounts`. */
	rewardTypes: CoinType[];
	/** Harvested amounts in base units, parallel to `rewardTypes`. */
	rewardAmounts: Balance[];
}

/** Fired when a reward coin's emission schedule or rate is increased. */
export interface FarmsIncreasedEmissionsEvent extends Event {
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the reward coin. */
	rewardType: CoinType;
	/** The emission interval in milliseconds. */
	emissionScheduleMs: Timestamp;
	/** The amount emitted per interval, in the reward coin's base units. */
	emissionRate: Balance;
}

/** Fired when a reward coin is initialized in a staking pool. */
export interface FarmsInitializedRewardEvent extends Event {
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the initialized reward coin. */
	rewardType: CoinType;
	/** The initial reward amount, in the reward coin's base units. */
	rewardAmount: Balance;
	/** The amount emitted at each interval, in base units. */
	emissionRate: Balance;
	/** The emission start timestamp in milliseconds. */
	emissionStartMs: Timestamp;
}

/** Fired when two staked positions are joined. */
export interface FarmsJoinedEvent extends Event {
	/** The object ID of the position that remains after the join. */
	stakedPositionId: ObjectId;
	/** The object ID of the position consumed by the join. */
	otherStakedPositionId: ObjectId;
}

/** Fired when a position is locked with a duration and multiplier. */
export interface FarmsLockedEvent extends Event {
	/** The staked-position object ID. */
	stakedPositionId: ObjectId;
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the staked coin. */
	stakedType: CoinType;
	/** The position's principal, in the stake coin's base units. */
	stakedAmount: Balance;
	/** The lock start timestamp in milliseconds. */
	lockStartTimestampMs: Timestamp;
	/** The lock duration in milliseconds. */
	lockDurationMs: Timestamp;
	/** The position's lock multiplier in 18-decimal fixed-point units. */
	lockMultiplier: FarmsMultiplier;
}

/** Fired when a staked position is split into two positions. */
export interface FarmsSplitEvent extends Event {
	/** The original staked-position object ID. */
	stakedPositionId: ObjectId;
	/** The newly created split-position object ID. */
	splitStakedPositionId: ObjectId;
}

/** Fired when a user creates a strictly locked position. */
export interface FarmsStakedEvent extends Event {
	/** The created staked-position object ID. */
	stakedPositionId: ObjectId;
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the staked coin. */
	stakedType: CoinType;
	/** The deposited principal, in the stake coin's base units. */
	stakedAmount: Balance;
	/** The principal after applying the lock multiplier. */
	multipliedStakedAmount: Balance;
	/** The lock start timestamp in milliseconds. */
	lockStartTimestampMs: Timestamp;
	/** The lock duration in milliseconds. */
	lockDurationMs: Timestamp;
	/** The position's lock multiplier in 18-decimal fixed-point units. */
	lockMultiplier: FarmsMultiplier;
}

/** Fired when a user creates a position under relaxed lock enforcement. */
export interface FarmsStakedRelaxedEvent extends Event {
	/** The created staked-position object ID. */
	stakedPositionId: ObjectId;
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the staked coin. */
	stakedType: CoinType;
	/** The deposited principal, in the stake coin's base units. */
	stakedAmount: Balance;
	/** The lock start timestamp in milliseconds. */
	lockStartTimestampMs: Timestamp;
	/** The lock end timestamp in milliseconds. */
	lockEndTimestampMs: Timestamp;
}

/** Fired when a staked position is unlocked. */
export interface FarmsUnlockedEvent extends Event {
	/** The staked-position object ID. */
	stakedPositionId: ObjectId;
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The fully qualified Move type of the staked coin. */
	stakedType: CoinType;
	/** The principal unlocked, in the stake coin's base units. */
	stakedAmount: Balance;
}

/** Fired when principal is withdrawn from a staked position. */
export interface FarmsWithdrewPrincipalEvent extends Event {
	/** The staked-position object ID. */
	stakedPositionId: ObjectId;
	/** The staking pool object ID. */
	vaultId: ObjectId;
	/** The withdrawn amount, in the stake coin's base units. */
	amount: Balance;
	/** The fully qualified Move type of the staked coin. */
	stakeType: CoinType;
}

// =========================================================================
//  API
// =========================================================================

/** TVL and reward TVL metrics returned for one staking pool. */
export interface FarmSummary {
	/** The staking pool object ID represented by the row. */
	farmId: ObjectId;
	/** The pool's total value locked, in the API's reporting currency. */
	tvl: number;
	/** The value of reward balances locked in the pool, in the API's reporting currency. */
	rewardsTvl: number;
}

/** Optional filter for a batch farm-summary read. */
export interface ApiFarmsSummaryBody {
	/** Pool IDs to include. Omit the field to request all pools. */
	farmIds?: ObjectId[];
	/** Numeric result offset for a bounded page. */
	cursor?: number;
	/** Requested page size. The service caps explicit ID pages at 32. */
	limit?: number;
}

// =========================================================================
//  Staked Positions API
// =========================================================================

/** Request body for reading all staked positions owned by one address. */
export interface ApiFarmsOwnedStakedPositionsBody {
	/** Wallet address whose owned positions the indexer should return. */
	walletAddress: SuiAddress;
	/** Numeric result offset for a bounded page. */
	cursor?: number;
	/** Requested page size, capped at 32 by the service. */
	limit?: number;
}

// =========================================================================
//  Staking API
// =========================================================================

/** Parameters for building a V2 transaction that creates a staked position. */
export interface ApiFarmsStakeBody {
	/** Staking pool object ID. */
	stakingPoolId: ObjectId;
	/** Requested lock duration, in milliseconds. */
	lockDurationMs: Timestamp;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Principal to stake, in the stake coin's base units. */
	stakeAmount: Balance;
	/** Address that supplies the coin and signs the transaction. */
	walletAddress: SuiAddress;
	// lockEnforcement: FarmsLockEnforcement;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
}

/**
 * Parameters for the deprecated V1 stake transaction builder.
 *
 * @deprecated Use `ApiFarmsStakeBody`.
 */
export interface ApiFarmsStakeBodyV1 {
	/** Staking pool object ID. */
	stakingPoolId: ObjectId;
	/** Requested lock duration, in milliseconds. */
	lockDurationMs: Timestamp;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Principal to stake, in the stake coin's base units. */
	stakeAmount: Balance;
	/** Address that supplies the coin and signs the transaction. */
	walletAddress: SuiAddress;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
}

/** Parameters for adding principal to an existing staked position. */
export interface ApiFarmsDepositPrincipalBody {
	/** Staked-position object ID. */
	stakedPositionId: ObjectId;
	/** Staking pool object ID that owns the position. */
	stakingPoolId: ObjectId;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Additional principal, in the stake coin's base units. */
	depositAmount: Balance;
	/** Address that supplies the coin and signs the transaction. */
	walletAddress: SuiAddress;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
}

/** Parameters for withdrawing principal and optionally harvesting rewards. */
export interface ApiFarmsUnstakeBody {
	/** Staked-position object ID. */
	stakedPositionId: ObjectId;
	/** Staking pool object ID that owns the position. */
	stakingPoolId: ObjectId;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Reward coin types to harvest before the position is destroyed. */
	rewardCoinTypes: CoinType[];
	/** Principal to withdraw, in the stake coin's base units. */
	withdrawAmount: Balance;
	/** Address that signs the transaction. */
	walletAddress: SuiAddress;
	/** Whether SUI rewards should be claimed as afSUI when supported. */
	claimSuiAsAfSui?: boolean;
}

// =========================================================================
//  Locking API
// =========================================================================

/** Parameters for building a V2 transaction that applies a lock multiplier. */
export interface ApiFarmsLockBody {
	/** Staked-position object ID. */
	stakedPositionId: ObjectId;
	/** Staking pool object ID that owns the position. */
	stakingPoolId: ObjectId;
	/** Requested lock duration, in milliseconds. */
	lockDurationMs: Timestamp;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Address that signs the transaction. */
	walletAddress: SuiAddress;
}

/** Parameters for renewing a position's existing lock. */
export interface ApiFarmsRenewLockBody {
	/** Staked-position object ID. */
	stakedPositionId: ObjectId;
	/** Staking pool object ID that owns the position. */
	stakingPoolId: ObjectId;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Address that signs the transaction. */
	walletAddress: SuiAddress;
}

/** Parameters for building a transaction that removes a position's lock. */
export interface ApiFarmsUnlockBody {
	/** Staked-position object ID. */
	stakedPositionId: ObjectId;
	/** Staking pool object ID that owns the position. */
	stakingPoolId: ObjectId;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Address that signs the transaction. */
	walletAddress: SuiAddress;
}

// =========================================================================
//  Harvest Rewards API
// =========================================================================

/** Parameters for harvesting selected reward types from one or more positions. */
export interface ApiHarvestFarmsRewardsBody {
	/** Staking pool object ID that owns the positions. */
	stakingPoolId: ObjectId;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Staked-position object IDs to harvest. */
	stakedPositionIds: ObjectId[];
	/** Reward coin types to harvest for each position. */
	rewardCoinTypes: CoinType[];
	/** Address that signs the transaction. */
	walletAddress: SuiAddress;
	/** Whether SUI rewards should be claimed as afSUI when supported. */
	claimSuiAsAfSui?: boolean;
}

// =========================================================================
//  Staking Pool API
// =========================================================================

// =========================================================================
//  Staking Pool Creation API
// =========================================================================

/** Parameters for creating a V2 staking pool. */
export interface ApiFarmsCreateStakingPoolBody {
	// lockEnforcements: FarmsLockEnforcement[];
	/** Minimum accepted lock duration, in milliseconds. */
	minLockDurationMs: Timestamp;
	/** Maximum multiplier-bearing lock duration, in milliseconds. */
	maxLockDurationMs: Timestamp;
	/** Maximum lock multiplier in 18-decimal fixed-point units. */
	maxLockMultiplier: FarmsMultiplier;
	/** Minimum principal for a position, in stake-coin base units. */
	minStakeAmount: Balance;
	/** Fully qualified Move type of the coin users will stake. */
	stakeCoinType: CoinType;
	/** Address that creates the pool and receives its owner capability. */
	walletAddress: SuiAddress;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
}

/**
 * Parameters for creating a V1 staking pool.
 *
 * @deprecated Use `ApiFarmsCreateStakingPoolBody`.
 */
export interface ApiFarmsCreateStakingPoolBodyV1 {
	// lockEnforcement: FarmsLockEnforcement;
	/** Minimum accepted lock duration, in milliseconds. */
	minLockDurationMs: Timestamp;
	/** Maximum multiplier-bearing lock duration, in milliseconds. */
	maxLockDurationMs: Timestamp;
	/** Maximum lock multiplier in 18-decimal fixed-point units. */
	maxLockMultiplier: FarmsMultiplier;
	/** Minimum principal for a position, in stake-coin base units. */
	minStakeAmount: Balance;
	/** Fully qualified Move type of the coin users will stake. */
	stakeCoinType: CoinType;
	/** Address that creates the pool and receives its owner capability. */
	walletAddress: SuiAddress;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
}

// =========================================================================
//  Staking Pool Mutation API
// =========================================================================

/** Parameters for initializing one reward coin in a staking pool. */
export type ApiFarmsInitializeStakingPoolRewardBody = {
	/** Staking pool object ID. */
	stakingPoolId: ObjectId;
	/** Initial reward amount, in the reward coin's base units. */
	rewardAmount: Balance;
	/** Emission interval, in milliseconds. */
	emissionScheduleMs: Timestamp;
	/** Reward amount emitted at each interval, in base units. */
	emissionRate: bigint;
	/** Emission start or delay timestamp, in milliseconds. */
	emissionDelayTimestampMs: Timestamp;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Fully qualified Move type of the reward coin. */
	rewardCoinType: CoinType;
	/** Address that supplies the reward coin and signs the transaction. */
	walletAddress: SuiAddress;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
} & FarmOwnerOrOneTimeAdminCap;

/** Parameters for adding reward balances to existing reward coins. */
export type ApiFarmsTopUpStakingPoolRewardsBody = {
	/** Staking pool object ID. */
	stakingPoolId: ObjectId;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Reward top-ups to append to the transaction. */
	rewards: {
		/** Fully qualified Move type of the reward coin. */
		rewardCoinType: CoinType;
		/** Reward amount to add, in the reward coin's base units. */
		rewardAmount: Balance;
	}[];
	/** Address that supplies the reward coins and signs the transaction. */
	walletAddress: SuiAddress;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
} & FarmOwnerOrOneTimeAdminCap;

/** Parameters for increasing emission schedules for existing reward coins. */
export interface ApiFarmsIncreaseStakingPoolRewardsEmissionsBody {
	/** Object ID of the owner capability authorizing the update. */
	ownerCapId: ObjectId;
	/** Staking pool object ID. */
	stakingPoolId: ObjectId;
	/** Fully qualified Move type of the staked coin. */
	stakeCoinType: CoinType;
	/** Emission updates, one entry per reward coin. */
	rewards: {
		/** Fully qualified Move type of the reward coin. */
		rewardCoinType: CoinType;
		/** New emission interval, in milliseconds. */
		emissionScheduleMs: Timestamp;
		/** New amount emitted per interval, in the reward coin's base units. */
		emissionRate: bigint;
	}[];
	/** Address that signs the transaction. */
	walletAddress: SuiAddress;
}

/** Request body for reading owner capabilities owned by an address. */
export interface ApiFarmsOwnedStakingPoolOwnerCapsBody {
	/** Wallet address whose owner capabilities should be returned. */
	walletAddress: SuiAddress;
	/** Zero-based result offset. */
	cursor?: number;
	/** Maximum number of capabilities to return, capped at 32. */
	limit?: number;
}

/** Request body for reading one-time admin capabilities owned by an address. */
export interface ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody {
	/** Wallet address whose one-time admin capabilities should be returned. */
	walletAddress: SuiAddress;
	/** Zero-based result offset. */
	cursor?: number;
	/** Maximum number of capabilities to return, capped at 32. */
	limit?: number;
}

/** Parameters for granting a one-time admin capability for one reward coin. */
export interface ApiFarmsGrantOneTimeAdminCapBody {
	/** Object ID of the pool owner capability authorizing the grant. */
	ownerCapId: ObjectId;
	/** Address that receives the one-time admin capability. */
	recipientAddress: SuiAddress;
	/** Fully qualified Move type of the reward coin the recipient may initialize. */
	rewardCoinType: CoinType;
	/** Address that owns `ownerCapId` and signs the transaction. */
	walletAddress: SuiAddress;
	/** Whether to request the sponsored transaction flow. */
	isSponsoredTx?: boolean;
}
