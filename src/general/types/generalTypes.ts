import {
	EventId,
	ObjectId,
	SuiTransactionResponse,
	TransactionDigest,
} from "@mysten/sui.js";

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
	dynamicFields: DynamicField[];
	nextCursor: ObjectId | null;
}

export interface DynamicField {
	digest: TransactionDigest;
	objectId: ObjectId;
	version: number;
	type: "DynamicField" | "DynamicObject";
	name: string;
	objectType: AnyObjectType;
}

export interface DynamicFieldObjectsWithCursor<ObjectType> {
	dynamicFieldObjects: ObjectType[];
	nextCursor: ObjectId | null;
}

/////////////////////////////////////////////////////////////////////
//// Transactions
/////////////////////////////////////////////////////////////////////

export interface TransactionDigestsWithCursor {
	transactionDigests: TransactionDigest[];
	nextCursor: TransactionDigest | null;
}
export interface TransactionsWithCursor {
	transactions: SuiTransactionResponse[];
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
