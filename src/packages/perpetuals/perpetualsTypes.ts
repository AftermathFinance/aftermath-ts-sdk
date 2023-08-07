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

export type IFixed = bigint;

// =========================================================================
//  BCS - Binary Canonical Serialization
// =========================================================================

export const bcs = new BCS(getSuiMoveConfig());

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
	maxPendingOrdersPerPosition: bigint;
	nextAccountId: bigint;
}

export interface PerpetualsAccountCapabilityObject extends Object {
	objectId: ObjectId;
	accountId: bigint;
}

export interface AccountStruct {
	collateral: IFixed;
	marketIds: bigint[];
	positions: PerpetualsPosition[];
}

export interface PerpetualsPosition {
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
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

export interface PerpetualsCritBitTree<T> {
	root: bigint;
	innerNodes: TableV<PerpetualsInnerNode>;
	outerNodes: TableV<PerpetualsOuterNode<T>>;
}

export interface TableV<T> {
	contents: Table<number, T>;
}

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

export interface PerpetualsOrder {
	accountId: bigint;
	size: bigint;
}

export interface PerpetualsOrderCasted {
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

// =========================================================================
//  API
// =========================================================================

export function accountFromBcs(bcsBytes: string): AccountStruct {
	const rawAcc = bcs.de("Account", bcsBytes, "base64");
	return accountFromRaw(rawAcc);
}

export function accountFromRaw(data: any): AccountStruct {
	return {
		collateral: BigInt(data.collateral),
		marketIds: data.marketIds.map((id: number) => BigInt(id)),
		positions: data.positions.map((pos: any) => positionFromRaw(pos)),
	};
}

export function positionFromRaw(data: any): PerpetualsPosition {
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
): PerpetualsCritBitTree<T> {
	return {
		root: BigInt(data.root),
		innerNodes: tableVFromRaw<PerpetualsInnerNode>(data.innerNodes),
		outerNodes: tableVFromRaw<PerpetualsOuterNode<T>>(
			data.outerNodes,
		),
	};
}

export function innerNodeFromRaw(data: any): PerpetualsInnerNode {
	return {
		criticalBit: BigInt(data.criticalBit),
		parentIndex: BigInt(data.parentIndex),
		leftChildIndex: BigInt(data.leftChildren),
		rightChildIndex: BigInt(data.rightChildren),
	}
}

export function outerNodeFromRawPartial<T>(
	valueFromRaw: (v: any) => T
): (v: any) => PerpetualsOuterNode<T> {
	return (v: any) => outerNodeFromRaw(v, valueFromRaw);
}

export function outerNodeFromRaw<T>(
	data: any,
	valueFromRaw: (v: any) => T
): PerpetualsOuterNode<T> {
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
