import { ObligationAccount } from "@scallop-io/sui-scallop-sdk";
import {
	ApiEventsBody,
	Balance,
	Event,
	Object,
	Percentage,
	ObjectId,
	SuiAddress,
} from "../../general/types/generalTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface LeveragedAfSuiPosition extends Object {
	obligationId: ObjectId;
	obligationKeyId: ObjectId;
	baseAfSuiCollateral: Balance;
	afSuiCollateral: Balance;
	suiDebt: Balance;
}

export interface LeveragedStakeObligation {
	obligationAccount: ObligationAccount;
	leveragedAfSuiPosition: LeveragedAfSuiPosition;
}

// =========================================================================
//  Events
// =========================================================================

export interface asdfStakedEvent extends Event {
	stakedSuiId: ObjectId;
	suiId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
	validatorFee: number;
	isRestaked: boolean;
	afSuiId: ObjectId;
	afSuiAmount: Balance;
	referrer?: SuiAddress;
}

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Transactions API
// =========================================================================

export interface adfApiStakeBody {
	walletAddress: SuiAddress;
	suiStakeAmount: Balance;
	validatorAddress: SuiAddress;
	referrer?: SuiAddress;
	isSponsoredTx?: boolean;
}

// =========================================================================
//  Objects API
// =========================================================================

export interface asdfApiStakingPositionsBody {
	walletAddress: SuiAddress;
}

// =========================================================================
//  Events API
// =========================================================================

export type asdfApiStakingEventsBody = ApiEventsBody & {
	walletAddress: SuiAddress;
};
