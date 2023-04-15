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

// Approximate balances come from js-side numerical methods. This type distinction is to remind us
// that js-produced values are not equal to their on chain equivalent.
export type ApproximateBalance = bigint;

export const useApproximateBalance = (
	approximation: ApproximateBalance
): Balance => approximation;

export type F18Ratio = bigint;

/////////////////////////////////////////////////////////////////////
//// number
/////////////////////////////////////////////////////////////////////

export type GasBudget = number;
export type Timestamp = number;
export type Byte = number;
export type Slippage = number;

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
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface Object {
	objectId: ObjectId;
}

export interface ObjectDisplay {}

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
