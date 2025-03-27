import { SuiAddress } from "../../types";

/**
 * Request body for creating or registering a user’s public key in Aftermath’s backend.
 * It typically includes proof of ownership by having the user sign a specific message.
 */
export interface ApiUserDataCreateUserBody {
	/**
	 * The user's Sui wallet address (e.g., "0x<address>").
	 */
	walletAddress: SuiAddress;
	/**
	 * The message bytes (in hex string form) that the user signed.
	 */
	bytes: string;
	/**
	 * The signature (in hex string form) created by signing `bytes`.
	 */
	signature: string;
}

/**
 * Request body for fetching a user’s public key by their wallet address.
 */
export interface ApiUserDataPublicKeyBody {
	/**
	 * The user's Sui wallet address.
	 */
	walletAddress: SuiAddress;
}
