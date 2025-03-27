import { CoinType } from "../..";
import {
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
	timestampMs: number | undefined;
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
	timestampMs: number | undefined;
}

export type IndexerEventOnChain<Fields> = {
	type: AnyObjectType;
	timestamp: number | null;
	txnDigest: TransactionDigest;
} & Fields;

export interface TableOnChain {
	type: AnyObjectType;
	fields: {
		id: {
			id: ObjectId;
		};
		size: BigIntAsString;
	};
}

export interface SupplyOnChain {
	type: AnyObjectType;
	fields: {
		value: BigIntAsString;
	};
}

// export interface TypeNameOnChain {
// 	type: AnyObjectType;
// 	fields: {
// 		name: AnyObjectType;
// 	};
// }
