import { ObjectId, SuiAddress, TransactionDigest } from "@mysten/sui.js";
import {
	ApiEventsBody,
	Balance,
	Event,
	Timestamp,
} from "../../general/types/generalTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface StakeBalanceDynamicField {
	objectId: ObjectId;
	value: Balance;
}

// =========================================================================
//  Events
// =========================================================================

// stake

export type StakeEvent =
	| StakeRequestEvent
	| StakeSuccessEvent
	| StakeFailedEvent
	| AfSuiMintedEvent;

export interface StakeRequestEvent extends Event {
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
}

export interface StakeSuccessEvent extends Event {
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
}

export interface StakeFailedEvent extends Event {
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
}

export interface AfSuiMintedEvent extends Event {
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiMintAmount: Balance;
	suiStakeAmount: Balance;
}

// unstake

export type UnstakeEvent = UnstakeRequestEvent | UnstakeSuccessEvent;

export interface UnstakeRequestEvent extends Event {
	afSuiWrapperId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
}

export interface UnstakeSuccessEvent extends Event {
	afSuiWrapperId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
	suiUnstakeAmount: Balance;
}

export const isStakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is StakeEvent => {
	return "suiWrapperId" in event;
};

export const isUnstakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is UnstakeEvent => {
	return "afSuiWrapperId" in event;
};

// =========================================================================
//  Staking Positions
// =========================================================================

export type StakingPosition = StakePosition | UnstakePosition;

export interface StakePosition {
	state: StakePositionState;
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
	afSuiMintAmount?: Balance;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export interface UnstakePosition {
	state: UnstakePositionState;
	afSuiWrapperId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
	suiUnstakeAmount?: Balance;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export type StakePositionState =
	| "REQUEST"
	| "SUCCESS"
	| "FAILED"
	| "AFSUI_MINTED";

export type UnstakePositionState = "REQUEST" | "SUCCESS";

export const isStakePosition = (
	position: StakingPosition
): position is StakePosition => {
	return "suiWrapperId" in position;
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

export interface ApiStakingPositionsBody {
	walletAddress: SuiAddress;
}

export type ApiStakingEventsBody = ApiEventsBody & {
	walletAddress: SuiAddress;
};
