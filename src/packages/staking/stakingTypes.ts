import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Balance, Event, Timestamp } from "../../general/types/generalTypes";

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

export interface StakeEvent extends Event {
	suiWrapperId: ObjectId;
}

export interface UnstakeEvent extends Event {
	afSuiWrapperId: ObjectId;
}

export interface FailedStakeEvent extends Event {
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	stakedSuiAmount: Balance;
}

/////////////////////////////////////////////////////////////////////
//// Stats
/////////////////////////////////////////////////////////////////////

export interface StakingStats {
	topStakers: StakeEventAccumulation[];
	stakeTvl: Balance;
}

export interface StakeEventAccumulation {
	staker: SuiAddress;
	totalAmountStaked: Balance;
	latestStakeTimestamp: Timestamp | undefined;
	firstStakeTimestamp: Timestamp | undefined;
	largestStake: Balance;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiStakingStakeBody {
	walletAddress: SuiAddress;
	suiStakeAmount: Balance;
	validatorAddress: SuiAddress;
}

export interface ApiStakingUnstakeBody {
	walletAddress: SuiAddress;
	afSuiUnstakeAmount: Balance;
}
