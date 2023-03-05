import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Balance, Event, Timestamp, Url } from "./generalTypes";
import { CoinType } from "./coinTypes";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface StakeBalanceDynamicField {
	objectId: ObjectId;
	value: Balance;
}

export interface StakeValidator {
	name: string;
	description: string | undefined;
	projectUrl: Url | undefined;
	imageUrl: Url | undefined;
	suiAddress: SuiAddress;
	nextEpoch: {
		commissionRate: number;
		delegation: Balance;
		gasPrice: Balance;
		stake: Balance;
	};
}

type DelegatedStakePositionStatus =
	| "pending"
	| {
			active: {
				id: ObjectId;
				stakedSuiId: ObjectId;
				principalSuiAmount: Balance;
				poolCoinsAmount: Balance;
			};
	  };

export interface DelegatedStakePosition {
	stakedSuiId: ObjectId;
	validatorAddress: SuiAddress;
	poolStartingEpoch: EpochTimeStamp;
	delegationRequestEpoch: EpochTimeStamp;
	principalAmount: Balance;
	suiCoinLock: number | undefined;
	status: DelegatedStakePositionStatus;
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

export interface StakeStakeEventAccumulation {
	staker: SuiAddress;
	totalAmountStaked: Balance;
	latestStakeTimestamp: Timestamp;
	firstStakeTimestamp: Timestamp;
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
