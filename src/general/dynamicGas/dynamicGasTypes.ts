import type { CoinType } from "../../types";
import type { SerializedTransaction, SuiAddress } from "../types";

/**
 * JSON body sent to the Aftermath dynamic-gas HTTP endpoint.
 *
 * The endpoint receives a serialized transaction and the wallet and coin type
 * that the service should use when preparing gas. These values are strings;
 * the transaction and coin amounts are not represented as JavaScript numbers
 * in this body.
 */
export interface ApiDynamicGasBody {
	/**
	 * The serialized transaction block produced by `Transaction.toJSON()`.
	 * This is the SDK's serialized transaction string, not a parsed transaction
	 * object.
	 */
	serializedTx: SerializedTransaction;
	/**
	 * The Sui address whose transaction the service prepares.
	 */
	walletAddress: SuiAddress;
	/**
	 * The fully qualified Move coin type to prefer for gas payment, such as
	 * `0x2::sui::SUI`.
	 */
	gasCoinType: CoinType;
}

/**
 * Response returned by the Aftermath dynamic-gas HTTP endpoint.
 */
export interface ApiDynamicGasResponse {
	/**
	 * The transaction bytes returned by the service after gas preparation.
	 * Keep this serialized string for the signing or execution flow expected by
	 * the dynamic-gas service.
	 */
	txBytes: SerializedTransaction;
	/**
	 * The sponsor signature paired with `txBytes`.
	 */
	sponsoredSignature: string;
}
