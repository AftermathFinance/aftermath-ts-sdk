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

export interface LimitIntegratorFeeData {
	feeBps: number;
	feeRecipient: SuiAddress;
}

// =========================================================================
//  Initialize Order Transaction
// =========================================================================

export interface ApiLimitTransactionForCreateOrderBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
	buyCoinType: CoinType;
	minAmountOut: Balance;
	customRecipient?: SuiAddress;
	expiryTimestampMs: Timestamp;
	isSponsoredTx?: boolean;
	integratorFee?: LimitIntegratorFeeData;
}

// =========================================================================
// Cancel Order Transaction
// =========================================================================

export interface ApiLimitTransactionForCancelOrderBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

// =========================================================================
//  Limit Order Fetch
// =========================================================================

export type LimitIndexerOrderStatus =
	| "Active"
	| "Canceled"
	| "Failed"
	| "Filled"
	| "Expired";

export interface LimitOrdersObject {
	active: LimitOrderObject[];
	executed: LimitOrderObject[];
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
	recipient?: SuiAddress;
	created: {
		time: Timestamp;
		tnxDigest: TransactionDigest | undefined;
	};
	finish?: {
		time: Timestamp;
		tnxDigest: TransactionDigest;
	};
	expiry: Timestamp;
	status: LimitIndexerOrderStatus | undefined;
	error: string | undefined;
	integratorFee?: LimitIntegratorFeeData;
}

// =========================================================================
//  DCA Events
// =========================================================================

export interface LimitCreatedOrderEvent extends Event {
	orderId: ObjectId;
	user: ObjectId;
	userPublicKey: Uint8Array;
	recipient: SuiAddress;
	inputAmount: Balance;
	inputType: CoinType;
	outputType: CoinType;
	gasAmount: Balance;
	encryptedFields: Uint8Array;
}

// =========================================================================
//  Owned DCAs
// =========================================================================

export interface ApiLimitsOwnedBody {
	walletAddress: SuiAddress;
}

export interface ApiLimitsActiveOrdersOwnedBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}
