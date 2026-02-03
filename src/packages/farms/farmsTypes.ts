import { ObjectId, SuiAddress } from "../../types";
import {
	Balance,
	Event,
	Object,
	Timestamp,
} from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Name Only
// =========================================================================

/**
 * A multiplier type (in fixed-point bigint) used to scale a staked amount based on lock duration.
 * Typically, 1.0 is represented as 1e9 (i.e., `FixedUtils.fixedOneB`).
 */
export type FarmsMultiplier = bigint;

/**
 * Enumerates the supported farm system versions.
 */
export type FarmsVersion = 1 | 2;

// =========================================================================
//  Helpers
// =========================================================================

/**
 * A union type indicating whether an action is authorized by the `ownerCapId`
 * or by a `oneTimeAdminCapId`.
 */
export type FarmOwnerOrOneTimeAdminCap =
	| { ownerCapId: ObjectId }
	| { oneTimeAdminCapId: ObjectId };

// =========================================================================
//  Objects
// =========================================================================

// =========================================================================
//  Staking Pool
// =========================================================================

/**
 * Indicates how strictly the lock duration is enforced in the vault.
 * - **Strict**: The position cannot be unlocked before the lock period ends.
 * - **Relaxed**: The position can be unlocked early, but may have penalized rewards.
 */
export type FarmsLockEnforcement = "Strict" | "Relaxed";

/**
 * Describes a single reward coin's parameters and state within a staking pool.
 */
export interface FarmsStakingPoolRewardCoin {
	/**
	 * The coin type of this reward (e.g., "0x2::sui::SUI").
	 */
	coinType: CoinType;
	/**
	 * The total number of reward tokens allocated for this pool (in smallest units).
	 */
	rewards: Balance;
	/**
	 * Represents how many rewards are allocated per share in the pool. The share
	 * is typically the "stakedAmountWithMultiplier".
	 */
	rewardsAccumulatedPerShare: Balance;
	/**
	 * The emission rate per emission schedule for this reward coin. For example, if
	 * `emissionSchedulesMs` is 1 hour, then this emissionRate is distributed each hour.
	 */
	emissionRate: Balance;
	/**
	 * The interval (in ms) at which the emissionRate is released.
	 */
	emissionSchedulesMs: Timestamp;
	/**
	 * The timestamp (ms) when emission for this reward coin starts.
	 */
	emissionStartTimestamp: Timestamp;
	/**
	 * The last timestamp (ms) at which rewards were emitted for this reward coin.
	 */
	lastRewardTimestamp: Timestamp;
	/**
	 * The total number of rewards still available. If we have distributed
	 * part of `rewards`, the remainder is `rewardsRemaining`.
	 */
	rewardsRemaining: Balance;
	/**
	 * The actual number of reward tokens in the pool's on-chain object. This can differ
	 * from `rewards` for internal or reserved logic.
	 */
	actualRewards: Balance;
}

/**
 * Represents the core object for a staking pool (a "vault"). It includes
 * information about staking amounts, locking constraints, reward coins,
 * and emission parameters.
 */
export interface FarmsStakingPoolObject extends Object {
	/**
	 * The coin type that users stake into this pool.
	 */
	stakeCoinType: CoinType;
	/**
	 * The total amount of staked tokens (principal) in this pool, in smallest units.
	 */
	stakedAmount: Balance;
	/**
	 * The total staked amount multiplied by users' lock multipliers. Used for reward calculations.
	 */
	stakedAmountWithMultiplier: Balance;
	/**
	 * The minimum time (ms) that a position can be locked for a valid multiplier.
	 */
	minLockDurationMs: Timestamp;
	/**
	 * The maximum time (ms) that a position can be locked. The position's lock multiplier is derived from
	 * minLockDurationMs to maxLockDurationMs.
	 */
	maxLockDurationMs: Timestamp;
	/**
	 * The maximum lock multiplier in fixed-point representation (1.0 = 1e9).
	 */
	maxLockMultiplier: FarmsMultiplier;
	/**
	 * An array of reward coins that this pool distributes.
	 */
	rewardCoins: FarmsStakingPoolRewardCoin[];
	/**
	 * The timestamp (ms) after which no further emissions occur.
	 */
	emissionEndTimestamp: Timestamp;
	/**
	 * The minimum stake required to open a position in this pool.
	 */
	minStakeAmount: Balance;
	/**
	 * Whether the pool is forcibly unlocked. If `true`, positions might be able to exit early.
	 */
	isUnlocked: boolean;
	/**
	 * The lock enforcement policy for this pool.
	 * - "Strict": positions must be unlocked before any principal can be withdrawn
	 * - "Relaxed": positions can withdraw principal while locked, forfeiting pro-rata locked rewards
	 */
	lockEnforcement: FarmsLockEnforcement;
	/**
	 * Indicates whether this is version 1 or version 2 of the farm system.
	 */
	version: FarmsVersion;
}

