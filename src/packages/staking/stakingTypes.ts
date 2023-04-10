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

export interface StakeRequestAddDelegationEvent extends Event {
	issuer: SuiAddress;
	amount: Balance;
	validator: SuiAddress;
}

export interface StakeRequestWithdrawDelegationEvent extends Event {
	issuer: SuiAddress;
	amount: Balance;
	validator: SuiAddress;
}

export interface StakeCancelDelegationRequestEvent extends Event {
	issuer: SuiAddress;
	amount: Balance;
	validator: SuiAddress;
}

/////////////////////////////////////////////////////////////////////
//// Stats
/////////////////////////////////////////////////////////////////////

export interface StakingStats {
	topStakers: StakeStakeEventAccumulation[];
	stakeTvl: Balance;
}

export interface StakeStakeEventAccumulation {
	staker: SuiAddress;
	totalAmountStaked: Balance;
	latestStakeTimestamp: Timestamp | undefined;
	firstStakeTimestamp: Timestamp | undefined;
	largestStake: Balance;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiStakeBody {
	walletAddress: SuiAddress;
	coinAmount: Balance;
	stakedCoinType: CoinType;
}

export interface ApiUnstakeBody {
	walletAddress: SuiAddress;
	coinAmount: Balance;
	unstakedCoinType: CoinType;
}

export interface ApiRequestAddDelegationBody {
	walletAddress: SuiAddress;
	coinAmount: Balance;
	validatorAddress: SuiAddress;
}

export interface ApiRequestWithdrawDelegationBody {
	walletAddress: SuiAddress;
	principalAmount: Balance;
	stakedSuiObjectId: ObjectId;
	delegationObjectId: ObjectId;
}

export interface ApiCancelDelegationRequestBody {
	walletAddress: SuiAddress;
	principalAmount: Balance;
	stakedSuiObjectId: ObjectId;
}
