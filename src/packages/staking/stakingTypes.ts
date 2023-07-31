import {
	DelegatedStake,
	ObjectId,
	SuiAddress,
	TransactionDigest,
} from "@mysten/sui.js";
import {
	ApiEventsBody,
	Balance,
	Event,
	Object,
	Percentage,
	Timestamp,
} from "../../general/types/generalTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface ValidatorConfigObject extends Object {
	suiAddress: SuiAddress;
	operationCapId: ObjectId;
	fee: Percentage;
}

export interface StakeBalanceDynamicField {
	objectId: ObjectId;
	value: Balance;
}

export interface SuiDelegatedStake {
	status: "Active" | "Pending" | "Unstaked";
	stakedSuiId: ObjectId;
	stakeRequestEpoch: bigint;
	stakeActiveEpoch: bigint;
	principal: Balance;
	estimatedReward?: Balance | undefined;
	validatorAddress: SuiAddress;
	stakingPool: SuiAddress;
}

// =========================================================================
//  Events
// =========================================================================

export type StakeEvent = StakeRequestEvent | AfSuiMintedEvent;

export interface StakeRequestEvent extends Event {
	stakedSuiId: ObjectId;
	suiId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
	validatorFee: number;
	// TODO: handle referral situation
	referrer?: SuiAddress;
}

export interface AfSuiMintedEvent extends Event {
	suiId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiMintAmount: Balance;
	suiStakeAmount: Balance;
}

export interface UnstakeEvent extends Event {
	afSuiId: ObjectId;
	paybackCoinId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
	suiUnstakeAmount: Balance;
}

export const isStakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is StakeEvent => {
	return "suiId" in event;
};

export const isUnstakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is UnstakeEvent => {
	return "afSuiId" in event;
};

// =========================================================================
//  Staking Positions
// =========================================================================

export type StakingPosition = StakePosition | UnstakePosition;

export interface StakePosition {
	state: StakePositionState;
	suiId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
	afSuiMintAmount?: Balance;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export interface UnstakePosition {
	afSuiId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
	suiUnstakeAmount?: Balance;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export type StakePositionState = "REQUEST" | "AFSUI_MINTED";

export const isStakePosition = (
	position: StakingPosition
): position is StakePosition => {
	return "suiId" in position;
};

export const isUnstakePosition = (
	position: StakingPosition
): position is UnstakePosition => {
	return !isStakePosition(position);
};

// =========================================================================
//  API
// =========================================================================

export interface ApiStakeBody {
	walletAddress: SuiAddress;
	suiStakeAmount: Balance;
	validatorAddress: SuiAddress;
	referrer?: SuiAddress;
}

export interface ApiUnstakeBody {
	walletAddress: SuiAddress;
	afSuiUnstakeAmount: Balance;
	referrer?: SuiAddress;
}

export interface ApiStakeStakedSuiBody {
	walletAddress: SuiAddress;
	stakedSuiIds: ObjectId[];
	validatorAddress: SuiAddress;
	referrer?: SuiAddress;
}

export interface ApiStakingPositionsBody {
	walletAddress: SuiAddress;
}

export interface ApiDelegatedStakesBody {
	walletAddress: SuiAddress;
}

export type ApiStakingEventsBody = ApiEventsBody & {
	walletAddress: SuiAddress;
};
