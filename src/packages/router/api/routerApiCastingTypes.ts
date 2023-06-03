import { SuiAddress } from "@mysten/sui.js/dist/types";
import { AnyObjectType, BigIntAsString } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Events
// =========================================================================

export type RouterTradeEventOnChain = EventOnChain<{
	swapper: SuiAddress;
	type_in: AnyObjectType;
	amount_in: BigIntAsString;
	type_out: AnyObjectType;
	amount_out: BigIntAsString;
	// referrer: Option<SuiAddress>;
	// router_fee: Option<BigIntAsString>;
	// router_fee_recipient: Option<SuiAddress>;
}>;
