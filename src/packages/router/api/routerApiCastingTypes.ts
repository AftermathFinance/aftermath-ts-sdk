import type { EventOnChain } from "../../../general/types/castingTypes";
import type { BigIntAsString, CoinType, SuiAddress } from "../../../types";

// =========================================================================
//  Events
// =========================================================================


/** Raw `SwapCompletedEvent` fields before conversion to `RouterTradeEvent`. */
export type RouterTradeEventOnChain = EventOnChain<{
	/** The address that submitted the routed swap. */
	swapper: SuiAddress;
	/** The input coin type. */
	type_in: CoinType;
	/** The input amount as a decimal bigint string. */
	amount_in: BigIntAsString;
	/** The output coin type. */
	type_out: CoinType;
	/** The output amount as a decimal bigint string. */
	amount_out: BigIntAsString;
	// referrer: Option<SuiAddress>;
	/** The router fee as a decimal bigint string. */
	router_fee: BigIntAsString;
	/** The address that receives the router fee. */
	router_fee_recipient: SuiAddress;
}>;
