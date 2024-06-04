import { CoinType } from "../../types";
import { SerializedTransaction, SuiAddress } from "../types";

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