/**
 * Represents the owner's capability to manage a specific staking pool. Typically
 * allows updating emission rates, reward coins, or other parameters.
 */
export interface StakingPoolOwnerCapObject extends Object {
	/**
	 * The staking pool (vault) ID associated with this owner cap.
	 */
	stakingPoolId: ObjectId;
}

/**
 * Represents a one-time admin capability object for a specific staking pool. Allows
 * the holder to initialize a new reward coin once.
 */
export interface StakingPoolOneTimeAdminCapObject extends Object {
	/**
	 * The staking pool (vault) ID associated with this admin cap.
	 */
	stakingPoolId: ObjectId;
}

// =========================================================================
//  Staked Position
// =========================================================================

/**
 * Represents the rewards accumulated and owed to a staked position for a specific coin type.
 */
export interface FarmsStakedPositionRewardCoin {
	/**
	 * The coin type of the reward.
	 */
	coinType: CoinType;
	/**
	 * The base (non-multiplied) rewards accrued since the position was opened or last updated.
	 */
	baseRewardsAccumulated: Balance;
	/**
	 * The base rewards debt, representing the total base rewards from time t0 to the last update checkpoint.
	 */
	baseRewardsDebt: Balance;
	/**
	 * The multiplier-based rewards accrued, factoring in the lock multiplier, since the position was opened or last updated.
	 */
	multiplierRewardsAccumulated: Balance;
	/**
	 * The multiplier-based rewards debt, from time t0 to the last update checkpoint.
	 */
	multiplierRewardsDebt: Balance;
}

/**
 * Represents a user's staked position in a specific staking pool, including
 * the lock parameters, staked amounts, and accumulated rewards.
 */
export interface FarmsStakedPositionObject extends Object {
	/**
	 * The on-chain object ID of the pool in which this position is staked.
	 */
	stakingPoolObjectId: ObjectId;
	/**
	 * The coin type that was staked into this position (matching the pool's stakeCoinType).
	 */
	stakeCoinType: CoinType;
	/**
	 * The amount of principal staked in smallest units.
	 */
	stakedAmount: Balance;
	/**
	 * The principal multiplied by the lock multiplier.
	 */
	stakedAmountWithMultiplier: Balance;
	/**
	 * The timestamp (ms) when this position’s lock started.
	 */
	lockStartTimestamp: Timestamp;
	/**
	 * The duration (ms) for which this position is locked.
	 */
	lockDurationMs: Timestamp;
	/**
	 * The current lock multiplier in fixed-point representation.
	 */
	lockMultiplier: FarmsMultiplier;
	/**
	 * An array of reward coins that track base + multiplier rewards for this position.
	 */
	rewardCoins: FarmsStakedPositionRewardCoin[];
	/**
	 * The last time (ms) that rewards were updated or harvested for this position.
	 */
	lastHarvestRewardsTimestamp: Timestamp;
	/**
	 * The farm system version of this staked position (1 or 2).
	 */
	version: FarmsVersion;
}

/**
 * A partial staked position structure sometimes used internally, excluding
 * certain fields like `coinType`.
 */
export type PartialFarmsStakedPositionObject = Omit<
	FarmsStakedPositionObject,
	"rewardCoins"
> & {
	rewardCoins: Omit<FarmsStakedPositionRewardCoin, "coinType">[];
};

// =========================================================================
//  Events
// =========================================================================

/**
 * A union type representing any possible event from a farm (vault) system.
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
 * A union type for events that specifically involve user interactions with a farm,
 * such as depositing principal, harvesting, or unlocking.
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

/**
 * Type guard to determine if a `FarmUserEvent` is a `FarmsDepositedPrincipalEvent`.
 */
export const isFarmsDepositedPrincipalEvent = (
	event: FarmUserEvent
): event is FarmsDepositedPrincipalEvent => {
	return event.type.toLowerCase().includes("::depositedprincipalevent");
};

/**
 * Type guard to determine if a `FarmUserEvent` is a `FarmsHarvestedRewardsEvent`.
 */
