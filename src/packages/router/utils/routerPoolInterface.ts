import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import {
	Balance,
	ProtocolName,
	SerializablePool,
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
	protocolName: ProtocolName;
	pool: SerializablePool;
	// NOTE: should this be optional and passed in only upon transaction creation or another way ?
	network: SuiNetwork;
}): RouterPoolInterface {
	const protocolNamesToConstructor: Record<
		ProtocolName,
		RouterPoolConstructor
	> = {
		Aftermath: AftermathRouterPool,
		Nojo: NojoRouterPool,
	};

	const constructor = protocolNamesToConstructor[inputs.protocolName];
	return new constructor(inputs.pool, inputs.network);
}

/////////////////////////////////////////////////////////////////////
//// Constructor
/////////////////////////////////////////////////////////////////////

interface RouterPoolConstructor {
	new (pool: SerializablePool, network: SuiNetwork): RouterPoolInterface;
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

	readonly protocolName: ProtocolName;
	readonly pool: SerializablePool;
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
