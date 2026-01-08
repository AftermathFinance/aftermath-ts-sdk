import {
	ApiEventsBody,
	Balance,
	Event,
	Object,
	Percentage,
	ObjectId,
	SuiAddress,
	Timestamp,
} from "../../general/types/generalTypes.ts";
import { ManipulateType } from "dayjs";
import { LeveragedStakingApi } from "./api/leveragedStakingApi.ts";

// =========================================================================
//  Scallop
// =========================================================================

// export type {
// 	MarketPool as ScallopMarketPool,
// 	MarketCollateral as ScallopMarketCollateral,
// } from "@scallop-io/sui-scallop-sdk";

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

export const isLeveragedStakedEvent = (
	event: LeveragedStakingEvent
): event is LeveragedStakedEvent => {
	return event.type.includes(
		LeveragedStakingApi.constants.eventNames.leveragedStaked
	);
};

export const isLeveragedUnstakedEvent = (
	event: LeveragedStakingEvent
): event is LeveragedUnstakedEvent => {
	return event.type.includes(
		LeveragedStakingApi.constants.eventNames.leveragedUnstaked
	);
};

export const isLeveragedStakeChangedLeverageEvent = (
	event: LeveragedStakingEvent
): event is LeveragedStakeChangedLeverageEvent => {
	return event.type.includes(
		LeveragedStakingApi.constants.eventNames.leverageChanged
	);
};

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

// =========================================================================
//  Events API
// =========================================================================

// =========================================================================
//  Graph Data API
// =========================================================================

export interface LeveragedStakingPerformanceDataBody {
	timeframe: LeveragedStakingPerformanceGraphDataTimeframeKey;
	borrowRate: Percentage;
	maxLeverage: number;
}
