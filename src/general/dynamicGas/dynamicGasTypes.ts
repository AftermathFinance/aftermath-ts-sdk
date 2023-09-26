// =========================================================================
//  API
// =========================================================================

import { SerializedSignature } from "@mysten/sui.js/dist/cjs/cryptography";
import { CoinType } from "../../types";
import { SerializedTransaction, SuiAddress } from "../types";

export interface ApiDynamicGasBody {
	serializedTx: SerializedTransaction;
	walletAddress: SuiAddress;
	gasCoinType: CoinType;
}

export interface ApiDynamicGasResponse {
	txBytes: SerializedTransaction;
	sponsoredSignature: SerializedSignature;
}
