import { TransactionArgument } from "@mysten/sui.js/transactions";
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
import { CoinType, ServiceCoinData } from "../coin/coinTypes";
import { TransactionObjectArgument } from "@mysten/sui/transactions";
import { TransactionObjectArgument as TransactionObjectArgumentV0 } from "@mysten/sui.js/transactions";

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

export type RouterProtocolName =
	| "Aftermath"
	| "BlueMove"
	| "BlueMoveStable"
	| "Cetus"
	| "DeepBook"
	| "DeepBookV3"
	| "FlowX"
	| "FlowXClmm"
	| "Kriya"
	| "KriyaClmm"
	| "Pump"
	| "SuiSwap"
	| "Turbos"
	| "afSUI"; // NOTE: this is not added yet

// =========================================================================
//  Paths
// =========================================================================

export type RouterCompleteTradeRoute = RouterTradeInfo & {
	routes: RouterTradeRoute[];
	netTradeFeePercentage: Percentage;
	referrer?: SuiAddress;
	externalFee?: ExternalFee;
	slippage?: Slippage;
};

/**
 * @deprecated please use `RouterCompleteTradeRoute` instead
 */
export type RouterCompleteTradeRouteWithFee = RouterCompleteTradeRoute;

export type RouterTradeRoute = RouterTradeInfo & {
	paths: RouterTradePath[];
};

export type RouterTradePath = RouterTradeInfo & {
	protocolName: RouterProtocolName;
	pool: RouterServicePoolMetadata;
};

export interface RouterTradeInfo {
	coinIn: RouterTradeCoin;
	coinOut: RouterTradeCoin;
	spotPrice: number;
}

export interface RouterTradeCoin {
	type: CoinType;
	amount: Balance;
	tradeFee: Balance;
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
} & (
	| {
			protocolBlacklist?: RouterProtocolName[];
	  }
	| {
			protocolWhitelist?: RouterProtocolName[];
	  }
);

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
					slippage: Slippage;
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
		coinInId?: TransactionObjectArgument;
	};

export type ApiRouterAddTransactionForCompleteTradeRouteV0Body =
	ApiRouterTransactionForCompleteTradeRouteBody & {
		serializedTx: SerializedTransaction;
		coinInId?: TransactionObjectArgumentV0;
	};

export interface ApiRouterAddTransactionForCompleteTradeRouteResponse {
	tx: SerializedTransaction;
	coinOutId: TransactionObjectArgument | undefined;
}

export interface ApiRouterAddTransactionForCompleteTradeRouteV0Response {
	tx: SerializedTransaction;
	coinOutId: TransactionObjectArgumentV0 | undefined;
}

export type ApiRouterTradeEventsBody = ApiEventsBody & {
	walletAddress: SuiAddress;
};

export interface ApiRouterDynamicGasBody {
	txKindBytes: TxBytes;
	gasCoinType: CoinType;
	gasCoinData: ServiceCoinData;
	coinOutAmount: BigIntAsString;
	senderAddress: SuiAddress;
	sponsorAddress: SuiAddress;
	referrer?: SuiAddress;
}

// =========================================================================
//  Service
// =========================================================================

export interface RouterServicePaths {
	data: RouterServicePath[];
	protocol_fee: RouterServiceSwapFee;
}

export interface RouterServicePath {
	amount: number;
	path: {
		data: RouterServiceHop[];
	};
}

export interface RouterServiceHop {
	pool: RouterServicePoolMetadata;
	input: CoinType;
	output: CoinType;
	input_amount: number;
	output_amount: number;
	swap_fee: RouterServiceSwapFee;
}

export interface RouterServiceSwapFee {
	input_fee_amount: number;
	output_fee_amount: number;
}

export interface RouterServicePoolMetadata {
	protocol: {
		protocol: RouterProtocolName;
	};
	pool_id: ObjectId;
	tb_data: any; // TBData
	assets: [CoinType, CoinType];
}
