import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface StakedSuiFieldsOnChain {
	validator_address: SuiAddress;
	pool_starting_epoch: number;
	delegation_request_epoch: number;
	principal: BigIntAsString;
}

export interface DelegationFieldsOnChain {
	validator_address: SuiAddress;
	staked_sui_id: ObjectId;
	pool_tokens: BigIntAsString;
	principal_sui_amount: BigIntAsString;
}
