import { AftermathApi } from "../../../general/providers";

import {
	ObjectId,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Balance } from "../../../types";
import { Helpers } from "../../../general/utils";
import { DeepBookApiHelpers } from "./deepBookApiHelper";

export class DeepBookApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new DeepBookApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	// public fetchPool = (objectId: ObjectId) => {
	// 	return Pool.fetch(this.Provider.provider, objectId);
	// };

	public fetchAllPools = async () => this.Helpers.fetchAllPools();

	// public fetchPoolForCoinTypes = async (coinTypeA: CoinType, coinTypeB: CoinType) => {
	//     const poolRegistry = await this.Helpers.fetchPoolRegistry()
	//     poolRegistry.table
	// 	return this.fetchPool(objectId)
	// };

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSupportedCoins = async (): Promise<CoinType[]> => {
		const pools = await this.Helpers.fetchAllPools();
		const allCoins = pools.reduce(
			(acc, pool) => [...acc, pool.baseCoin, pool.quoteCoin],
			[] as CoinType[]
		);
		return Helpers.uniqueArray(allCoins);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	// public addSwapCommandToTransaction = (
	// 	tx: TransactionBlock,
	// 	pool: Pool,
	// 	coinIn: TransactionArgument | ObjectId,
	// 	coinInType: CoinType,
	// 	minOut: Balance
	// ): {
	// 	tx: TransactionBlock;
	// 	coinOut: TransactionArgument;
	// } => {
	// 	const swapArgs = {
	// 		pool: pool.id,
	// 		input: coinIn,
	// 		minOut,
	// 	};

	// 	let coinOut: TransactionArgument;
	// 	if (coinInType === pool.$typeArgs[0]) {
	// 		coinOut = swapACoin(tx, pool.$typeArgs, swapArgs);
	// 	} else {
	// 		coinOut = swapBCoin(tx, pool.$typeArgs, swapArgs);
	// 	}

	// 	return {
	// 		tx,
	// 		coinOut,
	// 	};
	// };
}
