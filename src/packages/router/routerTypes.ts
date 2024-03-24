import {
	AnyObjectType,
	Balance,
	Percentage,
	Event,
	Slippage,
	ApiEventsBody,
	ObjectId,
	SuiAddress,
	TxBytes,
	BigIntAsString,
	SerializedTransaction,
	ExternalFee,
} from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";
import { PoolObject, PoolTradeFee } from "../pools/poolsTypes";
import {
	DeepBookPoolObject,
	isDeepBookPoolObject,
} from "../external/deepBook/deepBookTypes";
import { RouterPoolInterface } from "./utils/synchronous/interfaces/routerPoolInterface";
import {
	CetusPoolObject,
	isCetusPoolObject,
} from "../external/cetus/cetusTypes";
import {
	TurbosPoolObject,
	isTurbosPoolObject,
} from "../external/turbos/turbosTypes";
import { InterestPoolObject } from "../external/interest/interestTypes";
import { KriyaPoolObject } from "../external/kriya/kriyaTypes";
import { BaySwapPoolObject } from "../external/baySwap/baySwapTypes";
import { SuiswapPoolObject } from "../external/suiswap/suiswapTypes";
import { BlueMovePoolObject } from "../external/blueMove/blueMoveTypes";
import {
	FlowXPoolObject,
	isFlowXPoolObject,
} from "../external/flowX/flowXTypes";
import { AfSuiRouterPoolObject, DynamicGasCoinData } from "../..";
import { TransactionArgument } from "@mysten/sui.js/transactions";

// =========================================================================
//  Name Only
// =========================================================================

export type UniqueId = string;

// =========================================================================
//  General
// =========================================================================

/**
 * Fee info for third party packages wanting to fee route transactions
 * @deprecated please use `ExternalFee` instead
 */
export type RouterExternalFee = ExternalFee;

// =========================================================================
//  All Router Pools
// =========================================================================

export type RouterSerializablePool =
	| RouterSynchronousSerializablePool
	| RouterAsyncSerializablePool;

export type RouterProtocolName =
	| RouterSynchronousProtocolName
	| RouterAsyncProtocolName;

// =========================================================================
//  Synchronous Router Pools
// =========================================================================

export type RouterSynchronousSerializablePool =
	| PoolObject
	| InterestPoolObject
	| KriyaPoolObject
	| BaySwapPoolObject
	| SuiswapPoolObject
	| BlueMovePoolObject
	| AfSuiRouterPoolObject;

export const isRouterSynchronousSerializablePool = (
	pool: RouterSerializablePool
): pool is RouterSynchronousSerializablePool => {
	return !isRouterAsyncSerializablePool(pool);
};

const RouterSynchronousProtocolNames = [
	"Aftermath",
	"Interest",
	"Kriya",
	"BaySwap",
	"Suiswap",
	"BlueMove",
	"afSUI",
] as const;

export type RouterSynchronousProtocolName =
	(typeof RouterSynchronousProtocolNames)[number];

export const isRouterSynchronousProtocolName = (
	protocolName: RouterProtocolName
): protocolName is RouterSynchronousProtocolName => {
	// @ts-ignore
	return RouterSynchronousProtocolNames.includes(protocolName);
};

export type SynchronousProtocolsToPoolObjectIds = Partial<
	Record<RouterSynchronousProtocolName, ObjectId[]>
>;

// =========================================================================
//  Router Async Pools
// =========================================================================

export type RouterAsyncSerializablePool =
	| CetusPoolObject
	| TurbosPoolObject
	| DeepBookPoolObject
	| FlowXPoolObject;

export const isRouterAsyncSerializablePool = (
	pool: RouterSerializablePool
): pool is RouterAsyncSerializablePool => {
	return (
		isDeepBookPoolObject(pool) ||
		isTurbosPoolObject(pool) ||
		isCetusPoolObject(pool) ||
		isFlowXPoolObject(pool)
	);
};

const RouterAsyncProtocolNames = [
	"Cetus",
	"Turbos",
	"DeepBook",
	"FlowX",
] as const;
export type RouterAsyncProtocolName = (typeof RouterAsyncProtocolNames)[number];

export const isRouterAsyncProtocolName = (
	protocolName: RouterProtocolName
): protocolName is RouterAsyncProtocolName => {
	// @ts-ignore
	return RouterAsyncProtocolNames.includes(protocolName);
};

// =========================================================================
//  Paths
// =========================================================================

export type RouterCompleteTradeRoute = RouterTradeInfo & {
	routes: RouterTradeRoute[];
	referrer?: SuiAddress;
	externalFee?: ExternalFee;
};

export type RouterCompleteTradeRouteWithFee = RouterCompleteTradeRoute & {
	netTradeFeePercentage: Percentage;
};

export type RouterTradeRoute = RouterTradeInfo & {
	paths: RouterTradePath[];
};

export type RouterTradePath = RouterTradeInfo & {
	protocolName: RouterProtocolName;
	pool: RouterSerializablePool;
};

