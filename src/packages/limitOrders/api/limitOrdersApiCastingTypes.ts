import { EventOnChain } from "../../../general/types/castingTypes";
import {
	Balance,
	BigIntAsString,
	CoinType,
	ObjectId,
	SerializedTransaction,
	ServiceCoinData,
	SuiAddress,
	Timestamp,
	TransactionDigest,
} from "../../../types";
import { LimitOrdersIndexerOrderStatus } from "../limitOrdersTypes";

// =========================================================================
// Objects
// =========================================================================

export interface LimitOrderFieldsOnChain {
	id: ObjectId;
	user: SuiAddress;
	recipient: ObjectId;
	balance: BigIntAsString;
	gas: BigIntAsString;
	encrypted_fields: Uint8Array;
}

// =========================================================================
// Events
// =========================================================================

export type LimitCreatedOrderEventOnChain = EventOnChain<{
	order_id: ObjectId;
	user: SuiAddress;
	user_pk: Uint8Array;
	recipient: ObjectId;
	input_amount: BigIntAsString;
	input_type: Uint8Array;
	output_type: Uint8Array;
	gas_amount: BigIntAsString;
	encrypted_fields: Uint8Array;
}>;
