import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
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

export interface ApiLimitOrdersCreateOrderTransactionBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
	buyCoinType: CoinType;
	customRecipient?: SuiAddress;
	expiryIntervalMs: Timestamp;
	isSponsoredTx?: boolean;
	integratorFee?: LimitOrdersIntegratorFeeData;
	// strategy: LimitOrderStrategy;
	minAmountOut: Balance;
	stopLossPrice: number | undefined;
}

// export type LimitOrderStrategy = {
// 	type: "takeProfitStopLoss";
// 	minAmountOut: Balance;
// 	stopLossPrice: Balance;
// };
// | {
// 		type: "iceberg";
// 		minAmountOut: Balance;
// 		stopLossPrice: Balance;
// 		subOrders: ApiLimitOrdersSubOrdersBody;
//   }
// | {
// 		type: "ladder";
// 		orders: ApiLimitLaddersOrdersBody[];
//   };

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
		timestamp: Timestamp;
		txnDigest: TransactionDigest | undefined;
	};
	finished?: {
		timestamp: Timestamp;
		txnDigest: TransactionDigest;
	};
	expiryTimestampMs: Timestamp;
	status: LimitOrdersOrderStatus | undefined;
	error: string | undefined;
	integratorFee?: LimitOrdersIntegratorFeeData;
	stopLossTrigger: number;
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
