import { CoinType } from "../../types";
import { SerializedTransaction, SuiAddress } from "../types";

/**
 * Represents the body payload sent to the dynamic gas service,
 * which includes the serialized transaction and any user-provided
 * gas configuration (e.g., coin type).
 */
export interface ApiDynamicGasBody {
	/**
	 * The serialized transaction block in base64 or similar format.
	 */
	serializedTx: SerializedTransaction;
	/**
	 * The address of the user for whom the dynamic gas is being set.
	 */
	walletAddress: SuiAddress;
	/**
	 * The coin type to be used for gas payment (e.g., "0x2::sui::SUI").
	 */
	gasCoinType: CoinType;
}

/**
 * Represents the response from the dynamic gas service, typically returning
 * updated transaction bytes and possibly a sponsored signature if the
 * transaction gas is being partially or fully sponsored.
 */
export interface ApiDynamicGasResponse {
	/**
	 * The modified transaction bytes that incorporate a gas coin or sponsor information.
	 */
	txBytes: SerializedTransaction;
	/**
	 * A signature used to sponsor or verify the updated transaction, if applicable.
	 */
	sponsoredSignature: string;
}
