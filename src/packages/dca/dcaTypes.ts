import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Event,
	Timestamp,
	TransactionDigest,
} from "../../general/types/generalTypes";

// =========================================================================
//  Initialize Order Transaction
// =========================================================================

export interface ApiDcaInitializeOrdertStrategyBody {
	minPrice: Balance;
	maxPrice: Balance;
}

export interface ApiDcaTransactionForCreateOrderBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
	buyCoinType: CoinType;
	frequencyMs: Timestamp;
	tradesAmount: number;
	strategy?: ApiDcaInitializeOrdertStrategyBody;
	isSponsoredTx?: boolean;
	delayTimeMs: Timestamp;
	maxAllowableSlippageBps: number;
	coinPerTradeAmount: Balance;
	customRecipient?: SuiAddress;
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
//  DCA Order Fetch
// =========================================================================

export interface DcaOrderTradeObject {
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	tnxDigest: TransactionDigest;
	tnxDate: Timestamp;
	rate: number | undefined;
}

export interface DcaOrdertStrategyObject {
	minPrice: Balance;
	maxPrice: Balance;
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
	averagePrice: Balance;
	totalSpent: Balance;
	intervalMs: Timestamp;
	totalTrades: number;
	tradesRemaining: number;
	maxSlippageBps: number;
	strategy?: DcaOrdertStrategyObject;
	recipient?: SuiAddress;
	progress: number;
	created: {
		time: Timestamp;
		tnxDigest: TransactionDigest;
	};
	nextTrade: {
		time: Timestamp;
		tnxDigest: TransactionDigest;
	};
	lastExecutedTrade?: {
		time: Timestamp;
		tnxDigest: TransactionDigest;
	};
}

export interface DcaOrderObject {
	objectId: ObjectId;
	overview: DcaOrderOverviewObject;
	trades: DcaOrderTradeObject[];
}

export interface DcaOrdersObject {
	active: DcaOrderObject[];
	past: DcaOrderObject[];
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
