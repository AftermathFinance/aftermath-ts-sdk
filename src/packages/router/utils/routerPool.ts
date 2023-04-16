import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { Balance, Slippage, SuiNetwork, UniqueId } from "../../../types";
import { CoinType } from "../../coin/coinTypes";
import { PoolObject } from "../../pools/poolsTypes";
import { RouterPoolInterface } from "./routerPoolInterface";
import { Pool } from "../../pools";
import { Helpers } from "../../../general/utils";

class RouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: PoolObject, network: SuiNetwork) {
		this.pool = pool;
		this.uid = pool.objectId;
		this.network = network;
		this.poolClass = new Pool(pool, network);
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "Aftermath";
	readonly limitToSingleHops = false;
	readonly pool: PoolObject;
	readonly network: SuiNetwork;
	readonly uid: UniqueId;

	private readonly poolClass: Pool;

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	getSpotPrice = (inputs: { coinInType: CoinType; coinOutType: CoinType }) =>
		this.poolClass.getSpotPrice(inputs);

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): {
		coinOutAmount: Balance;
		error?: string;
	} => this.poolClass.getTradeAmountOut(inputs);

	addTradeCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		coinIn: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		expectedAmountOut: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<{
		tx: TransactionBlock;
		coinOut: TransactionArgument;
	}> =>
		this.poolClass.addTradeCommandToTransaction({
			...inputs,
			tx: inputs.tx.serialize(),
		});

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): {
		coinInAmount: Balance;
		error?: string;
	} => this.poolClass.getTradeAmountIn(inputs);

	getUpdatedPoolBeforeTrade = (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface =>
		this.getUpdatedPoolAfterTrade({
			...inputs,
			coinInAmount: -inputs.coinInAmount,
			coinOutAmount: -inputs.coinOutAmount,
		});

	getUpdatedPoolAfterTrade = (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		let newPoolObject = Helpers.deepCopy(this.pool);

		newPoolObject.coins[inputs.coinIn].balance += inputs.coinInAmount;
		newPoolObject.coins[inputs.coinOut].balance -= inputs.coinOutAmount;

		return new RouterPool(Helpers.deepCopy(newPoolObject), this.network);
	};
}

export default RouterPool;
