import { CoinType } from "../../types";
import { ObjectId, SerializedTransaction, SuiAddress } from "../types";

// =========================================================================
//  Shared With Service
// =========================================================================

export type DynamicGasCoinData =
	| { Coin: ObjectId }
	| { Input: number }
	| { Result: number }
	| { NestedResult: [number, number] };

// =========================================================================
//  API
// =========================================================================

export interface ApiDynamicGasBody {
	serializedTx: SerializedTransaction;
	walletAddress: SuiAddress;
	gasCoinType: CoinType;
}

export interface ApiDynamicGasResponse {
	txBytes: SerializedTransaction;
	sponsoredSignature: string;
}
