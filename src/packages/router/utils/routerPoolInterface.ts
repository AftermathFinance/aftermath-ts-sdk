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
} from "../../../types";
import { CoinType } from "../../coin/coinTypes";
import AftermathRouterPool from "./routerPools/aftermathRouterPool";
import NojoRouterPool from "./routerPools/nojoRouterPool";
import { AftermathApi } from "../../../general/providers";

/////////////////////////////////////////////////////////////////////
//// Creation
/////////////////////////////////////////////////////////////////////

export function createRouterPool(inputs: {
	pool: RouterSerializablePool;
	// NOTE: should this be optional and passed in only upon transaction creation or another way ?
	network: SuiNetwork;
}): RouterPoolInterface {
	const { pool, network } = inputs;

	const constructedPool =
		"typeArgs" in pool
			? new NojoRouterPool(pool, network)
			: new AftermathRouterPool(pool, network);
	return constructedPool;
}

/////////////////////////////////////////////////////////////////////
//// Constructor
/////////////////////////////////////////////////////////////////////

interface RouterPoolConstructor {
	new (
		pool: RouterSerializablePool,
		network: SuiNetwork
	): RouterPoolInterface;
}

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
	readonly network: SuiNetwork;
	readonly uid: UniqueId;
	// readonly limitToSingleHops: boolean;
	readonly expectedGasCostPerHop: Balance; // in SUI
	readonly coinTypes: CoinType[];

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
	}) => {
		coinOutAmount: Balance;
		error?: string;
	};

	addTradeCommandToTransaction: (inputs: {
		provider: AftermathApi;
		tx: TransactionBlock;
		coinIn: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		expectedAmountOut: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}) => {
		tx: TransactionBlock;
		coinOut: TransactionArgument;
	};

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
	}) => {
		coinInAmount: Balance;
		error?: string;
	};

	getUpdatedPoolBeforeTrade: (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}) => RouterPoolInterface;

	getUpdatedPoolAfterTrade: (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}) => RouterPoolInterface;
}
