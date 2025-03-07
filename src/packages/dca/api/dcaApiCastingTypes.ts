import { EventOnChain } from "../../../general/types/castingTypes";
import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";

// =========================================================================
//  DCA onchain Events
// =========================================================================

export type DcaCreatedOrderEventOnChain = EventOnChain<{
	order_id: ObjectId;
	user: SuiAddress;
	recipient: ObjectId;
	user_pk: Uint8Array;
	input_amount: BigIntAsString;
	input_type: Uint8Array;
	output_type: Uint8Array;
	gas_amount: BigIntAsString;
	frequency_ms: BigIntAsString;
	start_timestamp_ms: BigIntAsString;
	amount_per_trade: BigIntAsString;
	max_allowable_slippage_bps: BigIntAsString;
	min_amount_out: BigIntAsString;
	max_amount_out: BigIntAsString;
	remaining_trades: BigIntAsString;
}>;
