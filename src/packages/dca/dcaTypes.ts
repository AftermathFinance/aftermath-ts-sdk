import { ObjectId, SuiAddress } from "../../types";
import { CoinType, CoinWithAmount } from "../coin/coinTypes";
import {
	Balance,
	Event,
	IFixed,
	Object,
	Timestamp,
	TransactionDigest,
} from "../../general/types/generalTypes";


// =========================================================================
// Helpers
// =========================================================================

export type DcaOrderTrades = DcaOrderTradeObject[];

// =========================================================================
//  Initialize Order (Объекты для пост запроса с клиента в sdk)
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
}

// =========================================================================
//  DCA Order
// =========================================================================

export interface DcaOrderTradeObject {
	allocatedCoin: CoinWithAmount;
	buyCoin: CoinWithAmount;
	buyDate: Timestamp;
	rate: number;
}

export interface DcaOrderOverviewObject {
	allocatedCoin: CoinWithAmount;
	allocatedCoinStartAmount: Balance;
	buyCoin: CoinWithAmount;
	widthrowAmount: Balance;
	progress: number;

	totalDeposited: Balance;
	totalSpent: Balance;
	eachOrderSize: Balance;
	averagePrice: Balance;

	totalOrders: number;
	interval: IFixed;
	ordersRemaining: number;
	created: Timestamp;
	tnxDigest: TransactionDigest
}

export interface DcaOrderObject {
	overview: DcaOrderOverviewObject;
	trades: DcaOrderTrades;
}

export interface DcaOrdersOjbect {
	active: DcaOrderObject[];
	past: DcaOrderObject[];
}

// =========================================================================
//  API (Ивента оповещения от смарт-контракта)
// =========================================================================

export interface DcaCreatedOrderEvent extends Event {
	orderId: ObjectId;
    owner: ObjectId;
	inputValue: Balance;
	inputType: CoinType;
	outputType: CoinType;
	gasValue: Balance;
	frequencyMs: Timestamp;
    allowableDeviationMs: Timestamp;
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
    allowableDeviationMs: Timestamp;
    lastTradeTimestampMs: Timestamp;
    amountPerTrade: Balance;
    maxAllowableSlippageBps: Balance;
    minAmountOut: Balance;
    maxAmountOut: Balance;
    remainingTrades: IFixed;
}

export interface DcaExecutedTradeEvent extends Event {
	orderId: ObjectId;
    owner: ObjectId;
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