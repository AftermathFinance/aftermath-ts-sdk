import {
	DynamicFieldInfo,
	EventId,
	SuiTransactionBlockResponse,
} from "@mysten/sui/client";
import { SuiNetwork } from "./suiTypes.ts";

/**
 * Represents a token or currency balance in the system, defined as a bigint.
 */
export type Balance = bigint;

/**
 * Represents a fixed-point integer using a bigint. May be used for calculations requiring
 * precision (e.g., decimal-like math).
 */
export type IFixed = bigint;

/**
 * Represents a gas budget for transactions. Typically a raw `number`.
 */
export type GasBudget = number;

/**
 * Represents a timestamp in milliseconds or seconds. Typically a raw `number`.
 */
export type Timestamp = number;

/**
 * A single byte, typically expressed as a `number` from 0 to 255.
 */
export type Byte = number;

/**
 * Defines the allowable slippage in a trading scenario, expressed as an unscaled percentage (e.g., 0.01 = 1%).
 */
export type Slippage = number;

/**
 * Represents an unscaled percentage (e.g., 0.01 = 1%).
 */
export type Percentage = number;

/**
 * Annual percentage rate (APR), expressed as a `number` (e.g., 0.01 = 1%).
 */
export type Apr = number;

/**
 * Annual percentage yield (APY), expressed as a `number` (e.g., 0.01 = 1%).
 */
export type Apy = number;

/**
 * Represents the version of an on-chain object, expressed as a `number`.
 */
export type ObjectVersion = number;

/**
 * Represents an error code from a Move smart contract, typically a `number`.
 */
export type MoveErrorCode = number;

/**
 * Represents a serialized transaction in a base64 or similar format.
 */
export type SerializedTransaction = string;

/**
 * Represents raw transaction bytes in a base64 or similar format.
 */
export type TxBytes = string;

/**
 * Represents a BigInt in string form, typically used for JSON serialization.
 */
export type BigIntAsString = string;

/**
 * Represents a numeric value in string form, typically used for JSON serialization.
 */
export type NumberAsString = string;

/**
 * Represents an IFixed value in string form, typically used for JSON serialization.
 */
export type IFixedAsString = string;

/**
 * A key type used in certain contexts, typically a string (e.g., "ed25519", "secp256k1").
 */
export type KeyType = string;

/**
 * Represents any string identifying an object type, such as "0x2::sui::SUI".
 */
export type AnyObjectType = string;

/**
 * Represents the name of a Move module, e.g. "Router" or "Coin".
 */
export type ModuleName = string;

/**
 * Represents the name of a Move function, e.g. "swap" or "mint".
 */
export type FunctionName = string;

/**
 * Represents the ID of a published Move package on the Sui network, e.g. "0x<package_id>".
 */
export type PackageId = string;

/**
 * Represents a color in a string format (e.g., "#FFFFFF" or "blue").
 */
export type Color = string;

/**
 * Represents a URL in string format (e.g., "https://example.com").
 */
export type Url = string;

/**
 * Represents a local resource URL (e.g., "file://path/to/resource").
 */
export type LocalUrl = string;

/**
 * Represents a file path (e.g., "/usr/local/bin").
 */
export type FilePath = string;

/**
 * Represents an on-chain object ID (e.g., "0x<32-byte_hex>").
 */
export type ObjectId = string;

/**
 * Represents a Sui wallet address (e.g., "0x<address>").
 */
export type SuiAddress = string;

/**
 * Represents a TransactionDigest from a Sui transaction, typically a hex-encoded string.
 */
export type TransactionDigest = string;

/**
 * Represents a single byte in string form, usually hex-encoded (e.g., "0xFF").
 */
export type StringByte = string;

/**
 * Represents an object's digest, typically a hex-encoded string.
 */
export type ObjectDigest = string;

/**
 * Represents an IFixed type as an array of bytes.
 */
export type IFixedAsBytes = Byte[];

/**
 * Represents an IFixed type in string form, each byte also in string form.
 */
export type IFixedAsStringBytes = string[];

/**
 * Represents an ID as an array of bytes in string form.
 */
export type IdAsStringBytes = string[];

/**
 * Holds information about third-party fees in transactions, including the recipient
 * and the fee percentage to be collected.
 */
export interface ExternalFee {
	/**
	 * Address of the recipient for collected fees.
	 */
	recipient: SuiAddress;
	/**
	 * Percentage of the fee to be collected.
	 * @remarks 0.54 = 54%
	 */
	feePercentage: Percentage;
}

/**
 * A function signature for signing arbitrary messages. Typically used in
 * cryptographic contexts.
 */
export type SignMessageCallback = (args: { message: Uint8Array }) => Promise<{
	signature: string;
}>;

/**
 * Generic shape for events with optional paging cursor data.
 */
