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
	// afSuiAmountGiven: Balance;
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
