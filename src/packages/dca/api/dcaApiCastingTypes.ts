import { Coin } from "../..";
import { EventOnChain, TableOnChain } from "../../../general/types/castingTypes";
import { BigIntAsString, CoinType, ObjectId } from "../../../types";


// =========================================================================
// Objects
// =========================================================================

export interface DcaOrderFieldsOnChain {
    id: ObjectId,
    owner: ObjectId;
    remaining_balance: BigIntAsString;
    frequency_ms: BigIntAsString;
    allowable_deviation_ms: BigIntAsString;
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
	input_value: BigIntAsString;
	input_type: BigIntAsString[];
	output_type: BigIntAsString[];
	gas_value: BigIntAsString;
	frequency_ms: BigIntAsString;
    allowable_deviation_ms: BigIntAsString;
    start_timestamp_ms: BigIntAsString;
    amount_per_trade: BigIntAsString;
    max_allowable_slippage_bps: BigIntAsString;
    min_amount_out: BigIntAsString;
    max_amount_out: BigIntAsString;
    remaining_trades: BigIntAsString;
}>;

export type DcaCancelledOrderEventOnChain = EventOnChain<{
	order_id: ObjectId;
    owner: ObjectId;
	remaining_value: BigIntAsString;
	input_type: BigIntAsString[];
	output_type: BigIntAsString[];
	gas_value: BigIntAsString;
	frequency_ms: BigIntAsString;
    allowable_deviation_ms: BigIntAsString;
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
    input_type: BigIntAsString[];
    input_amount: BigIntAsString;
    output_type: BigIntAsString[];
    output_amount: BigIntAsString;
}>;