import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Timestamp,
	Event,
	TransactionDigest,
} from "../../general/types/generalTypes";

// =========================================================================
//  Common Types
// =========================================================================

export interface DcaIntegratorFeeData {
	feeBps: number;
	feeRecipient: SuiAddress;
}

export interface DcaOrderStrategyData {
	minPrice: Balance;
	maxPrice: Balance;
}

// =========================================================================
//  Initialize Order Transaction
// =========================================================================

export interface ApiDcaTransactionForCreateOrderBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
	buyCoinType: CoinType;
	frequencyMs: Timestamp;
	tradesAmount: number;
	strategy?: DcaOrderStrategyData;
	isSponsoredTx?: boolean;
	delayTimeMs: Timestamp;
	maxAllowableSlippageBps: number;
	coinPerTradeAmount: Balance;
	customRecipient?: SuiAddress;
	integratorFee?: DcaIntegratorFeeData;
}

// =========================================================================
// Close Order Transaction
// =========================================================================

export interface ApiDcaTransactionForCloseOrderBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

// =========================================================================
// Manual Close Order Transaction
// =========================================================================

export type ApiDcaManualCloseOrderBody = {
	walletAddress: SuiAddress;
	buyCoinType: CoinType;
	allocateCoinType: CoinType;
	orderId: SuiAddress;
};

// =========================================================================
//  DCA Order Fetch
// =========================================================================

export type DcaFailedTradeReason =
	| "INTERNAL"
	| "STRATEGY"
	| "GAS_CAP"
	| "UNKNOWN_USER"
	| "SLIPPAGE";

export interface DcaOrderTradeObject {
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	txnDigest: TransactionDigest;
	txnTimestamp: Timestamp;
	rate: number | undefined;
}

export interface DcaOrderFailedTradeObject {
	timestamp: number;
	reason: DcaFailedTradeReason | undefined;
}

export interface DcaOrderOverviewObject {
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	totalSpent: Balance;
	intervalMs: Timestamp;
	totalTrades: number;
	tradesRemaining: number;
	maxSlippageBps: number;
	strategy?: DcaOrderStrategyData;
	recipient: SuiAddress;
	progress: number;
	created: {
		/** @deprecated use timestamp instead */
		time: Timestamp;
		timestamp: Timestamp;

		/** @deprecated use txnDigest instead */
		tnxDigest: TransactionDigest;
		txnDigest: TransactionDigest;
	};
	nextTrade?: {
		/** @deprecated use timestamp instead */
		time: Timestamp;
		timestamp: Timestamp;

		/** @deprecated use txnDigest instead */
		tnxDigest: TransactionDigest;
		txnDigest: TransactionDigest;
	};
	lastExecutedTrade?: {
		/** @deprecated use timestamp instead */
		time: Timestamp;
		timestamp: Timestamp;

		/** @deprecated use txnDigest instead */
		tnxDigest: TransactionDigest;
		txnDigest: TransactionDigest;
	};
	integratorFee?: DcaIntegratorFeeData;
}

export interface DcaOrderObject {
	objectId: ObjectId;
	overview: DcaOrderOverviewObject;
	trades: DcaOrderTradeObject[];
	failed: DcaOrderFailedTradeObject[];
}

export interface DcaOrdersObject {
	active: DcaOrderObject[];
	past: DcaOrderObject[];
}

// =========================================================================
// User Fetch
// =========================================================================

export interface ApiDcaCreateUserBody {
	walletAddress: SuiAddress;
	bytes: string;
	signature: string;
}

// =========================================================================
//  Owned DCAs
// =========================================================================

export interface ApiDCAsOwnedBody {
	walletAddress: SuiAddress;
}

// =========================================================================
//  DCA Events
// =========================================================================

export interface DcaCreatedOrderEvent extends Event {
	orderId: ObjectId;
	owner: ObjectId;
	inputValue: Balance;
	inputType: CoinType;
	outputType: CoinType;
	gasValue: Balance;
	frequencyMs: Timestamp;
	startTimestampMs: Timestamp;
	amountPerTrade: Balance;
	maxAllowableSlippageBps: Balance;
	minAmountOut: Balance;
	maxAmountOut: Balance;
	remainingTrades: bigint;
	recipient: SuiAddress;
}

export interface DcaClosedOrderEvent extends Event {
	orderId: ObjectId;
	owner: ObjectId;
	remainingValue: Balance;
	inputType: CoinType;
	outputType: CoinType;
	gasValue: Balance;
	frequencyMs: Timestamp;
	lastTradeTimestampMs: Timestamp;
	amountPerTrade: Balance;
	maxAllowableSlippageBps: Balance;
	minAmountOut: Balance;
	maxAmountOut: Balance;
	remainingTrades: bigint;
}

export interface DcaExecutedTradeEvent extends Event {
	orderId: ObjectId;
	user: ObjectId;
	inputType: CoinType;
	inputAmount: Balance;
	outputType: CoinType;
	outputAmount: Balance;
}
