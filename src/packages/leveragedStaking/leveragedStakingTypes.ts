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
//  Scallop
// =========================================================================

export type {
	MarketPool as ScallopMarketPool,
	MarketCollateral as ScallopMarketCollateral,
} from "@scallop-io/sui-scallop-sdk";

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

export interface LeveragedAfSuiState extends Object {
	totalAfSuiCollateral: Balance;
	totalSuiDebt: Balance;
	protocolVersion: bigint;
}

// =========================================================================
//  Events
// =========================================================================

// export interface asdfStakedEvent extends Event {
// 	stakedSuiId: ObjectId;
// 	suiId: ObjectId;
// 	staker: SuiAddress;
// 	validatorAddress: SuiAddress;
// 	epoch: bigint;
// 	suiStakeAmount: Balance;
// 	validatorFee: number;
// 	isRestaked: boolean;
// 	afSuiId: ObjectId;
// 	afSuiAmount: Balance;
// 	referrer?: SuiAddress;
// }

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Transactions API
// =========================================================================

export interface ApiLeveragedStakePositionBody {
	walletAddress: SuiAddress;
}
export type ApiLeveragedStakePositionResponse = LeveragedAfSuiPosition | "none";

// =========================================================================
//  Objects API
// =========================================================================

// export interface asdfApiStakingPositionsBody {
// 	walletAddress: SuiAddress;
// }

// =========================================================================
//  Events API
// =========================================================================

// export type asdfApiStakingEventsBody = ApiEventsBody & {
// 	walletAddress: SuiAddress;
// };
