import { EventOnChain } from "../../../general/types/castingTypes";
import {
	BigIntAsString,
	CoinType,
	ObjectId,
	SerializedTransaction,
	ServiceCoinData,
	SuiAddress,
	Timestamp,
	TransactionDigest,
} from "../../../types";
import { DcaFailedTradeReason } from "../dcaTypes";

// =========================================================================
// Objects
// =========================================================================

export interface DcaOrderFieldsOnChain {
	id: ObjectId;
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
	remaining_amount: BigIntAsString;
	input_type: Uint8Array;
	output_type: Uint8Array;
	gas_amount: BigIntAsString;
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
	input_amount: BigIntAsString;
	input_type: Uint8Array;
	output_amount: BigIntAsString;
	output_type: Uint8Array;
}>;

// =========================================================================
// Indexer
// =========================================================================

export type DcaIndexerOrdersRequest = {
	sender: SuiAddress;
};

export type DcaIndexerOrdersResponse = {
	orders: DcaIndexerOrderResponse[];
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
	recipient: SuiAddress;
	created: {
		timestamp: Timestamp;
		tx_digest: TransactionDigest;
	};
	average_price: BigIntAsString;
	min_amount_out: BigIntAsString;
	max_amount_out: BigIntAsString;
	next_execution_timestamp_ms: string;
	trades: DcaIndexerOrderTradeResponse[];
	failed: DcaIndexerOrderFailedTradeResponse[];
	integrator_fee_bps: number;
	integrator_fee_recipient: SuiAddress;
};

export type DcaIndexerOrderFailedTradeResponse = {
	timestamp_ms: Timestamp;
	reason: DcaFailedTradeReason | undefined;
};

export type DcaIndexerOrderTradeResponse = {
	input_amount: BigIntAsString;
	output_amount: BigIntAsString;
	event: {
		timestamp: Timestamp;
		tx_digest: TransactionDigest;
	};
};

// =========================================================================
// Create Order
// =========================================================================

export type DcaIndexerOrderCreateRequest = {
	tx_kind: string;
	order: {
		input_coin: ServiceCoinData;
		input_coin_type: CoinType;
		output_coin_type: CoinType;
		gas_coin: ServiceCoinData;
		owner: SuiAddress;
		recipient: SuiAddress;
		frequency_ms: string;
		delay_timestamp_ms: string;
		amount_per_trade: string;
		max_allowable_slippage_bps: number;
		min_amount_out: string;
		max_amount_out: string;
		number_of_trades: number;
		integrator_fee_bps: number;
		integrator_fee_recipient: SuiAddress;
	};
};

export type DcaIndexerOrderCreateResponse = {
	tx_data: SerializedTransaction;
};

// =========================================================================
// Close Order
// =========================================================================

export type DcaIndexerOrderCloseRequest = {
	wallet_address: string;
	signature: string;
	bytes: string;
};

export type DcaIndexerOrderCloseResponse = boolean;
