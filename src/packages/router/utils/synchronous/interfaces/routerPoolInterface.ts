import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import {
	Balance,
	RouterProtocolName,
	RouterSerializablePool,
	Slippage,
	SuiNetwork,
	UniqueId,
	Url,
} from "../../../../../types";
import { CoinType } from "../../../../coin/coinTypes";
import AftermathRouterPool from "../routerPools/aftermathRouterPool";
import NojoRouterPool from "../routerPools/nojoRouterPool";
import { AftermathApi } from "../../../../../general/providers";
import { isNojoPoolObject } from "../../../../external/nojo/nojoAmmTypes";
import { isDeepBookPoolObject } from "../../../../external/deepBook/deepBookTypes";
import DeepBookRouterPool from "../routerPools/deepBookRouterPool";
import { isCetusRouterPoolObject } from "../../../../external/cetus/cetusTypes";
import CetusRouterPool from "../routerPools/cetusRouterPool";
import { isTurbosPoolObject } from "../../../../external/turbos/turbosTypes";
import TurbosRouterPool from "../routerPools/turbosRouterPool";

/////////////////////////////////////////////////////////////////////
//// Creation
/////////////////////////////////////////////////////////////////////

export function createRouterPool(inputs: {
	pool: RouterSerializablePool;
	// NOTE: should this be optional and passed in only upon transaction creation or another way ?
	network: SuiNetwork | Url;
}): RouterPoolInterface {
	const { pool, network } = inputs;

	const constructedPool = isNojoPoolObject(pool)
		? new NojoRouterPool(pool, network)
		: isDeepBookPoolObject(pool)
		? new DeepBookRouterPool(pool, network)
		: isCetusRouterPoolObject(pool)
		? new CetusRouterPool(pool, network)
		: isTurbosPoolObject(pool)
		? new TurbosRouterPool(pool, network)
		: new AftermathRouterPool(pool, network);

	return constructedPool;
}

/////////////////////////////////////////////////////////////////////
//// Constructor
/////////////////////////////////////////////////////////////////////

// TODO: use this to make above creation function cleaner

// interface RouterPoolConstructor {
// 	new (
// 		pool: RouterSerializablePool,
// 		network: SuiNetwork | Url
// 	): RouterPoolInterface;
// }

/////////////////////////////////////////////////////////////////////
//// Interface
/////////////////////////////////////////////////////////////////////

export interface RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Required
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName: RouterProtocolName;
	readonly pool: RouterSerializablePool;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly expectedGasCostPerHop: Balance; // in SUI
	readonly coinTypes: CoinType[];
	readonly noHopsAllowed: boolean;

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	// NOTE: should this be optional ?
	getSpotPrice: (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => number;

	getTradeAmountOut: (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}) => Balance;

	addTradeCommandToTransaction: (inputs: {
		provider: AftermathApi;
		tx: TransactionBlock;
		coinIn: ObjectId | TransactionArgument;
		coinInAmount: Balance;
		coinInType: CoinType;
		coinOutType: CoinType;
		expectedAmountOut: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}) => TransactionArgument;

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Optional
	/////////////////////////////////////////////////////////////////////

	// PRODUCTION: make these optional and handle cases

	getTradeAmountIn: (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}) => Balance;

	getUpdatedPoolBeforeTrade: (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}) => RouterPoolInterface;

	getUpdatedPoolAfterTrade: (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}) => RouterPoolInterface;
}