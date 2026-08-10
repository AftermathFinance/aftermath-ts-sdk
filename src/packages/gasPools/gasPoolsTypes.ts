import type { TransactionObjectArgument } from "@mysten/sui/transactions";
import type {
	Balance,
	ObjectId,
	SerializedTransaction,
	Slippage,
	SuiAddress,
} from "../../general/types/generalTypes";
import type { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Api
// =========================================================================

// =========================================================================
//  Pool
// =========================================================================

export interface ApiGasPoolBody {
	walletAddress: SuiAddress;
}

export interface ApiGasPoolResponse {
	walletAddress: SuiAddress;
	gasPoolId: ObjectId | undefined;
	balance: Balance;
	whitelistedAddresses: SuiAddress[];
}

// =========================================================================
//  Transactions
// =========================================================================

// =========================================================================
//  Create
// =========================================================================

export interface ApiGasPoolCreateBody {
	walletAddress: SuiAddress;
	initialDepositAmount?: Balance;
	txKind?: SerializedTransaction;
	deferShare?: boolean;
}

export interface ApiGasPoolCreateResponse {
	txKind: SerializedTransaction;
	gasPoolArg?: TransactionObjectArgument;
	sharePolicyArg?: TransactionObjectArgument;
}

// =========================================================================
//  Deposit
// =========================================================================

export interface ApiGasPoolDepositBody {
	walletAddress: SuiAddress;
	/** Whether to build the transaction for sponsored gas. Defaults to false. */
	isSponsoredTx?: boolean;
	/** Coin type of the deposit token. Defaults to SUI if omitted.
	 * When set to a non-SUI type, the endpoint swaps to SUI before depositing. */
	coinType?: CoinType;
	/** Amount of the input coin to deposit (or swap, for non-SUI). */
	amount?: Balance;
	/** PTB coin argument to use as the input coin. If omitted, sourced from wallet. */
	coinArg?: TransactionObjectArgument;
	/** Slippage tolerance for non-SUI swaps (0.0–1.0). Defaults to 0.01. */
	slippage?: Slippage;
	txKind?: SerializedTransaction;
	gasPoolArg?: TransactionObjectArgument;
}

// =========================================================================
//  Withdraw
// =========================================================================

export interface ApiGasPoolWithdrawBody {
	walletAddress: SuiAddress;
	amount: Balance;
	recipientAddress?: SuiAddress;
	/** When true, the withdrawn coin is not transferred; its arg is returned instead. */
	deferTransfer?: boolean;
	txKind?: SerializedTransaction;
	gasPoolArg?: TransactionObjectArgument;
}

export interface ApiGasPoolWithdrawResponse {
	txKind: SerializedTransaction;
	/** PTB argument for the withdrawn coin (only set when `deferTransfer = true`). */
	withdrawnCoinArg?: TransactionObjectArgument;
}

// =========================================================================
//  Sponsor
// =========================================================================

export interface ApiGasPoolSponsorBody {
	walletAddress: SuiAddress;
	/**
	 * Base64 of the JSON `{"action":"SPONSOR_GAS","date":<unix seconds>}` signed
	 * by `walletAddress`. Proves who is asking, not what for. Reusable for a day
	 * either side of `date`, so sign once and cache it.
	 */
	bytes: string;
	/** `walletAddress`'s signature over `bytes`. */
	signature: string;
	txKind?: SerializedTransaction;
}

/**
 * A complete sponsored transaction. The client signs `transaction` as the
 * sender and submits it together with `sponsorSignature`; `digest` is what both
 * signatures commit to.
 */
export interface ApiGasPoolSponsorResponse {
	/** Base64 BCS `Transaction`, gas payment and epoch bound already attached. */
	transaction: SerializedTransaction;
	/** The gas pool sponsor's signature over `transaction`. */
	sponsorSignature: string;
	/** Digest of `transaction`. */
	digest: string;
}

// =========================================================================
//  Grant
// =========================================================================

export interface ApiGasPoolGrantBody {
	walletAddress: SuiAddress;
	targetWalletAddress: SuiAddress;
	txKind?: SerializedTransaction;
	gasPoolArg?: TransactionObjectArgument;
}

// =========================================================================
//  Revoke
// =========================================================================

export interface ApiGasPoolRevokeBody {
	walletAddress: SuiAddress;
	targetWalletAddress: SuiAddress;
	txKind?: SerializedTransaction;
}

// =========================================================================
//  Share
// =========================================================================

export interface ApiGasPoolShareBody {
	gasPoolArg: TransactionObjectArgument;
	sharePolicyArg: TransactionObjectArgument;
	txKind?: SerializedTransaction;
}
