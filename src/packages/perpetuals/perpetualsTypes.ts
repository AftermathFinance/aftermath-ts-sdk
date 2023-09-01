import { BCS, getSuiMoveConfig } from "@mysten/bcs";
import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	AnyObjectType,
	Balance,
	IFixed,
	Object,
	Timestamp,
} from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Name Only
// =========================================================================

export type PerpetualsMarketId = bigint;
export type PerpetualsAccountId = bigint;
export type PerpetualsOrderId = bigint;

// =========================================================================
//  BCS - Binary Canonical Serialization
// =========================================================================

export const bcs = new BCS(getSuiMoveConfig());

bcs.registerStructType(["Field", "N", "V"], {
	id: "UID",
	name: "N",
	value: "V",
});

bcs.registerAlias("UID", BCS.ADDRESS);

// =========================================================================
//  Clearing House
// =========================================================================

export interface PerpetualsAdminCapability extends Object {}

bcs.registerStructType("AdminCapability", {
	id: "UID",
});

export interface PerpetualsRegistry extends Object {
	activeCollaterals: CoinType[];
}

bcs.registerStructType("Registry", {
	id: "UID",
	activeCollaterals: ["vector", BCS.STRING],
});

export interface PerpetualsVault extends Object {
	balance: Balance;
	scalingFactor: bigint;
}

bcs.registerStructType(["Vault", "T"], {
	id: "UID",
	balance: ["Balance", "T"],
	scalingFactor: BCS.U64,
});

// export interface InsuranceFunds extends Object {
// 	balances: Balance[];
// 	scaling_factor: bigint;
// }

// TODO: how to register vector<Balance<T>>?
// bcs.registerStructType(["InsuranceFunds", "T"], {
// 	id: "UID",
// 	balances: ["vector", "Balance", "T"],
// 	scalingFactor: BCS.U64,
// });

// =========================================================================
//  Account Manager
// =========================================================================

export interface PerpetualsAccountData {
	accountCap: PerpetualsAccountCap;
	account: PerpetualsAccountObject;
}

export interface PerpetualsAccountManager extends Object {
	maxPositionsPerAccount: bigint;
	maxPendingOrdersPerPosition: bigint;
	nextAccountId: PerpetualsAccountId;
}

bcs.registerStructType("AccountManager", {
	id: "UID",
	maxPositionsPerAccount: BCS.U64,
	maxPendingOrdersPerPosition: BCS.U64,
	nextAccountId: BCS.U64,
});

export interface PerpetualsAccountCap extends Object {
	accountId: PerpetualsAccountId;
	coinType: CoinType;
}

bcs.registerStructType("AccountCap", {
	id: "UID",
	accountId: BCS.U64,
});

export interface PerpetualsAccountObject {
	collateral: IFixed;
	positions: PerpetualsPosition[];
}

bcs.registerStructType("Account", {
	collateral: BCS.U256,
	marketIds: ["vector", BCS.U64],
	positions: ["vector", "Position"],
});

export interface PerpetualsPosition {
	marketId: PerpetualsMarketId;
	baseAssetAmount: IFixed;
	quoteAssetNotionalAmount: IFixed;
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	asks: PerpetualsOrderedVecSet;
	bids: PerpetualsOrderedVecSet;
	asksQuantity: IFixed;
	bidsQuantity: IFixed;
}

bcs.registerStructType("Position", {
	baseAssetAmount: BCS.U256,
	quoteAssetNotionalAmount: BCS.U256,
	cumFundingRateLong: BCS.U256,
	cumFundingRateShort: BCS.U256,
	asks: "OrderedVecSet",
	bids: "OrderedVecSet",
	asksQuantity: BCS.U256,
	bidsQuantity: BCS.U256,
});

export interface PerpetualsOrderedVecSet extends Object {}

bcs.registerStructType("OrderedVecSet", {
	id: "UID",
});

bcs.registerStructType("Contents", {
	dummy_field: BCS.BOOL,
});

bcs.registerStructType("AccountKey", {
	accountId: BCS.U64,
});

// =========================================================================
//  Market Manager
// =========================================================================

export interface PerpetualsMarketData {
	marketId: PerpetualsMarketId;
	marketParams: PerpetualsMarketParams;
}

export interface PerpetualsMarketManager extends Object {
	feesAccrued: IFixed;
	minOrderUsdValue: IFixed;
	liquidationTolerance: bigint;
}

bcs.registerStructType("MarketManager", {
	id: "UID",
	feesAccrued: BCS.U256,
	minOrderUsdValue: BCS.U256,
	liquidationTolerance: BCS.U64,
});

export interface PerpetualsMarketParams {
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
	baseAssetSymbol: string;
	fundingFrequencyMs: bigint;
	fundingPeriodMs: bigint;
	premiumTwapFrequencyMs: bigint;
	premiumTwapPeriodMs: bigint;
	spreadTwapFrequencyMs: bigint;
	spreadTwapPeriodMs: bigint;
	makerFee: IFixed;
	takerFee: IFixed;
	liquidationFee: IFixed;
	forceCancelFee: IFixed;
	insuranceFundFee: IFixed;
	insuranceFundId: bigint;
}

