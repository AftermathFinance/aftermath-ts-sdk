import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Balance, Event, Timestamp } from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";

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

export interface StakingStakeEvent extends Event {
	suiWrapperId: ObjectId;
}

export interface StakingUnstakeEvent extends Event {
	afSuiWrapperId: ObjectId;
}

export interface StakingFailedStakeEvent extends Event {
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	stakedSuiAmount: Balance;
}

/////////////////////////////////////////////////////////////////////
//// Stats
/////////////////////////////////////////////////////////////////////

export interface StakingStats {
	topStakers: StakingStakeEventAccumulation[];
	stakeTvl: Balance;
}

export interface StakingStakeEventAccumulation {
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
