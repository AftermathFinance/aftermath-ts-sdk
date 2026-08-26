import { SuiAddress } from "../../types";

/**
 * Request body for creating or updating a wallet's public key in Aftermath's
 * backend. The `bytes` and `signature` fields carry proof of wallet ownership.
 */
export interface ApiUserDataCreateUserBody {
	/**
	 * The user's Sui wallet address.
	 */
	walletAddress: SuiAddress;
	/**
	 * Serialized bytes of the message that the user signed. For the current
	 * terms flow, these are the UTF-8 bytes of `Aftermath Terms and Conditions`.
	 */
	bytes: string;
	/**
	 * Signature created by signing `bytes`.
	 */
	signature: string;
}

/**
 * Request body for fetching a wallet's stored public key.
 */
export interface ApiUserDataPublicKeyBody {
	/**
	 * The user's Sui wallet address.
	 */
	walletAddress: SuiAddress;
}
