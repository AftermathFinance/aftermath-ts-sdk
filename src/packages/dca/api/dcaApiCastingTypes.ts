import { EventOnChain } from "../../../general/types/castingTypes";
import { BigIntAsString, ObjectId } from "../../../types";


// =========================================================================
// Objects
// =========================================================================

export interface DcaOrderFieldsOnChain {
    id: ObjectId,
    owner: ObjectId;
    remaining_balance: BigIntAsString;
    frequency_ms: BigIntAsString;
    last_trade_timestamp_ms: BigIntAsString;
    amount_per_trade: BigIntAsString;
    max_allowable_slippage_bps: BigIntAsString;
    min_amount_out: BigIntAsString;
    max_amount_out: BigIntAsString;
    remaining_trades: BigIntAsString;
    gas: BigIntAsString;
}

// =========================================================================
// Events
// =========================================================================

export type DcaCreatedOrderEventOnChain = EventOnChain<{
	order_id: ObjectId;
    owner: ObjectId;
    user_pk: Uint8Array;
	input_value: BigIntAsString;
	input_type: Uint8Array;
	output_type: Uint8Array;
	gas_value: BigIntAsString;
	frequency_ms: BigIntAsString;
    start_timestamp_ms: BigIntAsString;
    amount_per_trade: BigIntAsString;
    max_allowable_slippage_bps: BigIntAsString;
    min_amount_out: BigIntAsString;
    max_amount_out: BigIntAsString;
    remaining_trades: BigIntAsString;
}>;

export type DcaClosedOrderEventOnChain = EventOnChain<{
	order_id: ObjectId;
    owner: ObjectId;
	remaining_value: BigIntAsString;
	input_type: Uint8Array;
	output_type: Uint8Array;
	gas_value: BigIntAsString;
	frequency_ms: BigIntAsString;
    last_trade_timestamp_ms: BigIntAsString;
    amount_per_trade: BigIntAsString;
    max_allowable_slippage_bps: BigIntAsString;
    min_amount_out: BigIntAsString;
    max_amount_out: BigIntAsString;
    remaining_trades: BigIntAsString;
}>;

export type DcaExecutedTradeEventOnChain = EventOnChain<{
	order_id: ObjectId;
    owner: ObjectId;
    input_type: Uint8Array;
    input_amount: BigIntAsString;
    output_type: Uint8Array;
    output_amount: BigIntAsString;
}>;