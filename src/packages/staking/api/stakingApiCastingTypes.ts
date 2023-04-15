import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

/////////////////////////////////////////////////////////////////////
//// Dynamic Fields
/////////////////////////////////////////////////////////////////////

export interface StakeBalanceDynamicFieldOnChain {
	fields: {
		id: {
			id: ObjectId;
		};
		value: BigIntAsString;
	};
}

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export type StakingRequestAddDelegationEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	amount: BigIntAsString;
	validator: SuiAddress;
}>;

export type StakingRequestWithdrawDelegationEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	amount: BigIntAsString;
	validator: SuiAddress;
}>;

export type StakingCancelDelegationRequestEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	amount: BigIntAsString;
	validator: SuiAddress;
}>;
