import { SuiObjectData } from "@mysten/sui.js/client";
import { EventOnChain } from "../../../general/types/castingTypes";
import { BigIntAsString, ObjectDigest, ObjectId, SuiAddress, Timestamp, TransactionDigest } from "../../../types";


// =========================================================================
// Objects
// =========================================================================

export interface DcaOrderFieldsOnChain {
    id: ObjectId,
    user: ObjectId;
    recipient: ObjectId;
    balance: BigIntAsString;
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
    user: ObjectId;
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

export type DcaClosedOrderEventOnChain = EventOnChain<{
	order_id: ObjectId;
    user: ObjectId;
    recipient: ObjectId;
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
    user: ObjectId;
    recipient: ObjectId;
    input_type: Uint8Array;
    input_amount: BigIntAsString;
    output_type: Uint8Array;
    output_amount: BigIntAsString;
}>;


// =========================================================================
// Indexer
// =========================================================================

export type DcaIndexerOrderTradeResponse = {
    input_amount: BigIntAsString;
    output_amount: BigIntAsString;
    event: {
        timestamp: Timestamp;
        tx_digest: TransactionDigest;
    }
};

export type DcaIndexerOrderResponse = {
    order_object_id: ObjectId;
    coin_sell: String;
    coin_sell_amount: BigIntAsString;
    coin_buy: String;
    orders_num: BigIntAsString;
    orders_left: BigIntAsString;
    frequency_ms: BigIntAsString;
    slippage: BigIntAsString;
    total_spent: BigIntAsString;
    recipient: SuiAddress;
    created: {
        timestamp: Timestamp;
        tx_digest: TransactionDigest;
    }
    average_price: BigIntAsString;
    min_amount_out: BigIntAsString;
    max_amount_out: BigIntAsString;
    trades: DcaIndexerOrderTradeResponse[];
};

export type DcaIndexerOrdersResponse = {
    orders: DcaIndexerOrderResponse[]
};

export type DcaIndexerOrdersRequest = {
    sender: SuiAddress;
}

export type DcaIndexerOrderCancelRequest = {
    order_object_id: ObjectId;
}

export type DcaIndexerOrderCancelResponse = {
    
}