import { SuiAddress } from "@mysten/sui.js";
import { Balance, Slippage } from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";
import { PoolObject, PoolTradeFee } from "../pools/poolsTypes";
import { SuiNetwork } from "../../types";
import { NojoPoolObject } from "./utils/routerPools/nojoRouterPool";

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type UniqueId = string;

/////////////////////////////////////////////////////////////////////
//// Router Pools
/////////////////////////////////////////////////////////////////////

export type SerializablePool = PoolObject | NojoPoolObject;
export type ProtocolName = "Aftermath" | "Nojo";

/////////////////////////////////////////////////////////////////////
//// Paths
/////////////////////////////////////////////////////////////////////

export type RouterCompleteTradeRoute = RouterTradeInfo & {
	routes: RouterTradeRoute[];
};

export type RouterTradeRoute = RouterTradeInfo & {
	paths: RouterTradePath[];
};

export type RouterTradePath = RouterTradeInfo & {
	protocolName: ProtocolName;
	pool: SerializablePool;
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
//// API
/////////////////////////////////////////////////////////////////////

export type ApiRouterCompleteTradeRouteBody = {
	coinIn: CoinType;
	coinOut: CoinType;
} & (
	| {
			coinInAmount: Balance;
	  }
	| {
			coinOutAmount: Balance;
	  }
);

export interface ApiRouterTransactionForCompleteTradeRouteBody {
	walletAddress: SuiAddress;
	completeRoute: RouterCompleteTradeRoute;
	slippage: Slippage;
	referrer?: SuiAddress;
}
