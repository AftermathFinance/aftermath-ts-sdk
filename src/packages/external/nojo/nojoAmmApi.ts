import { AftermathApi } from "../../../general/providers";
import { initLoaderIfNeeded } from "@kunalabs-io/amm/src/init";
import { poolValues } from "@kunalabs-io/amm/src/amm/pool/functions";
import { Pool, PoolRegistry } from "@kunalabs-io/amm/src/amm/pool/structs";
import {
	ObjectId,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { NojoAmmApiHelpers } from "./nojoAmmApiHelpers";
import { CoinType } from "../../coin/coinTypes";
import { Balance } from "../../../types";
import { swapACoin, swapBCoin } from "@kunalabs-io/amm/src/amm/util/functions";

export class NojoAmmApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		initLoaderIfNeeded();
		this.Helpers = new NojoAmmApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchPool = (objectId: ObjectId) => {
		return Pool.fetch(this.Provider.provider, objectId);
	};

	// public fetchPoolForCoinTypes = async (coinTypeA: CoinType, coinTypeB: CoinType) => {

	//     const poolRegistry = await this.Helpers.fetchPoolRegistry()

	//     poolRegistry.table

	// 	return this.fetchPool(objectId)
	// };

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public addSwapCommandToTransaction = (
		tx: TransactionBlock,
		pool: Pool,
		coinIn: TransactionArgument | ObjectId,
		coinInType: CoinType,
		minOut: Balance
	): {
		tx: TransactionBlock;
		coinOut: TransactionArgument;
	} => {
		const swapArgs = {
			pool: pool.id,
			input: coinIn,
			minOut,
		};

		let coinOut: TransactionArgument;
		if (coinInType === pool.$typeArgs[0]) {
			coinOut = swapACoin(tx, pool.$typeArgs, swapArgs);
		} else {
			coinOut = swapBCoin(tx, pool.$typeArgs, swapArgs);
		}

		return {
			tx,
			coinOut,
		};
	};
}
