import type { MultiSigPublicKey } from "@mysten/sui/multisig";

/**
 * Represents the body needed to request a multisig setup for a user by sending
 * their single public key in the correct byte format.
 */
export interface ApiMultisigUserBody {
	/**
	 * The user's single public key in a `Uint8Array` byte format.
	 */
	userPublicKey: Uint8Array;
}

/**
 * Represents the response data for a multisig retrieval, containing the multisig
 * public key structure and its corresponding Sui address.
 */
export interface MultisigData {
	/**
	 * The structured 1-of-2 multisig public key with the shared-custody and user
	 * Ed25519 keys, each with weight `1`.
	 */
	publicKey: MultiSigPublicKey;
	/**
	 * The Sui address derived from `publicKey`.
	 */
	address: string;
}
