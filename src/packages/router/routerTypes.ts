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
//// Router Pools
/////////////////////////////////////////////////////////////////////

export type RouterSerializablePool = PoolObject | NojoPoolObject;
export type RouterProtocolName = "Aftermath" | "Nojo";

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
//// API
/////////////////////////////////////////////////////////////////////

/**
 * Details for router to construct trade route
 */
export type ApiRouterCompleteTradeRouteBody = {
	/**
	 * Coin type of coin being given away
	 */
	coinIn: CoinType;
	/**
	 * Coin type of coin being received
	 */
	coinOut: CoinType;
	/**
	 * Optional address for referrer of the route creator
	 */
	referrer?: SuiAddress;
	/** {@fix RouterExternalFee} */
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
	/** {@fix RouterCompleteTradeRoute} */
	completeRoute: RouterCompleteTradeRoute;
	/** {@fix Slippage} */
	slippage: Slippage;
}
