import { ObjectId, SuiAddress } from "@mysten/sui.js";
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
	emissionRateMs: Timestamp;
	emissionSchedulesMs: Timestamp;
	emissionStartTimestamp: Timestamp;
	emissionEndTimestamp: Timestamp;
	lastRewardTimestamp: Timestamp;
}

export interface FarmsStakingPoolObject extends Object {
	stakeCoinType: CoinType;
	stakedAmount: Balance;
	stakedAmountWithMultiplier: Balance;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	rewardCoins: FarmsStakingPoolRewardCoin[];
	minStakeAmount: Balance;
	lockEnforcement: FarmsLockEnforcement;
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
}

// =========================================================================
//  Events
// =========================================================================

export interface AddedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: bigint;
}

export interface CreatedVaultEvent extends Event {
	vaultId: ObjectId;
	stakeType: CoinType;
	minLockDurationMs: bigint;
	maxLockDurationMs: bigint;
	maxLockMultiplier: bigint;
	minStakeAmount: bigint;
}

export interface DepositedPrincipalEvent extends Event {
	stakedPositionId: ObjectId;
	amount: bigint;
}

export interface DestroyedStakedPositionEvent extends Event {
	stakedPositionId: ObjectId;
}

export interface HarvestedRewardsEvent extends Event {
	afterburnerVaultId: ObjectId;
	rewardTypes: CoinType[];
	rewardAmounts: bigint[];
}

export interface HarvestedRewardsEventMetadata extends Event {
	afterburnerVaultId: ObjectId;
	rewardTypes: CoinType[];
	rewardAmounts: bigint[];
}

export interface IncreasedEmissionsEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	emissionScheduleMs: bigint;
	emissionRate: bigint;
}

export interface InitializedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: bigint;
	emissionRateMs: bigint;
	emissionStartMs: bigint;
}

export interface JoinedEvent extends Event {
	stakedPositionId: ObjectId;
	otherStakedPositionId: ObjectId;
}

export interface LockedEvent extends Event {
	stakedPositionId: ObjectId;
	lockStartTimestampMs: bigint;
	lockDurationMs: bigint;
	lockMultiplier: bigint;
}

export interface SplitEvent extends Event {
	stakedPositionId: ObjectId;
	splitStakedPositionId: ObjectId;
}

export interface StakedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: bigint;
	multipliedStakedAmount: bigint;
	lockStartTimestampMs: bigint;
	lockDurationMs: bigint;
	lockMultiplier: bigint;
}

export interface StakedEventRelaxed extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: bigint;
	lockStartTimestampMs: bigint;
	lockEndTimestampMs: bigint;
}

export interface UnlockedEvent extends Event {
	stakedPositionId: ObjectId;
}

export interface WithdrewPrincipalEvent extends Event {
	stakedPositionId: ObjectId;
	amount: bigint;
}

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Staking API
// =========================================================================

export interface ApiFarmsStakeBody {
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	stakeAmount: Balance;
	walletAddress: SuiAddress;
}

export interface ApiFarmsDepositPrincipalBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	depositAmount: Balance;
	walletAddress: SuiAddress;
}

export interface ApiFarmsUnstakeBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	rewardCoinTypes: CoinType[];
	withdrawAmount: Balance;
	walletAddress: SuiAddress;
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
}

// =========================================================================
//  Staking Pool API
// =========================================================================

// =========================================================================
//  Staking Pool Creation API
// =========================================================================

export interface ApiFarmsCreateStakingPoolBody {
	lockEnforcement: FarmsLockEnforcement;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	minLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

// =========================================================================
//  Staking Pool Mutation API
// =========================================================================

export interface ApiFarmsInitializeStakingPoolRewardBody {
	ownerCapId: ObjectId;
	stakingPoolId: ObjectId;
	rewardAmount: Balance;
	emissionScheduleMs: Timestamp;
	emissionRate: bigint;
	emissionDelayTimestampMs: Timestamp;
	stakeCoinType: CoinType;
	rewardCoinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFarmsTopUpStakingPoolRewardBody {
	ownerCapId: ObjectId;
	stakingPoolId: ObjectId;
	rewardAmount: Balance;
	stakeCoinType: CoinType;
	rewardCoinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFarmsIncreaseStakingPoolEmissionsBody {
	ownerCapId: ObjectId;
	stakingPoolId: ObjectId;
	emissionScheduleMs: Timestamp;
	emissionRate: bigint;
	stakeCoinType: CoinType;
	rewardCoinType: CoinType;
	walletAddress: SuiAddress;
}
