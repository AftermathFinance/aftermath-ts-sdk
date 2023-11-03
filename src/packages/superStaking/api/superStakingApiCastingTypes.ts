import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface ValidatorConfigFieldsOnChain {
	sui_address: SuiAddress;
	operation_cap_id: ObjectId;
	fee: BigIntAsString;
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
