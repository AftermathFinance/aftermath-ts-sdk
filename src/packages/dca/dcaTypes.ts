import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Event,
	IFixed,
	Timestamp,
	TransactionDigest
} from "../../general/types/generalTypes";


// =========================================================================
// Helpers
// =========================================================================

export type DcaOrderTrades = DcaOrderTradeObject[];

// =========================================================================
//  Initialize Order 
// =========================================================================

export interface ApiDcaInitializeOrdertStrategyBody {
    priceMin: Balance;
    priceMax: Balance;
}

export interface ApiDcaInitializeOrderBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
    buyCoinType: CoinType;
	frequencyMs: Timestamp;
	tradesAmount: number;
    straregy?: ApiDcaInitializeOrdertStrategyBody;
	isSponsoredTx?: boolean;
	delayTimeMs: Timestamp;
	maxAllowableSlippageBps: Balance;
	coinPerTradeAmount: Balance;
	publicKey: Uint8Array;
	customRecipient?: SuiAddress;
}

export interface ApiDcaCancelOrderBody {
	walletAddress: SuiAddress;
    buyCoinType: CoinType;
	allocateCoinType: CoinType;
	orderId: SuiAddress;
}

// =========================================================================
//  DCA Order
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
	rate: number;
}

export interface DcaOrdertStrategyObject {
    priceMin: Balance;
    priceMax: Balance;
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

	interval: IFixed;
	totalTrades: number;
	tradesRemaining: number;
	maxSlippage: Balance;
	strategy?: DcaOrdertStrategyObject;

	progress: number;
	created: {
		time: Timestamp | undefined;
		tnxDigest: TransactionDigest;
	};
	started?: {
		time: Timestamp | undefined;
		tnxDigest: TransactionDigest;
	};
	lastExecutedTradeTime?: {
		time: Timestamp | undefined;
		tnxDigest: TransactionDigest;
	};
}

export interface DcaOrderObject {
	objectId: ObjectId;
	overview: DcaOrderOverviewObject;
	trades: DcaOrderTrades;
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
    remainingTrades: IFixed;
}

export interface DcaCancelledOrderEvent extends Event {
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
    remainingTrades: IFixed;
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
//  Owned DCAs
// =========================================================================

export interface ApiDCAsOwnedBody {
	walletAddress: SuiAddress;
}