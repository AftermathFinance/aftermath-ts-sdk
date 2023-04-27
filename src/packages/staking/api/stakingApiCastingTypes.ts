import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export type StakeRequestEventOnChain = EventOnChain<{
	sui_wrapper_id: ObjectId;
	staker: SuiAddress;
	validator: SuiAddress;
	epoch: BigIntAsString;
	sui_amount: BigIntAsString;
}>;

export type UnstakeRequestEventOnChain = EventOnChain<{
	afsui_wrapper_id: ObjectId;
	staker: SuiAddress;
	epoch: BigIntAsString;
	provided_afsui_amount: BigIntAsString;
	sui_amount_to_withdraw: BigIntAsString;
}>;

export type StakeSuccessEventOnChain = EventOnChain<{
	sui_wrapper_id: ObjectId;
	staker: SuiAddress;
	validator: SuiAddress;
	epoch: BigIntAsString;
	sui_amount: BigIntAsString;
}>;

export type UnstakeSuccessEventOnChain = EventOnChain<{
	afsui_wrapper_id: ObjectId;
	staker: SuiAddress;
	epoch: BigIntAsString;
	provided_afsui_amount: BigIntAsString;
	withdrawn_sui_amount: BigIntAsString;
}>;

export type StakeFailedEventOnChain = EventOnChain<{
	sui_wrapper_id: ObjectId;
	staker: SuiAddress;
	validator: SuiAddress;
	epoch: BigIntAsString;
	returned_sui_amount: BigIntAsString;
}>;

export type AfSuiMintedEventOnChain = EventOnChain<{
	sui_wrapper_id: ObjectId;
	staker: SuiAddress;
	epoch: BigIntAsString;
	minted_afsui_amount: BigIntAsString;
	staked_sui_amount: BigIntAsString;
}>;
