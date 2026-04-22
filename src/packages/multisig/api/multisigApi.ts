import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { MultiSigPublicKey } from "@mysten/sui/multisig";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import type { SharedCustodyAddresses } from "../../../types";
import type { ApiMultisigUserBody, MultisigData } from "../multisigTypes";

export class MultisigApi {
  // =========================================================================
  //  Class Members
  // =========================================================================

  readonly sharedCustodyAddresses: SharedCustodyAddresses;
  private readonly Provider: AftermathApi;

  // =========================================================================
  //  Constructor
  // =========================================================================

  constructor(Provider: AftermathApi) {
    this.Provider = Provider;

    const sharedCustodyAddresses = this.Provider.addresses.sharedCustody;
    if (!sharedCustodyAddresses) {
      throw new Error("not all required addresses have been set in provider");
    }

    this.sharedCustodyAddresses = sharedCustodyAddresses;
  }

  // =========================================================================
  //  Fetch
  // =========================================================================

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
