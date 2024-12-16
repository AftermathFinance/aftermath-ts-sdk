import { AftermathApi } from "../../../general/providers/aftermathApi";
import { SharedCustodyAddresses } from "../../../types";
import { MultiSigPublicKey } from "@mysten/sui/multisig";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { ApiMultisigUserBody, MultisigBody } from "../multisigTypes";

export class MultisigApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly sharedCustodyAddresses: SharedCustodyAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const sharedCustodyAddresses = this.Provider.addresses.sharedCustody;
		if (!sharedCustodyAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.sharedCustodyAddresses = sharedCustodyAddresses;
	}

	// =========================================================================
	//  Fetch
	// =========================================================================

	public async fetchMultisigForUser(
		inputs: ApiMultisigUserBody
	): Promise<MultisigBody> {
		const afPublicKeyBuffer = Buffer.from(
			this.sharedCustodyAddresses.publicKey || "",
			"base64"
		);
		const afPublicKeyArray = new Uint8Array(afPublicKeyBuffer).subarray(1); // Shifting the first byte
		const afPK = new Ed25519PublicKey(afPublicKeyArray);
		const userPK = new Ed25519PublicKey(inputs.userPublicKey);

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
