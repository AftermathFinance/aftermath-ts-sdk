import { ObjectId, SuiAddress, TransactionDigest } from "@mysten/sui.js";
import {
	ApiEventsBody,
	Balance,
	Event,
	Timestamp,
} from "../../general/types/generalTypes";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface StakeBalanceDynamicField {
	objectId: ObjectId;
	value: Balance;
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export interface StakeRequestEvent extends Event {
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
}

export interface UnstakeRequestEvent extends Event {
	afSuiWrapperId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
	suiUnstakeAmount: Balance;
}

export interface StakeSuccessEvent extends Event {
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
}

export interface UnstakeSuccessEvent extends Event {
	afSuiWrapperId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
	suiUnstakeAmount: Balance;
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

/////////////////////////////////////////////////////////////////////
//// Staking Positions
/////////////////////////////////////////////////////////////////////

export type StakingPosition = StakePosition | UnstakePosition;

export interface StakePosition {
	state: StakePositionState;
	suiWrapperId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
	afSuiMintAmount: Balance | undefined;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export interface UnstakePosition {
	state: UnstakePositionState;
	afSuiWrapperId: ObjectId;
	staker: SuiAddress;
	epoch: bigint;
	afSuiAmountGiven: Balance;
	suiUnstakeAmount: Balance;
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

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiStakeBody {
	walletAddress: SuiAddress;
	suiStakeAmount: Balance;
	validatorAddress: SuiAddress;
}

export interface ApiUnstakeBody {
	walletAddress: SuiAddress;
	afSuiUnstakeAmount: Balance;
}

export interface ApiStakingPositionsBody {
	walletAddress: SuiAddress;
}

export type ApiStakingEventsBody = ApiEventsBody & {
	walletAddress: SuiAddress;
};
