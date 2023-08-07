import { BCS, getSuiMoveConfig } from "@mysten/bcs";
import { ObjectId } from "@mysten/sui.js";
import {
	AnyObjectType,
	Balance,
	Object,
	Timestamp,
} from "../../general/types/generalTypes";
import { Table } from "../../general/types/suiTypes";
import { CoinType } from "../coin/coinTypes";
import { IFixed } from "../utilities/types";

// =========================================================================
//  BCS - Binary Canonical Serialization
// =========================================================================

export const bcs = new BCS(getSuiMoveConfig());

bcs.registerStructType("AccountManager", {
	id: "UID",
	maxPositionsPerAccount: BCS.U64,
	maxPendingOrdersPerPosition: BCS.U64,
	nextAccountId: BCS.U64,
});

bcs.registerStructType("MarketManager", {
	id: "UID",
	feesAccrued: BCS.U256,
	minOrderUsdValue: BCS.U256,
	liquidationTolerance: BCS.U256,
})

bcs.registerStructType("AccountCap", {
	id: "UID",
	accountId: BCS.U64,
});

bcs.registerStructType("Account", {
	collateral: BCS.U256,
	marketIds: ['vector', BCS.U64],
	positions: ['vector', "Position"],
});


bcs.registerStructType("Position", {
	baseAssetAmount: BCS.U256,
	quoteAssetNotionalAmount: BCS.U256,
	cumFundingRateLong: BCS.U256,
	cumFundingRateShort: BCS.U256,
	asks: ["CritBitTree", BCS.U64],
	bids: ["CritBitTree", BCS.U64],
	asksQuantity: BCS.U256,
	bidsQuantity: BCS.U256,

});

bcs.registerStructType(["CritBitTree", "T"], {
	root: BCS.U64,
	innerNodes: ["TableV", "InnerNode"],
	outerNodes: ["TableV", ["OuterNode", "T"]],
});

bcs.registerStructType(["TableV", "T"], {
	contents: ["Table", BCS.U64, "T"],
});

bcs.registerStructType(["Table", "K", "V"], {
	id: "UID",
	size: BCS.U64,
});

bcs.registerStructType("InnerNode", {
	criticalBit: BCS.U8,
	parentIndex: BCS.U64,
	leftChildIndex: BCS.U64,
	rightChildIndex: BCS.U64,
});

bcs.registerStructType(["OuterNode", "T"], {
	key: BCS.U128,
	value: "T",
	parentIndex: BCS.U64,
});

bcs.registerStructType(["Field", "N", "V"], {
	id: "UID",
	name: "N",
	value: "V",
});

bcs.registerAlias('UID', BCS.ADDRESS);

// =========================================================================
//  Clearing House
// =========================================================================

export interface AdminCapability extends Object {
	objectId: ObjectId;
}

export interface Registry extends Object {
	activeCollaterals: string[];
}

export interface InsuranceFunds extends Object {
	balance: Balance;
}

export interface Vault extends Object {
	balance: Balance;
}

// =========================================================================
//  Account Manager
// =========================================================================

export interface AccountManagerObj extends Object {
	maxPositionsPerAccount: bigint;
	maxPendingOrdersPerPosition: bigint;
	nextAccountId: bigint;
}

export interface AccountManager {
	id: ObjectId;
	maxPositionsPerAccount: bigint;
	maxPendingOrdersPerPosition: bigint;
	nextAccountId: bigint;
}

export interface AccountCapability extends Object {
	objectId: ObjectId;
	accountId: bigint;
}

export interface AccountStruct {
	collateral: IFixed;
	marketIds: bigint[];
	positions: Position[];
}

export interface Position {
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	asks: CritBitTree<bigint>;
	bids: CritBitTree<bigint>;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

// =========================================================================
//  Market Manager
// =========================================================================

export interface MarketManagerObj extends Object {
	feesAccrued: IFixed;
	netTransferFromIfToVault: IFixed;
	minOrderUsdValue: IFixed;
	marketIds: bigint[];
}

export interface MarketManager {
	id: ObjectId;
	feesAccrued: IFixed;
	minOrderUsdValue: IFixed;
	liquidationTolerance: IFixed;
}

export interface MarketParams {
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

export interface MarketState {
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

export interface MarginRatioProposal {
	maturity: bigint;
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
}

export interface MarketManagerDynamicFields {
	paramsFields: MarketParamsDynamicField[];
	stateFields: MarketStateDynamicField[];
	orderbookFields: MarketOrderbookDynamicFieldObject[];
}

export interface MarketParamsDynamicField {
	value: MarketParams;
}

export interface MarketStateDynamicField {
	value: MarketState;
}

export interface MarketOrderbookDynamicFieldObject extends Object {
	value: Orderbook;
}

export interface MarketManagerDynamicFieldOnChain {
	data: {
		fields: any;
		type: AnyObjectType;
	};
}

interface MarketParamsDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: MarketParams;
		};
	};
}

export interface MarketParamsDynamicFieldOnChain {
	data: {
		fields: MarketParamsDynamicFieldFieldOnChain;
	};
}

interface MarketStateDynamicFieldFieldOnChain {
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
		fields: MarketStateDynamicFieldFieldOnChain;
	};
}

interface MarketOrderbookDynamicFieldFieldOnChain {
	id: {
		id: ObjectId;
	};
	value: {
		fields: {
			value: Orderbook;
		};
	};
}

