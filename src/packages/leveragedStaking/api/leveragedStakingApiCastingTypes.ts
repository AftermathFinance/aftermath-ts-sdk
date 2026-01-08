import { BigIntAsString, ObjectId, SuiAddress } from "../../../types.ts";
import { EventOnChain } from "../../../general/types/castingTypes.ts";

// =========================================================================
//  Objects
// =========================================================================

export interface LeveragedAfSuiPositionFieldsOnChain {
	obligation_key: {
		fields: {
			id: {
				id: ObjectId;
			};
			ownership: {
				fields: {
					of: ObjectId;
				};
			};
		};
	};
	base_afsui_collateral: BigIntAsString;
	total_afsui_collateral: BigIntAsString;
	total_sui_debt: BigIntAsString;
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
