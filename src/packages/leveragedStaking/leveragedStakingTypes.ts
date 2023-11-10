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

export interface LeveragedObligationKey extends Object {
	obligationId: ObjectId;
	obligationKeyId: ObjectId;
	baseAfSuiCollateral: Balance;
	afSuiCollateral: Balance;
	suiDebt: Balance;
}

export interface LeveragedStakeObligation {
	obligationAccount: ObligationAccount;
	leveragedObligationKey: LeveragedObligationKey;
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

export interface ApiLeveragedStakeObligationBody {
	walletAddress: SuiAddress;
}
export type ApiLeveragedStakeObligationResponse =
	| LeveragedStakeObligation
	| "none";

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