export interface IndexerEventsWithCursor<EventType> {
	/**
	 * An array of events of type `EventType`.
	 */
	events: EventType[];
	/**
	 * The next cursor position. If undefined, no more events are available.
	 */
	nextCursor: number | undefined;
}

/**
 * A generic shape for events with a Sui-based cursor structure.
 */
export interface EventsWithCursor<EventType> {
	/**
	 * An array of events of type `EventType`.
	 */
	events: EventType[];
	/**
	 * The next cursor position. If null, no more events are available.
	 */
	nextCursor: EventId | null;
}

/**
 * Represents a Sui event, typically including type, timestamp, and transaction digest.
 */
export interface Event {
	/**
	 * A string identifying the Move event type.
	 */
	type: AnyObjectType;
	/**
	 * Timestamp of the event, if available.
	 */
	timestamp: Timestamp | undefined;
	/**
	 * The transaction digest associated with the event.
	 */
	txnDigest: TransactionDigest;
}

/**
 * Common inputs for event retrieval, including an optional cursor and limit.
 */
export interface EventsInputs {
	/**
	 * Cursor for pagination, often an EventId or numeric index.
	 */
	cursor?: EventId;
	/**
	 * Limit for pagination, specifying the maximum number of events.
	 */
	limit?: number;
}

/**
 * Inputs for retrieving user events, extending from general event inputs
 * and including the user's wallet address.
 */
export type UserEventsInputs = EventsInputs & {
	walletAddress: SuiAddress;
};

/**
 * Represents a Sui object, including its ID and type.
 */
export interface Object {
	/**
	 * The on-chain object ID.
	 */
	objectId: ObjectId;
	/**
	 * The Move type of the object.
	 */
	objectType: AnyObjectType;
}

/**
 * Holds the dynamic fields and an optional next cursor for pagination.
 */
export interface DynamicFieldsWithCursor {
	/**
	 * An array of dynamic field information objects.
	 */
	dynamicFields: DynamicFieldInfo[];
	/**
	 * The next cursor for pagination. If null, no more fields are available.
	 */
	nextCursor: ObjectId | null;
}

/**
 * Holds the dynamic field objects and an optional next cursor for pagination.
 */
export interface DynamicFieldObjectsWithCursor<ObjectType> {
	/**
	 * An array of objects derived from dynamic fields.
	 */
	dynamicFieldObjects: ObjectType[];
	/**
	 * The next cursor for pagination. If null, no more fields are available.
	 */
	nextCursor: ObjectId | null;
}

/**
 * Inputs for fetching dynamic fields, including optional cursor and limit for pagination.
 */
export interface DynamicFieldsInputs {
	cursor?: ObjectId;
	limit?: number;
}

/**
 * A collection of transactions with a cursor for pagination.
 */
export interface TransactionsWithCursor {
	/**
	 * An array of Sui transactions.
	 */
	transactions: SuiTransactionBlockResponse[];
	/**
	 * The next cursor for pagination. If null, no more transactions are available.
	 */
	nextCursor: TransactionDigest | null;
}

/**
 * Generic shape for API data requests that include pagination parameters.
 */
export interface ApiDataWithCursorBody<CursorType> {
	/**
	 * Cursor for pagination.
	 */
	cursor?: CursorType;
	/**
	 * Limit for pagination.
	 */
	limit?: number;
}

/**
 * Specifies the shape for API calls involving events.
 */
export type ApiEventsBody = ApiDataWithCursorBody<EventId>;

/**
 * Specifies the shape for API calls involving dynamic fields.
 */
export type ApiDynamicFieldsBody = ApiDataWithCursorBody<ObjectId>;

/**
 * Specifies the shape for API calls involving transactions.
 */
export type ApiTransactionsBody = ApiDataWithCursorBody<TransactionDigest>;

/**
 * Body payload for indexer-based event queries, using a numeric cursor.
 */
export type ApiIndexerEventsBody = ApiDataWithCursorBody<number>;

/**
 * Body payload for indexer-based user events, extending from `ApiIndexerEventsBody`.
 */
export type ApiIndexerUserEventsBody = ApiIndexerEventsBody & {
	/**
	 * The wallet address of the user.
	 */
	walletAddress: SuiAddress;
};

/**
 * Represents query parameters for retrieving data with skip/limit pagination in an indexer.
 */
export interface IndexerDataWithCursorQueryParams {
	skip: number;
	limit: number;
}

/**
 * Configuration for constructing a `Caller`. Includes network specification
 * and optional access token for authentication.
 */
export interface CallerConfig {
	/**
	 * The target Sui network (e.g., "MAINNET", "TESTNET").
	 */
	network?: SuiNetwork;
	/**
	 * Access token used for authenticated requests, if required.
	 */
	accessToken?: string;
}
