import { ObjectId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
import { Balance } from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";
import {
	PoolObject,
	PoolCompleteObject,
	PoolWeight,
	PoolTradeFee,
	PoolName,
} from "../pools/poolsTypes";

/////////////////////////////////////////////////////////////////////
//// Paths
/////////////////////////////////////////////////////////////////////

export interface RouterPath {
	pool: PoolObject;
	baseAsset: CoinType;
	quoteAsset: CoinType;
	weight: number;
}

export interface RouterPathInfo {
	spotPrice: number;
	paths: RouterPath[];
}

/////////////////////////////////////////////////////////////////////
//// Graph
/////////////////////////////////////////////////////////////////////

export type PathStep = Edge;
export type GraphPath = PathStep[];

export interface Route {
	coinFrom: CoinType;
	coinTo: CoinType;
	path: GraphPath;
	balanceIn: Balance;
	balanceOut: Balance;
}

export interface Node {
	coinType: CoinType;
}

export interface PseudoPool {
	source: PoolCompleteObject;
	balances: {
		[key: CoinType]: Balance;
	};
	originalBalances: {
		[key: CoinType]: Balance;
	};
	weights: {
		[key: CoinType]: PoolWeight;
	};
	tradeFee: PoolTradeFee;
}

export interface Edge {
	nodeFrom: Node;
	nodeTo: Node;
	alongPool: PseudoPool;
	spotPrice: number;
}

export interface NodeWithOuts {
	sourceNode: Node;
	routes: Edge[];
}

export interface Graph {
	pools: { [key: PoolName]: PseudoPool };
	startingPoints: Map<CoinType, NodeWithOuts>;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiRouterPathInfoBody {
	fromCoin: CoinType;
	toCoin: CoinType;
}

export interface ApiRouterFirstTradeTransactionsBody {
	walletAddress: SuiAddress;
	fromCoinAmount: Balance;
	path: RouterPath;
}

export interface ApiRouterIntermediateTradeTransactionsBody {
	path: RouterPath;
	fromCoinId: ObjectId;
}
