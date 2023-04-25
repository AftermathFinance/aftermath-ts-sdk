import { SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export type StakingStakeEventOnChain = EventOnChain<{
	sui_wrapper_id: SuiAddress;
}>;

export type StakingUnstakeEventOnChain = EventOnChain<{
	afsui_wrapper_id: SuiAddress;
}>;

export type StakingFailedStakeEventOnChain = EventOnChain<{
	staker: SuiAddress;
	validator: SuiAddress;
	epoch: BigIntAsString;
	amount: BigIntAsString;
}>;
