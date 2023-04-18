import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { Balance, Slippage, SuiNetwork, UniqueId } from "../../../../types";
import { CoinType } from "../../../coin/coinTypes";
import { PoolObject } from "../../../pools/poolsTypes";
import { RouterPoolInterface } from "../routerPoolInterface";
import { Pool } from "../../../pools";
import { Helpers } from "../../../../general/utils";
import { AftermathApi } from "../../../../general/providers";

class AftermathRouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: PoolObject, network: SuiNetwork) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = Object.keys(pool.coins);
		this.poolClass = new Pool(pool, network);
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "Aftermath";
	// readonly limitToSingleHops = false;
	readonly expectedGasCostPerHop = BigInt(100_000_000); // 0.1 SUI

	readonly pool: PoolObject;
	readonly network: SuiNetwork;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

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
		provider: AftermathApi;
		tx: TransactionBlock;
		coinIn: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		expectedAmountOut: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): {
		tx: TransactionBlock;
		coinOut: TransactionArgument;
	} => {
		return inputs.provider
			.Pools()
			.Helpers.addTradeCommandWithCoinOutToTransaction(
				inputs.tx,
				this.pool.objectId,
				inputs.coinIn,
				inputs.coinInType,
				inputs.expectedAmountOut,
				inputs.coinOutType,
				this.pool.lpCoinType,
				inputs.slippage,
				inputs.referrer
			);
	};

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

		return new AftermathRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};
}

export default AftermathRouterPool;
