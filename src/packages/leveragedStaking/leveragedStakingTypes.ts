import { ObligationAccount } from "@scallop-io/sui-scallop-sdk";
import {
	ApiEventsBody,
	Balance,
	Event,
	Object,
	Percentage,
	ObjectId,
	SuiAddress,
	Timestamp,
} from "../../general/types/generalTypes";
import { ManipulateType } from "dayjs";

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

export type LeveragedStakingEvent =
	| LeveragedStakedEvent
	| LeveragedUnstakedEvent
	| LeveragedStakeChangedLeverageEvent;

export interface LeveragedStakedEvent extends Event {
	userAddress: SuiAddress;
	newAfSuiCollateral: Balance;
	leverage: number;
}

export interface LeveragedUnstakedEvent extends Event {
	userAddress: SuiAddress;
	afsuiCollateral: Balance;
}

export interface LeveragedStakeChangedLeverageEvent extends Event {
	userAddress: SuiAddress;
	initialLeverage: number;
	newLeverage: number;
}

// =========================================================================
//  Graph Data
// =========================================================================

export interface LeveragedStakingPerformanceDataPoint {
	time: Timestamp;
	sui: number;
	afSui: number;
	leveragedAfSui: number;
}

export type LeveragedStakingPerformanceGraphDataTimeframeKey = "1M";

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

// =========================================================================
//  Graph Data API
// =========================================================================

export interface LeveragedStakingPerformanceDataBody {
	timeframe: LeveragedStakingPerformanceGraphDataTimeframeKey;
}
