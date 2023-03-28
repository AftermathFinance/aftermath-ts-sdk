import {
	EventId,
	ObjectId,
	SuiTransactionBlockResponse,
	TransactionDigest,
} from "@mysten/sui.js";
import { DynamicFieldInfo } from "@mysten/sui.js/dist/types/dynamic_fields";

/////////////////////////////////////////////////////////////////////
//// bigint
/////////////////////////////////////////////////////////////////////

export type Balance = bigint;

/////////////////////////////////////////////////////////////////////
//// number
/////////////////////////////////////////////////////////////////////

export type GasBudget = number;
export type Timestamp = number;
export type Byte = number;

/////////////////////////////////////////////////////////////////////
//// string
/////////////////////////////////////////////////////////////////////

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

/////////////////////////////////////////////////////////////////////
//// Events
/////////////////////////////////////////////////////////////////////

export interface EventsWithCursor<EventType> {
	events: EventType[];
	nextCursor: EventId | null;
}
export interface Event {
	timestamp: Timestamp;
	txnDigest: TransactionDigest;
}

/////////////////////////////////////////////////////////////////////
//// Dynamic Fields
/////////////////////////////////////////////////////////////////////

export interface DynamicFieldsWithCursor {
	dynamicFields: DynamicFieldInfo[];
	nextCursor: ObjectId | null;
}

export interface DynamicFieldObjectsWithCursor<ObjectType> {
	dynamicFieldObjects: ObjectType[];
	nextCursor: ObjectId | null;
}

/////////////////////////////////////////////////////////////////////
//// Transactions
/////////////////////////////////////////////////////////////////////

export interface TransactionsWithCursor {
	transactions: SuiTransactionBlockResponse[];
	nextCursor: TransactionDigest | null;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiDataWithCursorBody<CursorType> {
	cursor?: CursorType;
	limit?: number;
}

export type ApiEventsBody = ApiDataWithCursorBody<EventId>;
export type ApiDynamicFieldsBody = ApiDataWithCursorBody<ObjectId>;
export type ApiTransactionsBody = ApiDataWithCursorBody<TransactionDigest>;
