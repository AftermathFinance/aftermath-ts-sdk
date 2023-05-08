import { SuiAddress } from "@mysten/sui.js";
import {
	Balance,
	Percentage,
	Slippage,
} from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";
import { PoolObject, PoolTradeFee } from "../pools/poolsTypes";
import { NojoPoolObject } from "../external/nojo/nojoAmmTypes";
import { DeepBookPoolObject } from "../external/deepBook/deepBookTypes";
import { RouterPoolInterface } from "./utils/synchronous/interfaces/routerPoolInterface";
import {
	CetusPoolObject,
	CetusRouterPoolObject,
} from "../external/cetus/cetusTypes";

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type UniqueId = string;

/////////////////////////////////////////////////////////////////////
//// General
/////////////////////////////////////////////////////////////////////

/**
 * Fee info for third party packages wanting to fee route transactions
 */
export interface RouterExternalFee {
	/**
	 * Address of recipient for collected fees
	 */
	recipient: SuiAddress;
	/**
	 * Percent of fees to be collected from final coin out amount
	 *
	 * @remarks 0.54 = 54%
	 */
	feePercentage: Percentage;
}

/////////////////////////////////////////////////////////////////////
//// All Router Pools
/////////////////////////////////////////////////////////////////////

export type RouterSerializablePool =
	| RouterSynchronousSerializablePool
	| RouterAsyncSerializablePool;

export type RouterProtocolName =
	| RouterSynchronousProtocolName
	| RouterAsyncProtocolName;

/////////////////////////////////////////////////////////////////////
//// Synchronous Router Pools
/////////////////////////////////////////////////////////////////////

export type RouterSynchronousSerializablePool =
	| PoolObject
	| NojoPoolObject
	| DeepBookPoolObject;

export type RouterSynchronousProtocolName = "Aftermath" | "Nojo" | "DeepBook";

/////////////////////////////////////////////////////////////////////
//// Router Async Pools
/////////////////////////////////////////////////////////////////////

export type RouterAsyncSerializablePool = CetusRouterPoolObject;

export type RouterAsyncProtocolName = "Cetus";

/////////////////////////////////////////////////////////////////////
//// Paths
/////////////////////////////////////////////////////////////////////

export type RouterCompleteTradeRoute = RouterTradeInfo & {
	routes: RouterTradeRoute[];
	referrer?: SuiAddress;
	externalFee?: RouterExternalFee;
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

/////////////////////////////////////////////////////////////////////
//// Graph
/////////////////////////////////////////////////////////////////////

export interface RouterCompleteGraph {
	coinNodes: RouterGraphCoinNodes;
	pools: RouterPoolsById;
}

export interface RouterSerializableCompleteGraph {
	coinNodes: RouterGraphCoinNodes;
	pools: RouterSerializablePoolsById;
}

export type RouterSupportedCoinPaths = Record<CoinType, CoinType[]>;

export interface RouterOptions {
	maxRouteLength: number;
	tradePartitionCount: number;
	minRoutesToCheck: number;
	maxGasCost: bigint;
}

export type RouterSerializablePoolsById = Record<
	UniqueId,
	RouterSerializablePool
>;

export type RouterGraphCoinNodes = Record<CoinType, RouterCoinNode>;
export type RouterPoolsById = Record<UniqueId, RouterPoolInterface>;

export interface RouterCoinNode {
	coin: CoinType;
	coinOutThroughPoolEdges: RouterCoinOutThroughPoolEdges;
}

export type RouterCoinOutThroughPoolEdges = Record<CoinType, UniqueId[]>;

/////////////////////////////////////////////////////////////////////
//// Async Graph
/////////////////////////////////////////////////////////////////////

export interface RouterAsyncTradeResults {
	coinInType: CoinType;
	coinOutType: CoinType;
	amountsIn: Balance[];
	results: RouterAsyncTradeResult[];
}

export interface RouterAsyncTradeResult {
	protocol: RouterAsyncProtocolName;
	pool: RouterAsyncSerializablePool;
	amountsOut: Balance[];
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

/**
 * Details for router to construct trade route
 */
export type ApiRouterCompleteTradeRouteBody = {
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
	externalFee?: RouterExternalFee;
} & (
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
}