bcs.registerStructType("MarketParams", {
	marginRatioInitial: BCS.U256,
	marginRatioMaintenance: BCS.U256,
	baseAssetSymbol: BCS.STRING,
	fundingFrequencyMs: BCS.U64,
	fundingPeriodMs: BCS.U64,
	premiumTwapFrequencyMs: BCS.U64,
	premiumTwapPeriodMs: BCS.U64,
	spreadTwapFrequencyMs: BCS.U64,
	spreadTwapPeriodMs: BCS.U64,
	makerFee: BCS.U256,
	takerFee: BCS.U256,
	liquidationFee: BCS.U256,
	forceCancelFee: BCS.U256,
	insuranceFundFee: BCS.U256,
	insuranceFundId: BCS.U64,
});

export interface PerpetualsMarketState {
	cumFundingRateLong: IFixed;
	cumFundingRateShort: IFixed;
	fundingLastUpdMs: Timestamp;
	premiumTwap: IFixed;
	premiumTwapLastUpdMs: Timestamp;
	spreadTwap: IFixed;
	spreadTwapLastUpdMs: Timestamp;
	openInterest: IFixed;
}

bcs.registerStructType("MarketState", {
	cumFundingRateLong: BCS.U256,
	cumFundingRateShort: BCS.U256,
	fundingLastUpdMs: BCS.U64,
	premiumTwap: BCS.U256,
	premiumTwapLastUpdMs: BCS.U64,
	spreadTwap: BCS.U256,
	spreadTwapLastUpdMs: BCS.U64,
	openInterest: BCS.U256,
});

export interface PerpetualsMarginRatioProposal {
	maturity: bigint;
	marginRatioInitial: IFixed;
	marginRatioMaintenance: IFixed;
}

bcs.registerStructType("MarginRatioProposal", {
	maturity: BCS.U64,
	marginRatioInitial: BCS.U256,
	marginRatioMaintenance: BCS.U256,
});

bcs.registerStructType("MarketKey", {
	marketId: BCS.U64,
});

// =========================================================================
//  Orderbook
// =========================================================================

export interface PerpetualsOrderbook extends Object {
	lotSize: bigint;
	tickSize: bigint;
	asks: PerpetualsOrderedMap<Order>;
	bids: PerpetualsOrderedMap<Order>;
	counter: bigint;
}

bcs.registerStructType("Orderbook", {
	id: "UID",
	lotSize: BCS.U64,
	tickSize: BCS.U64,
	asks: ["Map", "Order"],
	bids: ["Map", "Order"],
	counter: BCS.U64,
});

export interface Order {
	accountId: PerpetualsAccountId;
	size: bigint;
}

bcs.registerStructType("Order", {
	accountId: BCS.U64,
	size: BCS.U64,
});

export interface PerpetualsOrderedMap<T> extends Object {
	size: bigint;
	counter: bigint;
	root: bigint;
	first: bigint;
	branchMin: bigint;
	branchMax: bigint;
	leafMin: bigint;
	leafMax: bigint;
	branchesMergeMax: bigint;
	leavesMergeMax: bigint;
}

bcs.registerStructType(["Map", "V"], {
	id: "UID",
	size: BCS.U64,
	counter: BCS.U64,
	root: BCS.U64,
	first: BCS.U64,
	branchMin: BCS.U64,
	branchMax: BCS.U64,
	leafMin: BCS.U64,
	leafMax: BCS.U64,
	branchesMergeMax: BCS.U64,
	leavesMergeMax: BCS.U64,
});

export interface PerpetualsBranch {
	keys: bigint[];
	kids: bigint[];
}

bcs.registerStructType("Branch", {
	keys: ["vector", BCS.U128],
	kids: ["vector", BCS.U64],
});

export interface PerpetualsLeaf<V> {
	keys: bigint[];
	vals: V[];
	next: bigint;
}

bcs.registerStructType(["Leaf", "V"], {
	keys: ["vector", BCS.U128],
	vals: ["vector", "V"],
	next: BCS.U64,
});

bcs.registerStructType("OrderbookKey", {
	marketId: BCS.U64,
});

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Objects
// =========================================================================

export interface ApiPerpetualsAccountsBody {
	walletAddress: SuiAddress;
}

// =========================================================================
//  Transactions
// =========================================================================

export interface ApiPerpetualsCreateAccountBody {
	walletAddress: SuiAddress;
	coinType: CoinType;
}

export interface ApiPerpetualsDepositCollateralBody {
	walletAddress: SuiAddress;
	coinType: CoinType;
	accountCapId: ObjectId;
	amount: Balance;
}

export interface ApiPerpetualsWithdrawCollateralBody {
	walletAddress: SuiAddress;
	coinType: CoinType;
	accountCapId: ObjectId;
	amount: Balance;
}

export interface ApiPerpetualsMarketOrderBody {
	walletAddress: SuiAddress;
	coinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	side: boolean;
	size: bigint;
}

export interface ApiPerpetualsLimitOrderBody {
	walletAddress: SuiAddress;
	coinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	side: boolean;
	size: bigint;
	price: bigint;
	orderType: bigint;
}

export interface ApiPerpetualsCancelOrderBody {
	walletAddress: SuiAddress;
	coinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
	side: boolean;
	orderId: PerpetualsOrderId;
}

export interface ApiPerpetualsClosePositionBody {
	walletAddress: SuiAddress;
	coinType: CoinType;
	accountCapId: ObjectId;
	marketId: PerpetualsMarketId;
}
