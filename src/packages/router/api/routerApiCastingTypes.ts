import {
	AnyObjectType,
	BigIntAsString,
	CoinType,
	SuiAddress,
} from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Events
// =========================================================================

export type RouterTradeEventOnChain = EventOnChain<{
	swapper: SuiAddress;
	type_in: CoinType;
	amount_in: BigIntAsString;
	type_out: CoinType;
	amount_out: BigIntAsString;
	// referrer: Option<SuiAddress>;
	router_fee: BigIntAsString;
	router_fee_recipient: SuiAddress;
}>;
