import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Timestamp,
	TransactionDigest,
	Event,
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

export interface ApiLimitOrdersCreateOrderTransactionBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
	buyCoinType: CoinType;
	customRecipient?: SuiAddress;
	expiryDurationMs: number;
	isSponsoredTx?: boolean;
	integratorFee?: LimitOrdersIntegratorFeeData;
	outputToInputExchangeRate: number;
	outputToInputStopLossExchangeRate: number | undefined;
}

export interface ApiLimitOrdersSubOrdersBody {
	orderPrice: Balance;
	ordersAmount: number;
}

// =========================================================================
//  Initialize Ladders Order Transaction
// =========================================================================

export interface ApiLimitLaddersOrdersBody {
	price: Balance;
	quantity: Balance;
}

// =========================================================================
// Cancel Order Transaction
// =========================================================================

export interface ApiLimitOrdersCancelOrderTransactionBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

// =========================================================================
//  Limit Order Fetch
// =========================================================================

export type LimitOrdersOrderStatus =
	| "Active"
	| "Canceled"
	| "Failed"
	| "Filled"
	| "Expired"
	| "StopLossTriggered";

export interface LimitOrderObject {
	objectId: ObjectId;
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	currentAmountSold: Balance;
	currentAmountBought: Balance;
	recipient: SuiAddress;
	created: {
		timestamp: Timestamp;
		txnDigest: TransactionDigest;
	};
	finished?: {
		timestamp: Timestamp;
		txnDigest: TransactionDigest;
	};
	expiryTimestamp: Timestamp;
	status: LimitOrdersOrderStatus;
	error?: string;
	integratorFee?: LimitOrdersIntegratorFeeData;
	outputToInputStopLossExchangeRate?: number;
}

// =========================================================================
//  Owned Limit Orders
// =========================================================================

export interface ApiLimitOrdersPastOrdersOwnedBody {
	walletAddress: SuiAddress;
}

export interface ApiLimitOrdersActiveOrdersOwnedBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

export interface LimitOrdersCreatedOrderEvent extends Event {
	orderId: ObjectId;
	owner: ObjectId;
	recipient: SuiAddress;
	inputType: CoinType;
	inputAmount: Balance;
	outputType: CoinType;
	gasValue: Balance;
	integratorFeeBps: number;
	integratorFeeRecipient: SuiAddress;
	encryptedFields: Uint8Array;
}
