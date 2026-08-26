import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { MultiSigPublicKey } from "@mysten/sui/multisig";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import type { SharedCustodyAddresses } from "../../../types";
import type { ApiMultisigUserBody, MultisigData } from "../multisigTypes";

/**
 * Derives the Aftermath shared-custody multisig key for a user's Ed25519 key.
 *
 * The derivation is local. This class does not make network requests or sign
 * transactions.
 */
export class MultisigApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	/** Shared-custody address and base64-encoded Ed25519 public key from the provider. */
	readonly sharedCustodyAddresses: SharedCustodyAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a multisig derivation helper from a configured `AftermathApi`.
	 *
	 * @param api - Provider containing the shared-custody public key.
	 * @throws `Error` when shared-custody addresses are not configured.
	 */
	constructor(private readonly api: AftermathApi) {
		const sharedCustodyAddresses = this.api.addresses.sharedCustody;
		if (!sharedCustodyAddresses) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.sharedCustodyAddresses = sharedCustodyAddresses;
	}

	// =========================================================================
	//  Fetch
	// =========================================================================

	/**
	 * Derives a deterministic 1-of-2 Sui multisig from the shared-custody key
	 * and the user's Ed25519 public key.
	 *
	 * Each key has weight `1`, and either key can authorize the multisig because
	 * the threshold is `1`. The user key may be 32 raw Ed25519 bytes or 33 bytes
	 * with the leading Sui Ed25519 scheme flag. The configured shared-custody
	 * key is base64 encoded and includes its scheme flag, which this method strips
	 * before constructing the key.
	 *
	 * @param inputs - User public key bytes in raw or Sui scheme-flagged format.
	 * @returns The derived `MultiSigPublicKey` and its corresponding Sui address.
	 * @throws `Error` when either public key is missing or has an invalid length.
	 */
	getMultisigForUser(inputs: ApiMultisigUserBody): MultisigData {
		const afPublicKeyBuffer = Buffer.from(
			this.sharedCustodyAddresses.publicKey || "",
			"base64"
		);

		// MARK: Shifting the first byte (scheme flag)
		const afPublicKeyArray = new Uint8Array(afPublicKeyBuffer).subarray(1);
		const afPK = new Ed25519PublicKey(afPublicKeyArray);

		// MARK: Strip the scheme flag byte from user key if present
		const userPublicKeyArray = new Uint8Array(inputs.userPublicKey);
		const userPK = new Ed25519PublicKey(
			userPublicKeyArray.length === 33
				? userPublicKeyArray.subarray(1)
				: userPublicKeyArray
		);

		const newMultiSigPublicKey = MultiSigPublicKey.fromPublicKeys({
			threshold: 1,
			publicKeys: [
				{ publicKey: afPK, weight: 1 },
				{ publicKey: userPK, weight: 1 },
			],
		});

		return {
			publicKey: newMultiSigPublicKey,
			address: newMultiSigPublicKey.toSuiAddress(),
		};
	}
}