export const isFarmsHarvestedRewardsEvent = (
	event: FarmUserEvent
): event is FarmsHarvestedRewardsEvent => {
	return event.type.toLowerCase().includes("::harvestedrewardsevent");
};

/**
 * Type guard to determine if a `FarmUserEvent` is a `FarmsLockedEvent`.
 */
export const isFarmsLockedEvent = (
	event: FarmUserEvent
): event is FarmsLockedEvent => {
	return event.type.toLowerCase().includes("::lockedevent");
};

/**
 * Type guard to determine if a `FarmUserEvent` is a `FarmsStakedEvent`.
 */
export const isFarmsStakedEvent = (
	event: FarmUserEvent
): event is FarmsStakedEvent => {
	return event.type.toLowerCase().includes("::stakedevent");
};

/**
 * Type guard to determine if a `FarmUserEvent` is a `FarmsUnlockedEvent`.
 */
export const isFarmsUnlockedEvent = (
	event: FarmUserEvent
): event is FarmsUnlockedEvent => {
	return event.type.toLowerCase().includes("::unlockedevent");
};

/**
 * Type guard to determine if a `FarmUserEvent` is a `FarmsWithdrewPrincipalEvent`.
 */
export const isFarmsWithdrewPrincipalEvent = (
	event: FarmUserEvent
): event is FarmsWithdrewPrincipalEvent => {
	return event.type.toLowerCase().includes("::withdrewprincipalevent");
};

/**
 * Fired when additional reward tokens are added to a vault after creation.
 */
export interface FarmsAddedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: Balance;
}

/**
 * Fired when a new vault (staking pool) is created.
 */
export interface FarmsCreatedVaultEvent extends Event {
	vaultId: ObjectId;
	stakeType: CoinType;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
}

/**
 * Fired when principal is deposited into a staked position in the vault.
 */
export interface FarmsDepositedPrincipalEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	amount: Balance;
	stakeType: CoinType;
}

/**
 * Fired when a staked position object is destroyed.
 */
export interface FarmsDestroyedStakedPositionEvent extends Event {
	stakedPositionId: ObjectId;
}

/**
 * Fired when a user harvests their rewards from one or more staked positions.
 */
export interface FarmsHarvestedRewardsEvent extends Event {
	vaultId: ObjectId;
	rewardTypes: CoinType[];
	rewardAmounts: Balance[];
}

/**
 * Fired when emissions (or the emission schedule) are increased for a specific reward coin.
 */
export interface FarmsIncreasedEmissionsEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	emissionScheduleMs: Timestamp;
	emissionRate: Balance;
}

/**
 * Fired when a new reward coin is initialized in the vault.
 */
export interface FarmsInitializedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: Balance;
	emissionRate: Balance;
	emissionStartMs: Timestamp;
}

/**
 * Fired when two staked positions are combined (joined) into one.
 */
export interface FarmsJoinedEvent extends Event {
	stakedPositionId: ObjectId;
	otherStakedPositionId: ObjectId;
}

/**
 * Fired when a position is locked, specifying the lock duration and multiplier.
 */
export interface FarmsLockedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
	lockStartTimestampMs: Timestamp;
	lockDurationMs: Timestamp;
	lockMultiplier: FarmsMultiplier;
}

/**
 * Fired when a staked position is split into two separate positions.
 */
export interface FarmsSplitEvent extends Event {
	stakedPositionId: ObjectId;
	splitStakedPositionId: ObjectId;
}

/**
 * Fired when a user stakes a new position in the vault (version 1 only).
 */
export interface FarmsStakedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
	multipliedStakedAmount: Balance;
	lockStartTimestampMs: Timestamp;
	lockDurationMs: Timestamp;
	lockMultiplier: FarmsMultiplier;
}

/**
 * Fired when a user stakes a new position in the vault under "relaxed" locking (version 2).
 */
export interface FarmsStakedRelaxedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
	lockStartTimestampMs: Timestamp;
	lockEndTimestampMs: Timestamp;
}

/**
 * Fired when a position is unlocked.
 */
export interface FarmsUnlockedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
}

/**
 * Fired when principal is withdrawn from a staked position.
 */
export interface FarmsWithdrewPrincipalEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	amount: Balance;
	stakeType: CoinType;
}

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Staked Positions API
// =========================================================================

/**
 * Request body for fetching all staked positions owned by a given user.
 */
