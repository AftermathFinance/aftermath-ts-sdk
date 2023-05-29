import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
    AnyObjectType,
	Balance,
    Timestamp
} from "../../general/types/generalTypes";
import BN from "bn.js";

export type IFixed = BN;

// =========================================================================
//  Clearing House
// =========================================================================
export interface AdminCapability {
	objectId: ObjectId,
}

export interface Registry {
	objectId: ObjectId,
	activeCollaterals: string[],
}

export interface InsuranceFund {
	objectId: ObjectId,
	balance: Balance,
}

export interface Vault {
	objectId: ObjectId,
	balance: Balance,
}

// =========================================================================
//  Account Manager
// =========================================================================
export interface AccountManager {
    objectId: ObjectId,
    maxPositionsPerAccount: bigint,
    maxOpenOrdersPerPosition: bigint,
}

export interface Account {
    objectId: ObjectId,
    collateral: IFixed,
    marketIds: bigint[],
    positions: Position[],
    isBeingLiquidated: boolean
}

export interface Position {
    baseAssetAmount: IFixed,
    quoteAssetNotionalAmount: IFixed,
    lastCumFunding: IFixed,
    asks: CritBitTree<bigint>,
    bids: CritBitTree<bigint>,
    asksQuantity: IFixed,
    bidsQuantity: IFixed,
}

// =========================================================================
//  Market Manager
// =========================================================================
export interface MarketManager {
    objectId: ObjectId,
    feesAccrued: IFixed,
    netTransferFromIfToVault: IFixed,
    minOrderUsdValue: IFixed,
    marketIds: bigint[]
}

export interface MarketParams {
    marginRatioInitial: IFixed
    marginRatioMaintenance: IFixed,
    baseAssetSymbol: string,
    fundingFrequencyMs: bigint,
    fundingPeriodMs: bigint,
    twapPeriodMs: bigint,
    makerFee: IFixed,
    takerFee: IFixed,
    liquidationFee: IFixed,
    forceCancelFee: IFixed,
    insuranceFundFee: IFixed,
    priceImpactFactor: IFixed,
}

export interface MarketState {
    cumulativeFundingRate: IFixed,
    fundingRateTimestamp: Timestamp,
    lastIndexPrice: IFixed,
    lastIndexTwap: IFixed,
    lastIndexTimestamp: Timestamp,
    lastMarkPrice: IFixed,
    lastMarkTwap: IFixed,
    lastMarkTimestamp: Timestamp,
    openInterest: IFixed
}

export interface MarginRatioProposal {
    maturity: bigint,
    marginRatioInitial: IFixed
    marginRatioMaintenance: IFixed,
}

export interface MarketManagerDynamicFields {
	paramsFields: MarketManagerParamsDynamicField[];
	stateFields: MarketManagerStateDynamicField[];
	orderbookFields: MarketManagerOrderbookDynamicField[];
}

export interface MarketManagerParamsDynamicField {
	objectId: ObjectId;
	value: MarketParams;
}

export interface MarketManagerStateDynamicField {
	objectId: ObjectId;
	value: MarketState;
}

export interface MarketManagerOrderbookDynamicField {
	objectId: ObjectId;
	value: Orderbook;
}

export interface MarketManagerDynamicFieldOnChain {
	data: {
		fields: any;
		type: AnyObjectType;
	};
}

interface MarketManagerParamsDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: MarketParams;
		};
	};
}

export interface MarketManagerParamsDynamicFieldOnChain {
	data: {
		fields: MarketManagerParamsDynamicFieldFieldOnChain;
	};
}

interface MarketManagerStateDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: MarketState;
		};
	};
}

export interface MarketManagerStateDynamicFieldOnChain {
	data: {
		fields: MarketManagerStateDynamicFieldFieldOnChain;
	};
}

interface MarketManagerOrderbookDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: Orderbook;
		};
	};
}

export interface MarketManagerOrderbookDynamicFieldOnChain {
	data: {
		fields: MarketManagerOrderbookDynamicFieldFieldOnChain;
	};
}

// =========================================================================
//  Orderbook
// =========================================================================
export interface InnerNode {
    criticalBit: bigint,
    parentIndex: bigint,
    leftChildIndex: bigint,
    rightChildIndex: bigint,
}

export interface OuterNode<T> {
    key: IFixed,
    value: T,
    parentIndex: bigint,
}

export interface CritBitTree<T> {
    root: bigint,
    innerNode: InnerNode[],
    outerNode: OuterNode<T>[],
}

export interface Order {
    user: SuiAddress,
	accountId: bigint,
	size: bigint,
}

export interface OrderCasted {
	user: SuiAddress;
	accountId: bigint;
	size: bigint;
	price: bigint;
	counter: bigint;
}

export interface Orderbook {
    objectId: ObjectId,
    lotSize: bigint,
    tickSize: bigint,
    asks: CritBitTree<Order>,
    bids: CritBitTree<Order>,
	minAsk: bigint,
	minBid: bigint,
    counter: bigint,
}

// =========================================================================
//  Oracle
// =========================================================================
export interface PriceFeed {
    objectId: ObjectId,
    symbol: string,
    price: IFixed,
    decimal: bigint,
    timestamp: Timestamp
}

export interface PriceFeedStorage {
    objectId: ObjectId,
}

export interface AuthorityCap {
    objectId: ObjectId,
}