export interface RouterTradeInfo {
	coinIn: RouterTradeCoin;
	coinOut: RouterTradeCoin;
	spotPrice: number;
}

export interface RouterTradeCoin {
	type: CoinType;
	amount: Balance;
	tradeFee: PoolTradeFee;
}

// =========================================================================
//  Graph
// =========================================================================

export interface RouterCompleteGraph {
	coinNodes: RouterGraphCoinToPoolIds;
	pools: RouterPoolsById;
}

export interface RouterSerializableCompleteGraph {
	coinNodes: RouterGraphCoinToPoolIds;
	pools: RouterSerializablePoolsById;
}

export interface RouterSynchronousOptions {
	maxRouteLength: number;
	tradePartitionCount: number;
	minRoutesToCheck: number;
	maxRoutesToCheck: number;
	maxGasCost: bigint;
}

export interface RouterAsyncOptions {
	tradePartitionCount: number;
	maxAsyncPoolsPerProtocol: number;
}

interface RouterOptions {
	synchronous: RouterSynchronousOptions;
	async: RouterAsyncOptions;
}
export interface PartialRouterOptions {
	synchronous?: Partial<RouterSynchronousOptions>;
	async?: Partial<RouterAsyncOptions>;
}

export interface AllRouterOptions {
	regular: RouterOptions;
	preAsync: RouterSynchronousOptions;
}

export type RouterSerializablePoolsById = Record<
	UniqueId,
	RouterSerializablePool
>;

// export type RouterGraphCoinNodes = Record<CoinType, RouterCoinNode>;
export type RouterPoolsById = Record<UniqueId, RouterPoolInterface>;

export type RouterGraphCoinToPoolIds = Record<CoinType, UniqueId[]>;

// export interface RouterCoinNode {
// 	coin: CoinType;
// 	coinOutThroughPoolEdges: RouterCoinOutThroughPoolEdges;
// }

// export type RouterCoinOutThroughPoolEdges = Record<CoinType, UniqueId[]>;

// =========================================================================
//  Async Router Trade Results
// =========================================================================

export interface RouterAsyncTradeResults {
	coinInType: CoinType;
	coinOutType: CoinType;
	coinInAmounts: Balance[];
	results: RouterAsyncTradeResult[];
}

export interface RouterAsyncTradeResult {
	protocol: RouterAsyncProtocolName;
	pool: RouterAsyncSerializablePool;
	amountsOut: Balance[];
	feesIn: Balance[];
	feesOut: Balance[];
}

// =========================================================================
//  Events
// =========================================================================

export interface RouterTradeEvent extends Event {
	trader: SuiAddress;
	coinInType: AnyObjectType;
	coinInAmount: Balance;
	coinOutType: AnyObjectType;
	coinOutAmount: Balance;
	// referrer?: SuiAddress;
	// externalFee?: ExternalFee;
}

// =========================================================================
//  API
// =========================================================================

export type ApiRouterPartialCompleteTradeRouteBody = {
	/**
	 * Coin type of coin being given away
	 */
	coinInType: CoinType;
	/**
	 * Coin type of coin being received
	 */
	coinOutType: CoinType;
	/**
	 * Optional address for referrer of the route creator
	 */
	referrer?: SuiAddress;
	/**
	 * Fee info for third party packages wanting to fee route transactions
	 */
	externalFee?: ExternalFee;
	excludeProtocols?: RouterProtocolName[];
};

/**
 * Details for router to construct trade route
 */
export type ApiRouterCompleteTradeRouteBody =
	ApiRouterPartialCompleteTradeRouteBody &
		(
			| {
					/**
					 * Amount of coin being given away
					 */
					coinInAmount: Balance;
			  }
			| {
					/**
					 * Amount of coin expected to receive
					 */
					coinOutAmount: Balance;
			  }
		);

/**
 * Info to construct router trade transaction from complete route
 */
export interface ApiRouterTransactionForCompleteTradeRouteBody {
	/**
	 * Sender address (trader)
	 */
	walletAddress: SuiAddress;
	/**
	 * Complete route followed by `coinIn` to get to `coinOut`
	 */
	completeRoute: RouterCompleteTradeRoute;
	/**
	 * Allowable percent loss for trade
	 */
	slippage: Slippage;
	isSponsoredTx?: boolean;
}

export type ApiRouterAddTransactionForCompleteTradeRouteBody =
	ApiRouterTransactionForCompleteTradeRouteBody & {
		serializedTx: SerializedTransaction;
		coinInId?: TransactionArgument;
	};

export interface ApiRouterAddTransactionForCompleteTradeRouteResponse {
	tx: SerializedTransaction;
	coinOutId: TransactionArgument | undefined;
}

export type ApiRouterTradeEventsBody = ApiEventsBody & {
	walletAddress: SuiAddress;
};

export interface ApiRouterDynamicGasBody {
	txKindBytes: TxBytes;
	gasCoinType: CoinType;
	gasCoinData: DynamicGasCoinData;
	coinOutAmount: BigIntAsString;
	senderAddress: SuiAddress;
	sponsorAddress: SuiAddress;
	referrer?: SuiAddress;
}
