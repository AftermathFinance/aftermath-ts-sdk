import { SuiAddress } from "@mysten/sui.js";
import {
	Balance,
	Percentage,
	Slippage,
} from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";
import { PoolObject, PoolTradeFee } from "../pools/poolsTypes";
import { NojoPoolObject } from "./utils/routerPools/nojoRouterPool";

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type UniqueId = string;

/////////////////////////////////////////////////////////////////////
//// General
/////////////////////////////////////////////////////////////////////

export interface RouterExternalFee {
	recipient: SuiAddress;
	feePercentage: Percentage;
}

/////////////////////////////////////////////////////////////////////
//// Router Pools
/////////////////////////////////////////////////////////////////////

export type RouterSerializablePool = PoolObject | NojoPoolObject;
export type RouterProtocolName = "Aftermath" | "Nojo";

/////////////////////////////////////////////////////////////////////
//// Paths
/////////////////////////////////////////////////////////////////////

export type RouterCompleteTradeRoute = RouterTradeInfo & {
	routes: RouterTradeRoute[];
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
//// API
/////////////////////////////////////////////////////////////////////

export type ApiRouterCompleteTradeRouteBody = {
	coinIn: CoinType;
	coinOut: CoinType;
	referrer?: SuiAddress;
	externalFee?: RouterExternalFee;
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
	externalFee?: RouterExternalFee;
}
