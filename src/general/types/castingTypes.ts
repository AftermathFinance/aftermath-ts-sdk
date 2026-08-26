import type {
	AnyObjectType,
	BigIntAsString,
	ModuleName,
	ObjectId,
	SuiAddress,
	TransactionDigest,
} from "./generalTypes";

// =========================================================================
//  BCS
// =========================================================================

/**
 * Names a BCS type and, optionally, its type arguments.
 *
 * A string names a non-generic type. A tuple stores the type name at index `0`
 * and recursively stores the names of its generic arguments after it.
 */
export type BcsTypeName = string | [string, ...(BcsTypeName | string)[]];

// =========================================================================
//  Name Only
// =========================================================================

// export type SuiAddressWithout0x = string;

// =========================================================================
//  On Chain
// =========================================================================

/**
 * The JSON-RPC-shaped event record consumed by the package event casters.
 *
 * `Fields` is the parsed event payload. Numeric fields that Sui serializes as
 * large integers remain decimal strings in the transport shape.
 */
export interface EventOnChain<Fields> {
	/** The transaction digest and sequence number that identify the event. */
	id: {
		/** The digest of the transaction that emitted the event. */
		txDigest: TransactionDigest;
		/** The event's zero-based sequence number as a decimal string. */
		eventSeq: BigIntAsString;
	};
	/** The published package that defines the event type. */
	packageId: ObjectId;
	/** The Move module that emitted the event. */
	transactionModule: ModuleName;
	/** The Sui address that sent the transaction. */
	sender: SuiAddress;
	/** The fully qualified Move event type. */
	type: AnyObjectType;
	/** The event payload after the transport has parsed its JSON fields. */
	parsedJson: Fields; // | undefined;
	/** The event's BCS representation as a string. */
	bcs: string; // | undefined;
	/** The event timestamp in epoch milliseconds, when the transport provides it. */
	timestampMs: number | string | undefined;
}

/**
 * An event record whose parsed payload is wrapped under `parsedJson.pos0`.
 *
 * The wrapper matches the shape used by the affected on-chain event versions;
 * the remaining metadata fields have the same meaning as `EventOnChain`.
 */
export interface WrappedEventOnChain<Fields> {
	/** The transaction digest and sequence number that identify the event. */
	id: {
		/** The digest of the transaction that emitted the event. */
		txDigest: TransactionDigest;
		/** The event's zero-based sequence number as a decimal string. */
		eventSeq: BigIntAsString;
	};
	/** The published package that defines the event type. */
	packageId: ObjectId;
	/** The Move module that emitted the event. */
	transactionModule: ModuleName;
	/** The Sui address that sent the transaction. */
	sender: SuiAddress;
	/** The fully qualified Move event type. */
	type: AnyObjectType;
	/** The event payload wrapped under the `pos0` field. */
	parsedJson: {
		/** The parsed event payload. */
		pos0: Fields; // | undefined;
	};
	/** The event's BCS representation as a string. */
	bcs: string; // | undefined;
	/** The event timestamp in epoch milliseconds, when the transport provides it. */
	timestampMs: number | string | undefined;
}

/**
 * The event shape returned by the indexer before a package caster converts it.
 *
 * `Fields` contributes the event-specific properties to this intersection.
 */
export type IndexerEventOnChain<Fields> = {
	/** The fully qualified Move event type. */
	type: AnyObjectType;
	/** The event timestamp in epoch milliseconds, or `null` when absent. */
	timestamp: number | null;
	/** The digest of the transaction that emitted the event. */
	txnDigest: TransactionDigest;
} & Fields;

/**
 * A nested Move struct as it arrives from either fullnode protocol.
 *
 * gRPC's `json` object view returns nested structs bare; JSON-RPC wrapped them
 * in a `{ type, fields }` envelope. Read one through
 * `GrpcCasting.unwrapStructField`, which resolves either arm.
 *
 * The envelope's `type` is not present on the gRPC arm. When a caster needs the
 * nested struct's Move type, it must take it from the enclosing object's type
 * parameters through `Helpers.getObjectType`.
 */
export type MoveStructOnChain<Fields> =
	| Fields
	| {
			/** The nested struct's Move type when JSON-RPC supplies the envelope. */
			type?: AnyObjectType;
			/** The nested struct fields inside the JSON-RPC envelope. */
			fields: Fields;
		};

/**
 * A Move `UID` as it arrives from either protocol: a bare id string under gRPC,
 * `{ id }` (or `{ id: { id } }` one level up) under JSON-RPC. Read one through
 * `GrpcCasting.unwrapUid`.
 */
export type UidOnChain =
	| ObjectId
	| {
			/** The object ID in the one-level JSON-RPC UID envelope. */
			id: ObjectId;
		}
	| {
			/** The outer JSON-RPC UID envelope. */
			id: {
				/** The object ID in the nested UID envelope. */
				id: ObjectId;
			};
		};

/**
 * A Move `vector<u8>` as it arrives from either protocol: base64 under gRPC and
 * a number array under JSON-RPC. Read it through
 * `GrpcCasting.bytesFieldToNumbers`; indexing the gRPC string directly yields a
 * one-character string, and `Number(...)` of that value is `NaN`.
 */
export type BytesOnChain = string | number[];

/** The Move fields stored in a `table::Table` value. */
export interface TableFieldsOnChain {
	/** The table's UID in the gRPC or JSON-RPC transport shape. */
	id: UidOnChain;
	/** The number of entries, serialized as a decimal string. */
	size: BigIntAsString;
}

/** A `table::Table` value in either protocol's nested-struct shape. */
export type TableOnChain = MoveStructOnChain<TableFieldsOnChain>;

/** The Move fields stored in a `balance::Supply` value. */
export interface SupplyFieldsOnChain {
	/** The supply value, serialized as a decimal string. */
	value: BigIntAsString;
}

/** A `balance::Supply` value in either protocol's nested-struct shape. */
export type SupplyOnChain = MoveStructOnChain<SupplyFieldsOnChain>;

// export interface TypeNameOnChain {
// 	type: AnyObjectType;
// 	fields: {
// 		name: AnyObjectType;
// 	};
// }
