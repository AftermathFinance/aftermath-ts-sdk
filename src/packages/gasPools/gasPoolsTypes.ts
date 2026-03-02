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
	txKind?: SerializedTransaction;
}

// =========================================================================
//  Deposit
// =========================================================================

export type ApiGasPoolDepositBody = {
	walletAddress: SuiAddress;
	txKind?: SerializedTransaction;
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
}

// =========================================================================
//  Revoke
// =========================================================================

export interface ApiGasPoolRevokeBody {
	walletAddress: SuiAddress;
	targetWalletAddress: SuiAddress;
	txKind?: SerializedTransaction;
}
