import {
	DynamicFieldInfo,
	EventId,
	SuiTransactionBlockResponse,
} from "@mysten/sui.js/client";
import {
	Scallop,
	ScallopBuilder,
	ScallopQuery,
} from "@scallop-io/sui-scallop-sdk";

// =========================================================================
//  bigint
// =========================================================================

export type Balance = bigint;
export type IFixed = bigint;

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
export type Apr = number;
export type Apy = number;

// =========================================================================
//  string
// =========================================================================

export type SerializedTransaction = string;
export type TxBytes = string;
export type BigIntAsString = string;
export type IFixedAsString = string;
export type KeyType = string;
export type AnyObjectType = string;
export type ModuleName = string;
export type FunctionName = string;
export type PackageId = string;
export type Color = string;
export type Url = string;
export type LocalUrl = string;
export type FilePath = string;
export type ObjectId = string;
export type SuiAddress = string;
export type TransactionDigest = string;

// =========================================================================
//  General
// =========================================================================

/**
 * Fee info for third party packages wanting to fee transactions
 */
export interface ExternalFee {
	/**
	 * Address of recipient for collected fees
	 */
	recipient: SuiAddress;
	/**
	 * Percent of fees to be collected from coin
	 *
	 * @remarks 0.54 = 54%
	 */
	feePercentage: Percentage;
}

// =========================================================================
//  Events
// =========================================================================

export interface IndexerEventsWithCursor<EventType> {
	events: EventType[];
	nextCursor: number | undefined;
}

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

// =========================================================================
//  Indexer
// =========================================================================

export type ApiIndexerEventsBody = ApiDataWithCursorBody<number>;

export type ApiIndexerUserEventsBody = ApiIndexerEventsBody & {
	walletAddress: SuiAddress;
};

export interface IndexerResponse<DataType> {
	data: DataType;
}

export interface IndexerDataWithCursorQueryParams {
	skip: number;
	limit: number;
}

// =========================================================================
//  Scallop
// =========================================================================

export interface ScallopProviders {
	Main: Scallop;
	Builder: ScallopBuilder;
	Query: ScallopQuery;
}
