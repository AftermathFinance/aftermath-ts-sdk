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

export type FarmsMultiplier = bigint;
export type FarmsVersion = 1 | 2;

// =========================================================================
//  Helpers
// =========================================================================

export type FarmOwnerOrOneTimeAdminCap =
	| { ownerCapId: ObjectId }
	| { oneTimeAdminCapId: ObjectId };

// =========================================================================
//  Objects
// =========================================================================

// =========================================================================
//  Staking Pool
// =========================================================================

export type FarmsLockEnforcement = "Strict" | "Relaxed";

export interface FarmsStakingPoolRewardCoin {
	coinType: CoinType;
	rewards: Balance;
	rewardsAccumulatedPerShare: Balance;
	emissionRate: Balance;
	emissionSchedulesMs: Timestamp;
	emissionStartTimestamp: Timestamp;
	lastRewardTimestamp: Timestamp;
	rewardsRemaining: Balance;
	actualRewards: Balance;
}

export interface FarmsStakingPoolObject extends Object {
	stakeCoinType: CoinType;
	stakedAmount: Balance;
	stakedAmountWithMultiplier: Balance;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	rewardCoins: FarmsStakingPoolRewardCoin[];
	emissionEndTimestamp: Timestamp;
	minStakeAmount: Balance;
	// lockEnforcement: FarmsLockEnforcement;
	isUnlocked: boolean;
	version: FarmsVersion;
}

export interface StakingPoolOwnerCapObject extends Object {
	stakingPoolId: ObjectId;
}

export interface StakingPoolOneTimeAdminCapObject extends Object {
	stakingPoolId: ObjectId;
}

// =========================================================================
//  Staked Position
// =========================================================================

export interface FarmsStakedPositionRewardCoin {
	coinType: CoinType;
	baseRewardsAccumulated: Balance;
	baseRewardsDebt: Balance;
	multiplierRewardsAccumulated: Balance;
	multiplierRewardsDebt: Balance;
}

export interface FarmsStakedPositionObject extends Object {
	stakingPoolObjectId: ObjectId;
	stakeCoinType: CoinType;
	stakedAmount: Balance;
	stakedAmountWithMultiplier: Balance;
	lockStartTimestamp: Timestamp;
	lockDurationMs: Timestamp;
	lockMultiplier: FarmsMultiplier;
	rewardCoins: FarmsStakedPositionRewardCoin[];
	lastHarvestRewardsTimestamp: Timestamp;
	version: FarmsVersion;
}

export type PartialFarmsStakedPositionObject = Omit<
	FarmsStakedPositionObject,
	"rewardCoins"
> & {
	rewardCoins: Omit<FarmsStakedPositionRewardCoin, "coinType">[];
};

// =========================================================================
//  Events
// =========================================================================

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

export const isFarmsDepositedPrincipalEvent = (
	event: FarmUserEvent
): event is FarmsDepositedPrincipalEvent => {
	return event.type.toLowerCase().includes("::depositedprincipalevent");
};

export const isFarmsHarvestedRewardsEvent = (
	event: FarmUserEvent
): event is FarmsHarvestedRewardsEvent => {
	return event.type.toLowerCase().includes("::harvestedrewardsevent");
};

export const isFarmsLockedEvent = (
	event: FarmUserEvent
): event is FarmsLockedEvent => {
	return event.type.toLowerCase().includes("::lockedevent");
};

export const isFarmsStakedEvent = (
	event: FarmUserEvent
): event is FarmsStakedEvent => {
	return event.type.toLowerCase().includes("::stakedevent");
};

export const isFarmsUnlockedEvent = (
	event: FarmUserEvent
): event is FarmsUnlockedEvent => {
	return event.type.toLowerCase().includes("::unlockedevent");
};

export const isFarmsWithdrewPrincipalEvent = (
	event: FarmUserEvent
): event is FarmsWithdrewPrincipalEvent => {
	return event.type.toLowerCase().includes("::withdrewprincipalevent");
};

export interface FarmsAddedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: Balance;
}

export interface FarmsCreatedVaultEvent extends Event {
	vaultId: ObjectId;
	stakeType: CoinType;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
}

export interface FarmsDepositedPrincipalEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	amount: Balance;
	stakeType: CoinType;
}

export interface FarmsDestroyedStakedPositionEvent extends Event {
	stakedPositionId: ObjectId;
}

export interface FarmsHarvestedRewardsEvent extends Event {
	vaultId: ObjectId;
	rewardTypes: CoinType[];
	rewardAmounts: Balance[];
}

export interface FarmsIncreasedEmissionsEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	emissionScheduleMs: Timestamp;
	emissionRate: Balance;
}

export interface FarmsInitializedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: Balance;
	emissionRate: Balance;
	emissionStartMs: Timestamp;
}

export interface FarmsJoinedEvent extends Event {
	stakedPositionId: ObjectId;
	otherStakedPositionId: ObjectId;
}

export interface FarmsLockedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
	lockStartTimestampMs: Timestamp;
	lockDurationMs: Timestamp;
	lockMultiplier: FarmsMultiplier;
}

export interface FarmsSplitEvent extends Event {
	stakedPositionId: ObjectId;
	splitStakedPositionId: ObjectId;
}

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

export interface FarmsStakedRelaxedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
	lockStartTimestampMs: Timestamp;
	lockEndTimestampMs: Timestamp;
}

export interface FarmsUnlockedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
}

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

export interface ApiFarmsOwnedStakedPositionsBody {
	walletAddress: SuiAddress;
}

// =========================================================================
//  Staking API
// =========================================================================

export interface ApiFarmsStakeBody {
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	stakeAmount: Balance;
	walletAddress: SuiAddress;
	// lockEnforcement: FarmsLockEnforcement;
	isSponsoredTx?: boolean;
}

/** @deprecated use ApiFarmsStakeBody instead */
export interface ApiFarmsStakeBodyV1 {
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	stakeAmount: Balance;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
}

export interface ApiFarmsDepositPrincipalBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	depositAmount: Balance;
	walletAddress: SuiAddress;
	isSponsoredTx?: boolean;
}

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

export interface ApiFarmsLockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFarmsRenewLockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFarmsUnlockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

// =========================================================================
//  Harvest Rewards API
// =========================================================================

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

export interface ApiFarmsCreateStakingPoolBody {
	// lockEnforcements: FarmsLockEnforcement[];
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

/** @deprecated use ApiFarmsCreateStakingPoolBody instead */
export interface ApiFarmsCreateStakingPoolBodyV1 {
	// lockEnforcement: FarmsLockEnforcement;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

// =========================================================================
//  Staking Pool Mutation API
// =========================================================================

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

export interface ApiFarmsOwnedStakingPoolOwnerCapsBody {
	walletAddress: SuiAddress;
}

export interface ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody {
	walletAddress: SuiAddress;
}

export type ApiFarmsGrantOneTimeAdminCapBody = {
	ownerCapId: ObjectId;
	recipientAddress: SuiAddress;
	rewardCoinType: CoinType;
	walletAddress: SuiAddress;
};
