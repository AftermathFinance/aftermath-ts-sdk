import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	AnyObjectType,
	Balance,
	Object,
	Timestamp,
} from "../../general/types/generalTypes";

export type IFixed = bigint;

// =========================================================================
//  Clearing House
// =========================================================================

export interface PerpetualsAdminCapabilityObject extends Object {
	objectId: ObjectId;
}

export interface PerpetualsRegistryObject extends Object {
	activeCollaterals: string[];
}

export interface PerpetualsInsuranceFundObject extends Object {
	balance: Balance;
}

export interface PerpetualsVaultObject extends Object {
	balance: Balance;
}

// =========================================================================
//  Account Manager
// =========================================================================

export interface PerpetualsAccountManagerObject extends Object {
	maxPositionsPerAccount: bigint;
	maxOpenOrdersPerPosition: bigint;
}

export interface PerpetualsAccountStruct {
	collateral: IFixed;
	marketIds: bigint[];
	positions: PerpetualsPosition[];
	isBeingLiquidated: boolean;
}

export interface PerpetualsPosition {
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	lastCumFunding: IFixed;
	asks: PerpetualsCritBitTree<bigint>;
	bids: PerpetualsCritBitTree<bigint>;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

// =========================================================================
//  Market Manager
// =========================================================================

export interface PerpetualsMarketManagerObject extends Object {
	feesAccrued: IFixed;
	netTransferFromIfToVault: IFixed;
	minOrderUsdValue: IFixed;
	marketIds: bigint[];
}

export interface PerpetualsMarketParams {
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
	baseAssetSymbol: string;
	fundingFrequencyMs: bigint;
	fundingPeriodMs: bigint;
	twapPeriodMs: bigint;
	makerFee: IFixed;
	takerFee: IFixed;
	liquidationFee: IFixed;
	forceCancelFee: IFixed;
	insuranceFundFee: IFixed;
	priceImpactFactor: IFixed;
}

export interface PerpetualsMarketState {
	cumulativeFundingRate: IFixed;
	fundingRateTimestamp: Timestamp;
	lastIndexPrice: IFixed;
	lastIndexTwap: IFixed;
	lastIndexTimestamp: Timestamp;
	lastMarkPrice: IFixed;
	lastMarkTwap: IFixed;
	lastMarkTimestamp: Timestamp;
	openInterest: IFixed;
}

export interface PerpetualsMarginRatioProposal {
	maturity: bigint;
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
}

export interface PerpetualsMarketManagerDynamicFields {
	paramsFields: PerpetualsMarketParamsDynamicField[];
	stateFields: PerpetualsMarketStateDynamicField[];
	orderbookFields: PerpetualsMarketOrderbookDynamicFieldObject[];
}

export interface PerpetualsMarketParamsDynamicField {
	value: PerpetualsMarketParams;
}

export interface PerpetualsMarketStateDynamicField {
	value: PerpetualsMarketState;
}

export interface PerpetualsMarketOrderbookDynamicFieldObject extends Object {
	value: PerpetualsOrderbookObject;
}

export interface PerpetualsMarketManagerDynamicFieldOnChain {
	data: {
		fields: any;
		type: AnyObjectType;
	};
}

interface PerpetualsMarketParamsDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: PerpetualsMarketParams;
		};
	};
}

export interface PerpetualsMarketParamsDynamicFieldOnChain {
	data: {
		fields: PerpetualsMarketParamsDynamicFieldFieldOnChain;
	};
}

interface PerpetualsMarketStateDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: PerpetualsMarketState;
		};
	};
}

export interface PerpetualsMarketManagerStateDynamicFieldOnChain {
	data: {
		fields: PerpetualsMarketStateDynamicFieldFieldOnChain;
	};
}

interface PerpetualsMarketOrderbookDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: PerpetualsOrderbookObject;
		};
	};
}

export interface PerpetualsMarketOrderbookDynamicFieldOnChain {
	data: {
		fields: PerpetualsMarketOrderbookDynamicFieldFieldOnChain;
	};
}

// =========================================================================
//  Orderbook
// =========================================================================

export interface PerpetualsInnerNode {
	criticalBit: bigint;
	parentIndex: bigint;
	leftChildIndex: bigint;
	rightChildIndex: bigint;
}

export interface PerpetualsOuterNode<T> {
	key: IFixed;
	value: T;
	parentIndex: bigint;
}

export interface PerpetualsCritBitTree<T> {
	root: bigint;
	innerNode: PerpetualsInnerNode[];
	outerNode: PerpetualsOuterNode<T>[];
}

export interface PerpetualsOrder {
	user: SuiAddress;
	accountId: bigint;
	size: bigint;
}

export interface PerpetualsOrderCasted {
	user: SuiAddress;
	accountId: bigint;
	size: bigint;
	price: bigint;
	counter: bigint;
}

export interface PerpetualsOrderbookObject extends Object {
	lotSize: bigint;
	tickSize: bigint;
	asks: PerpetualsCritBitTree<PerpetualsOrder>;
	bids: PerpetualsCritBitTree<PerpetualsOrder>;
	minAsk: bigint;
	minBid: bigint;
	counter: bigint;
}

// =========================================================================
//  Oracle
// =========================================================================

export interface PerpetualsPriceFeedObject extends Object {
	symbol: string;
	price: IFixed;
	decimal: bigint;
	timestamp: Timestamp;
}

export interface PerpetualsPriceFeedStorageObject extends Object {}

export interface PerpetualsAuthorityCapObject extends Object {}
