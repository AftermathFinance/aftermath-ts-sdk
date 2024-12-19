import { MultiSigPublicKey } from "@mysten/sui/multisig";

// =========================================================================
// API
// =========================================================================

export interface ApiMultisigUserBody {
	userPublicKey: Uint8Array;
}

export interface MultisigData {
	publicKey: MultiSigPublicKey;
	address: string;
}
