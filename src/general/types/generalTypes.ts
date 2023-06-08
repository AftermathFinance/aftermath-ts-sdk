import {
	EventId,
	ObjectId,
	SuiAddress,
	SuiTransactionBlockResponse,
	TransactionDigest,
} from "@mysten/sui.js";
import { DynamicFieldInfo } from "@mysten/sui.js/dist/types/dynamic_fields";

// =========================================================================
//  bigint
// =========================================================================

export type Balance = bigint;

// =========================================================================
//  number
// =========================================================================

export type GasBudget = number;
export type Timestamp = number;
export type Byte = number;
export type Slippage = number;
/**
 * Unscaled percentage
 *
 * @remarks 0.54 = 54%
 */
export type Percentage = number;
export type Apy = number;

// =========================================================================
//  string
// =========================================================================

export type SerializedTransaction = string;
export type TxBytes = string;
export type BigIntAsString = string;
export type KeyType = string;
export type AnyObjectType = string;
export type ModuleName = string;
export type FunctionName = string;
export type PackageId = string;
export type Color = string;
export type Url = string;
export type LocalUrl = string;
export type FilePath = string;

// =========================================================================
//  Events
// =========================================================================

export interface EventsWithCursor<EventType> {
	events: EventType[];
	nextCursor: EventId | null;
}

export interface Event {
	type: AnyObjectType;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export interface EventsInputs {
	cursor?: EventId;
	limit?: number;
}

export type UserEventsInputs = EventsInputs & {
	walletAddress: SuiAddress;
};

// =========================================================================
//  Objects
// =========================================================================

export interface Object {
	objectId: ObjectId;
	objectType: AnyObjectType;
}

// =========================================================================
//  Dynamic Fields
// =========================================================================

export interface DynamicFieldsWithCursor {
	dynamicFields: DynamicFieldInfo[];
	nextCursor: ObjectId | null;
}

export interface DynamicFieldObjectsWithCursor<ObjectType> {
	dynamicFieldObjects: ObjectType[];
	nextCursor: ObjectId | null;
}

export interface DynamicFieldsInputs {
	cursor?: ObjectId;
	limit?: number;
}

// =========================================================================
//  Transactions
// =========================================================================

export interface TransactionsWithCursor {
	transactions: SuiTransactionBlockResponse[];
	nextCursor: TransactionDigest | null;
}

// =========================================================================
//  API
// =========================================================================

export interface ApiDataWithCursorBody<CursorType> {
	cursor?: CursorType;
	limit?: number;
}

export type ApiEventsBody = ApiDataWithCursorBody<EventId>;
export type ApiDynamicFieldsBody = ApiDataWithCursorBody<ObjectId>;
export type ApiTransactionsBody = ApiDataWithCursorBody<TransactionDigest>;
