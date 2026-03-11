import {
	Balance,
	ObjectId,
	SerializedTransaction,
	SuiAddress,
} from "../../general/types/generalTypes";
import { TransactionObjectArgument } from "@mysten/sui/transactions";

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

export type ApiGasPoolDepositBody = {
	walletAddress: SuiAddress;
	txKind?: SerializedTransaction;
	gasPoolArg?: TransactionObjectArgument;
} & (
	| {
			depositCoinArg: TransactionObjectArgument;
	  }
	| {
			depositAmount: Balance;
	  }
);

// =========================================================================
//  Withdraw
// =========================================================================

export interface ApiGasPoolWithdrawBody {
	walletAddress: SuiAddress;
	amount: Balance;
	recipientAddress?: SuiAddress;
	txKind?: SerializedTransaction;
}

// =========================================================================
//  Sponsor
// =========================================================================

export interface ApiGasPoolSponsorBody {
	walletAddress: SuiAddress;
	amount: Balance;
	txKind?: SerializedTransaction;
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