export interface MarketOrderbookDynamicFieldOnChain {
	data: {
		fields: MarketOrderbookDynamicFieldFieldOnChain;
	};
}

// =========================================================================
//  Orderbook
// =========================================================================

export interface CritBitTree<T> {
	root: bigint;
	innerNodes: TableV<InnerNode>;
	outerNodes: TableV<OuterNode<T>>;
}

export interface TableV<T> {
	contents: Table<number, T>;
}

export interface InnerNode {
	criticalBit: bigint;
	parentIndex: bigint;
	leftChildIndex: bigint;
	rightChildIndex: bigint;
}

export interface OuterNode<T> {
	key: IFixed;
	value: T;
	parentIndex: bigint;
}

export interface Order {
	accountId: bigint;
	size: bigint;
}

export interface OrderCasted {
	accountId: bigint;
	size: bigint;
	price: bigint;
	counter: bigint;
}

export interface Orderbook extends Object {
	lotSize: bigint;
	tickSize: bigint;
	asks: CritBitTree<Order>;
	bids: CritBitTree<Order>;
	minAsk: bigint;
	minBid: bigint;
	counter: bigint;
}

// =========================================================================
//  Types from raw deserialized BCS
// =========================================================================

export function accountManagerFromRaw(data: any): AccountManager {
	return {
		id: data.id,
		maxPositionsPerAccount: BigInt(data.maxPositionsPerAccount),
		maxPendingOrdersPerPosition: BigInt(data.maxPendingOrdersPerPosition),
		nextAccountId: BigInt(data.nextAccountId),
	};
}

export function marketManagerFromRaw(data: any): MarketManager {
	return {
		id: data.id,
		feesAccrued: BigInt(data.feesAccrued),
		minOrderUsdValue: BigInt(data.minOrderUsdValue),
		liquidationTolerance: BigInt(data.liquidationTolerance),
	}
}

export function accountFromRaw(data: any): AccountStruct {
	return {
		collateral: BigInt(data.collateral),
		marketIds: data.marketIds.map((id: number) => BigInt(id)),
		positions: data.positions.map((pos: any) => positionFromRaw(pos)),
	};
}

export function positionFromRaw(data: any): Position {
	return {
		baseAssetAmount: BigInt(data.baseAssetAmount),
		quoteAssetNotionalAmount: BigInt(data.quoteAssetNotionalAmount),
		cumFundingRateLong: BigInt(data.cumFundingRateLong),
		cumFundingRateShort: BigInt(data.cumFundingRateShort),
		asks: critBitTreeFromRaw<bigint>(data.asks),
		bids: critBitTreeFromRaw<bigint>(data.bids),
		asksQuantity: BigInt(data.asksQuantity),
		bidsQuantity: BigInt(data.bidsQuantity),
	}
}

export function critBitTreeFromRaw<T>(
	data: any,
): CritBitTree<T> {
	return {
		root: BigInt(data.root),
		innerNodes: tableVFromRaw<InnerNode>(data.innerNodes),
		outerNodes: tableVFromRaw<OuterNode<T>>(
			data.outerNodes,
		),
	};
}

export function innerNodeFromRaw(data: any): InnerNode {
	return {
		criticalBit: BigInt(data.criticalBit),
		parentIndex: BigInt(data.parentIndex),
		leftChildIndex: BigInt(data.leftChildren),
		rightChildIndex: BigInt(data.rightChildren),
	}
}

export function outerNodeFromRawPartial<T>(
	valueFromRaw: (v: any) => T
): (v: any) => OuterNode<T> {
	return (v: any) => outerNodeFromRaw(v, valueFromRaw);
}

export function outerNodeFromRaw<T>(
	data: any,
	valueFromRaw: (v: any) => T
): OuterNode<T> {
	return {
		key: BigInt(data.key),
		value: valueFromRaw(data.value),
		parentIndex: BigInt(data.parentIndex),
	}
}

export function tableVFromRaw<T>(
	data: any,
): TableV<T> {
	return {
		contents: tableFromRaw<number, T>(data.contents),
	};
}

export function tableFromRaw<K, V>(data: any): Table<K, V> {
	return {
		objectId: data.id,
		size: data.size,
	};
}

// =========================================================================
//  Transactions
// =========================================================================

export interface ApiPerpetualsCreateAccountBody {
	coinType: CoinType;
}

// =========================================================================
//  Account Txs
// =========================================================================

// =========================================================================
//  Collateral Txs
// =========================================================================

export interface ApiPerpetualsDepositCollateralBody {
	coinType: CoinType;
	coinAmount: bigint;
}

export interface ApiPerpetualsWithdrawCollateralBody {
	coinType: CoinType;
	amount: bigint;
}

// =========================================================================
//  Order Txs
// =========================================================================

export interface ApiPerpetualsMarketOrderBody {
	coinType: CoinType;
	marketId: bigint;
	side: boolean;
	size: bigint;
}

export interface ApiPerpetualsLimitOrderBody {
	coinType: CoinType;
	marketId: bigint;
	side: boolean;
	size: bigint;
	price: bigint;
	orderType: bigint;
}

export interface ApiPerpetualsCancelOrderBody {
	coinType: CoinType;
	marketId: bigint;
	side: boolean;
	orderId: bigint;
}

// =========================================================================
//  Position Txs
// =========================================================================

export interface ApiPerpetualsClosePositionBody {
	coinType: CoinType;
	marketId: bigint;
}
