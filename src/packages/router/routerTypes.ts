import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { AnyObjectType, Balance } from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";
import { PoolTradeFee } from "../pools/poolsTypes";

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
	poolObjectId: ObjectId;
	poolLpCoinType: CoinType;
};

export interface RouterTradeInfo {
	coinIn: CoinType;
	coinOut: CoinType;
	coinInAmount: Balance;
	coinOutAmount: Balance;
	tradeFee: PoolTradeFee;
	spotPrice: number;
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
}
