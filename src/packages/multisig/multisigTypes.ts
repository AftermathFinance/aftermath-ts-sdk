import { MultiSigPublicKey } from "@mysten/sui/multisig";

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
	 * The structured multisig public key object.
	 */
	publicKey: MultiSigPublicKey;
	/**
	 * The resulting multisig address string.
	 */
	address: string;
}
