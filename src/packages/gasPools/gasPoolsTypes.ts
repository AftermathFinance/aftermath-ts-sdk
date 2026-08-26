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

/**
 * Inputs for querying the gas pool associated with a wallet.
 */
export interface ApiGasPoolBody {
	/** Wallet whose gas-pool membership and balance to query. */
	walletAddress: SuiAddress;
}

/**
 * Gas-pool details returned for a wallet.
 */
export interface ApiGasPoolResponse {
	/** Wallet used for the gas-pool query. */
	walletAddress: SuiAddress;
	/** Gas-pool object ID, or `undefined` when the wallet has no pool. */
	gasPoolId: ObjectId | undefined;
	/** Current gas-pool balance as a bigint. */
	balance: Balance;
	/** Wallets currently allowed to use the gas pool. */
	whitelistedAddresses: SuiAddress[];
}

// =========================================================================
//  Transactions
// =========================================================================

// =========================================================================
//  Create
// =========================================================================

/**
 * Inputs for creating a gas pool.
 */
export interface ApiGasPoolCreateBody {
	/** Wallet that owns the new gas pool. */
	walletAddress: SuiAddress;
	/** Optional initial SUI deposit amount, expressed in MIST. */
	initialDepositAmount?: Balance;
	/** Serialized transaction kind to submit when the server builds the transaction. */
	txKind?: SerializedTransaction;
	/** When `true`, defer sharing the new pool and return its PTB arguments. */
	deferShare?: boolean;
}

/**
 * Transaction data returned after creating a gas pool.
 */
export interface ApiGasPoolCreateResponse {
	/** Serialized transaction kind returned by the gas-pool service. */
	txKind: SerializedTransaction;
	/** PTB argument for the new gas pool when sharing is deferred. */
	gasPoolArg?: TransactionObjectArgument;
	/** PTB argument for the new share policy when sharing is deferred. */
	sharePolicyArg?: TransactionObjectArgument;
}

// =========================================================================
//  Deposit
// =========================================================================

/**
 * Inputs for depositing SUI or another supported coin into a gas pool.
 */
export interface ApiGasPoolDepositBody {
	/** Wallet submitting the deposit. */
	walletAddress: SuiAddress;
	/** Whether to build the transaction for sponsored gas. Defaults to false. */
	isSponsoredTx?: boolean;
	/** Coin type of the deposit token. Defaults to SUI if omitted.
	 * When set to a non-SUI type, the endpoint swaps to SUI before depositing. */
	coinType?: CoinType;
	/** Amount of the input coin to deposit or swap, as a bigint in that coin's smallest unit. */
	amount?: Balance;
	/** PTB coin argument to use as the input coin. If omitted, sourced from wallet. */
	coinArg?: TransactionObjectArgument;
	/** Slippage tolerance for non-SUI swaps (0.0–1.0). Defaults to 0.01. */
	slippage?: Slippage;
	/** Serialized transaction kind to submit when the server builds the transaction. */
	txKind?: SerializedTransaction;
	/** PTB gas-pool argument from an earlier command in the same transaction. */
	gasPoolArg?: TransactionObjectArgument;
}

// =========================================================================
//  Withdraw
// =========================================================================

/**
 * Inputs for withdrawing SUI from a gas pool.
 */
export interface ApiGasPoolWithdrawBody {
	/** Wallet submitting the withdrawal. */
	walletAddress: SuiAddress;
	/** Amount of SUI to withdraw, in MIST. */
	amount: Balance;
	/** Wallet that receives the withdrawal. Defaults to `walletAddress`. */
	recipientAddress?: SuiAddress;
	/** When true, the withdrawn coin is not transferred; its arg is returned instead. */
	deferTransfer?: boolean;
	/** Serialized transaction kind to submit when the server builds the transaction. */
	txKind?: SerializedTransaction;
	/** PTB gas-pool argument from an earlier command in the same transaction. */
	gasPoolArg?: TransactionObjectArgument;
}

/**
 * Transaction data returned after withdrawing from a gas pool.
 */
export interface ApiGasPoolWithdrawResponse {
	/** Serialized transaction kind returned by the gas-pool service. */
	txKind: SerializedTransaction;
	/** PTB argument for the withdrawn coin (only set when `deferTransfer = true`). */
	withdrawnCoinArg?: TransactionObjectArgument;
}

// =========================================================================
//  Sponsor
// =========================================================================

/**
 * Inputs for requesting a gas-pool-sponsored transaction.
 */
export interface ApiGasPoolSponsorBody {
	/** Wallet requesting sponsorship. */
	walletAddress: SuiAddress;
	/**
	 * Base64 of the JSON `{"action":"SPONSOR_GAS","date":<unix seconds>}` signed
	 * by `walletAddress`. Proves who is asking, not what for. Reusable for a day
	 * either side of `date`, so sign once and cache it.
	 */
	bytes: string;
	/** `walletAddress`'s signature over `bytes`. */
	signature: string;
	/** Serialized transaction kind to sponsor, when the request includes a transaction. */
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

/**
 * Inputs for granting a wallet access to a gas pool.
 */
export interface ApiGasPoolGrantBody {
	/** Owner wallet authorizing the grant. */
	walletAddress: SuiAddress;
	/** Wallet that receives access to the gas pool. */
	targetWalletAddress: SuiAddress;
	/** Serialized transaction kind to submit when the server builds the transaction. */
	txKind?: SerializedTransaction;
	/** PTB gas-pool argument from an earlier command in the same transaction. */
	gasPoolArg?: TransactionObjectArgument;
}

// =========================================================================
//  Revoke
// =========================================================================

/**
 * Inputs for revoking a wallet's access to a gas pool.
 */
export interface ApiGasPoolRevokeBody {
	/** Owner wallet authorizing the revocation. */
	walletAddress: SuiAddress;
	/** Wallet whose access to the gas pool is revoked. */
	targetWalletAddress: SuiAddress;
	/** Serialized transaction kind to submit when the server builds the transaction. */
	txKind?: SerializedTransaction;
}

// =========================================================================
//  Share
// =========================================================================

/**
 * Inputs for sharing a gas pool after a deferred create operation.
 */
export interface ApiGasPoolShareBody {
	/** PTB gas-pool argument returned by a deferred create operation. */
	gasPoolArg: TransactionObjectArgument;
	/** PTB share-policy argument returned by a deferred create operation. */
	sharePolicyArg: TransactionObjectArgument;
	/** Serialized transaction kind to submit when the server builds the transaction. */
	txKind?: SerializedTransaction;
}
