import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface LeveragedObligationKeyFieldsOnChain {
	obligation_key: {
		id: ObjectId;
		ownership: {
			id: ObjectId;
			of: ObjectId;
		};
	};
	base_afsui_collateral: BigIntAsString;
	afsui_collateral: BigIntAsString;
	sui_debt: BigIntAsString;
}

// =========================================================================
//  Events Fields
// =========================================================================

export interface StakedEventOnChainFields {
	staker: SuiAddress;
	validator: SuiAddress;
	staked_sui_id: ObjectId;
	sui_id: ObjectId;
	sui_amount: BigIntAsString;
	afsui_id: ObjectId;
	afsui_amount: BigIntAsString;
	validator_fee: BigIntAsString;
	referrer: SuiAddress | null;
	epoch: BigIntAsString;
	is_restaked: boolean;
}

// =========================================================================
//  Events
// =========================================================================

export type StakedEventOnChain = EventOnChain<StakedEventOnChainFields>;
