import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface LeveragedAfSuiPositionFieldsOnChain {
	obligation_key: {
		id: ObjectId;
		ownership: {
			id: ObjectId;
			of: ObjectId;
		};
	};
	position_metadata: {
		base_afsui_collateral: BigIntAsString;
		afsui_collateral: BigIntAsString;
		sui_debt: BigIntAsString;
	};
}

export interface LeveragedAfSuiStateFieldsOnChain {
	total_afsui_collateral: BigIntAsString;
	total_sui_debt: BigIntAsString;
	protocol_version: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type LeveragedStakedEventOnChain = EventOnChain<{
	user: SuiAddress;
	new_afsui_collateral: BigIntAsString;
	leverage: BigIntAsString;
}>;

export type LeveragedUnstakedEventOnChain = EventOnChain<{
	user: SuiAddress;
	afsui_collateral: BigIntAsString;
}>;

export type LeveragedStakeChangedLeverageEventOnChain = EventOnChain<{
	user: SuiAddress;
	initial_leverage: BigIntAsString;
	new_leverage: BigIntAsString;
}>;
