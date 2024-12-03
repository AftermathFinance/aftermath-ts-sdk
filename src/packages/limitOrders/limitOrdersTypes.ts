import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Event,
	Timestamp,
	TransactionDigest,
} from "../../general/types/generalTypes";

// =========================================================================
//  Common Types
// =========================================================================

export interface LimitOrdersIntegratorFeeData {
	feeBps: number;
	feeRecipient: SuiAddress;
}

// =========================================================================
//  Initialize Order Transaction
// =========================================================================

export interface ApiLimitOrdersTransactionForCreateOrderBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
	buyCoinType: CoinType;
	minAmountOut: Balance;
	customRecipient?: SuiAddress;
	expiryTimestampMs: Timestamp;
	isSponsoredTx?: boolean;
	integratorFee?: LimitOrdersIntegratorFeeData;
}

// =========================================================================
// Cancel Order Transaction
// =========================================================================

export interface ApiLimitOrdersTransactionForCancelOrderBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

// =========================================================================
//  Limit Order Fetch
// =========================================================================

export type LimitOrdersIndexerOrderStatus =
	| "Active"
	| "Canceled"
	| "Failed"
	| "Filled"
	| "Expired";

export interface LimitOrdersObject {
	active: LimitOrderObject[];
	past: LimitOrderObject[];
}

export interface LimitOrderObject {
	objectId: ObjectId | undefined;
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	actualAmountSold: Balance;
	actualAmountBought: Balance;
	recipient: SuiAddress;
	created: {
		time: Timestamp;
		tnxDigest: TransactionDigest | undefined;
	};
	finish?: {
		time: Timestamp;
		tnxDigest: TransactionDigest;
	};
	expiry: Timestamp;
	status: LimitOrdersIndexerOrderStatus | undefined;
	error: string | undefined;
	integratorFee?: LimitOrdersIntegratorFeeData;
}

// =========================================================================
//  Limit Orders Events
// =========================================================================

export interface LimitOrdersCreatedOrderEvent extends Event {
	orderId: ObjectId;
	user: SuiAddress;
	userPublicKey: Uint8Array;
	recipient: SuiAddress;
	inputAmount: Balance;
	inputType: CoinType;
	outputType: CoinType;
	gasAmount: Balance;
	encryptedFields: Uint8Array;
}

// =========================================================================
//  Owned Limit Orders
// =========================================================================

export interface ApiLimitOrdersOwnedBody {
	walletAddress: SuiAddress;
}

export interface ApiLimitOrdersActiveOrdersOwnedBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}