export interface ApiFarmsOwnedStakedPositionsBody {
	/**
	 * The user's wallet address whose positions are being queried.
	 */
	walletAddress: SuiAddress;
}

// =========================================================================
//  Staking API
// =========================================================================

/**
 * Request body for staking tokens in a pool (version 2).
 */
export interface ApiFarmsStakeBody {
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	stakeAmount: Balance;
	walletAddress: SuiAddress;
	// lockEnforcement: FarmsLockEnforcement;
	isSponsoredTx?: boolean;
}

/**
 * **Deprecated**: Use `ApiFarmsStakeBody` instead.
 */
export interface ApiFarmsStakeBodyV1 {
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	stakeAmount: Balance;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
}

/**
 * Request body for depositing additional principal into an existing staked position.
 */
export interface ApiFarmsDepositPrincipalBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	depositAmount: Balance;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
}

/**
 * Request body for fully or partially unstaking a position.
 */
export interface ApiFarmsUnstakeBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	rewardCoinTypes: CoinType[];
	withdrawAmount: Balance;
	walletAddress: SuiAddress;
	claimSuiAsAfSui?: boolean;
}

// =========================================================================
//  Locking API
// =========================================================================

/**
 * Request body for locking a staked position to gain a multiplier (version 2).
 */
export interface ApiFarmsLockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

/**
 * Request body for renewing an existing lock on a staked position.
 */
export interface ApiFarmsRenewLockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

/**
 * Request body for unlocking a staked position prior to or at lock expiry.
 */
export interface ApiFarmsUnlockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

// =========================================================================
//  Harvest Rewards API
// =========================================================================

/**
 * Request body for harvesting rewards from one or more staked positions.
 */
export interface ApiHarvestFarmsRewardsBody {
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	stakedPositionIds: ObjectId[];
	rewardCoinTypes: CoinType[];
	walletAddress: SuiAddress;
	claimSuiAsAfSui?: boolean;
}

// =========================================================================
//  Staking Pool API
// =========================================================================

// =========================================================================
//  Staking Pool Creation API
// =========================================================================

/**
 * Request body for creating a new staking pool (version 2).
 */
export interface ApiFarmsCreateStakingPoolBody {
	// lockEnforcements: FarmsLockEnforcement[];
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
}

/**
 * **Deprecated**: Use `ApiFarmsCreateStakingPoolBody` instead.
 */
export interface ApiFarmsCreateStakingPoolBodyV1 {
	// lockEnforcement: FarmsLockEnforcement;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
}

// =========================================================================
//  Staking Pool Mutation API
// =========================================================================

/**
 * Request body for initializing a new reward in a staking pool, requiring either `ownerCapId` or `oneTimeAdminCapId`.
 */
export type ApiFarmsInitializeStakingPoolRewardBody = {
	stakingPoolId: ObjectId;
	rewardAmount: Balance;
	emissionScheduleMs: Timestamp;
	emissionRate: bigint;
	emissionDelayTimestampMs: Timestamp;
	stakeCoinType: CoinType;
	rewardCoinType: CoinType;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
} & FarmOwnerOrOneTimeAdminCap;

/**
 * Request body for topping up multiple reward coins in a staking pool, requiring either `ownerCapId` or `oneTimeAdminCapId`.
 */
export type ApiFarmsTopUpStakingPoolRewardsBody = {
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	rewards: {
		rewardCoinType: CoinType;
		rewardAmount: Balance;
	}[];
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
} & FarmOwnerOrOneTimeAdminCap;

/**
 * Request body for increasing the emissions for specified reward coins in a pool (owner only).
 */
export type ApiFarmsIncreaseStakingPoolRewardsEmissionsBody = {
	ownerCapId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	rewards: {
		rewardCoinType: CoinType;
		emissionScheduleMs: Timestamp;
		emissionRate: bigint;
	}[];
	walletAddress: SuiAddress;
};

/**
 * Request body for fetching staking pool owner caps owned by a user.
 */
export interface ApiFarmsOwnedStakingPoolOwnerCapsBody {
	walletAddress: SuiAddress;
}

/**
 * Request body for fetching staking pool one-time admin caps owned by a user.
 */
export interface ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody {
	walletAddress: SuiAddress;
}

/**
 * Request body for granting a one-time admin cap of a particular reward coin to another user.
 */
export type ApiFarmsGrantOneTimeAdminCapBody = {
	ownerCapId: ObjectId;
	recipientAddress: SuiAddress;
	rewardCoinType: CoinType;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
};
