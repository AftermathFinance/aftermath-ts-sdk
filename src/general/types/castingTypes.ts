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

export type BcsTypeName = string | [string, ...(BcsTypeName | string)[]];

// =========================================================================
//  Name Only
// =========================================================================

// export type SuiAddressWithout0x = string;

// =========================================================================
//  On Chain
// =========================================================================

export interface EventOnChain<Fields> {
	id: {
		txDigest: TransactionDigest;
		eventSeq: BigIntAsString;
	};
	packageId: ObjectId;
	transactionModule: ModuleName;
	sender: SuiAddress;
	type: AnyObjectType;
	parsedJson: Fields; // | undefined;
	bcs: string; // | undefined;
	timestampMs: number | string | undefined;
}

export interface WrappedEventOnChain<Fields> {
	id: {
		txDigest: TransactionDigest;
		eventSeq: BigIntAsString;
	};
	packageId: ObjectId;
	transactionModule: ModuleName;
	sender: SuiAddress;
	type: AnyObjectType;
	parsedJson: {
		pos0: Fields; // | undefined;
	};
	bcs: string; // | undefined;
	timestampMs: number | string | undefined;
}

export type IndexerEventOnChain<Fields> = {
	type: AnyObjectType;
	timestamp: number | null;
	txnDigest: TransactionDigest;
} & Fields;

/**
 * A **nested** Move struct as it arrives from either fullnode protocol.
 *
 * gRPC's `json` object view returns nested structs bare; JSON-RPC wrapped them
 * in a `{ type, fields }` envelope. Read one through
 * `GrpcCasting.unwrapStructField`, which resolves either arm.
 *
 * ⚠️ The envelope's `type` is **not** present on the gRPC arm. Where a caster
 * needs the nested struct's Move type, take it from the enclosing object's own
 * type parameters via `Helpers.getObjectType` instead.
 */
export type MoveStructOnChain<Fields> =
	| Fields
	| {
			type?: AnyObjectType;
			fields: Fields;
		};

/**
 * A Move `UID` as it arrives from either protocol: a bare id string under gRPC,
 * `{ id }` (or `{ id: { id } }` one level up) under JSON-RPC. Read one through
 * `GrpcCasting.unwrapUid`.
 */
export type UidOnChain = ObjectId | { id: ObjectId } | { id: { id: ObjectId } };

/**
 * A Move `vector<u8>` as it arrives from either protocol: base64 under gRPC, a
 * number array under JSON-RPC. Read one through
 * `GrpcCasting.bytesFieldToNumbers` — indexing it directly yields a
 * one-character string under gRPC, and `Number(...)` of that is silently `NaN`.
 */
export type BytesOnChain = string | number[];

export interface TableFieldsOnChain {
	id: UidOnChain;
	size: BigIntAsString;
}

export type TableOnChain = MoveStructOnChain<TableFieldsOnChain>;

export interface SupplyFieldsOnChain {
	value: BigIntAsString;
}

export type SupplyOnChain = MoveStructOnChain<SupplyFieldsOnChain>;

// export interface TypeNameOnChain {
// 	type: AnyObjectType;
// 	fields: {
// 		name: AnyObjectType;
// 	};
// }
