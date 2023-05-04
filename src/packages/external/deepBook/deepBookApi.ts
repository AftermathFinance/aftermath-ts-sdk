import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { Helpers } from "../../../general/utils";
import { DeepBookApiHelpers } from "./deepBookApiHelper";
import { DeepBookPoolObject, PartialDeepBookPoolObject } from "./deepBookTypes";
import { RouterApiInterface } from "../../router/utils/routerApiInterface";
import {
	ObjectId,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";

export class DeepBookApi implements RouterApiInterface<DeepBookPoolObject> {
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

	public fetchAllPools = async (): Promise<DeepBookPoolObject[]> => {
		const partialPools = await this.Helpers.fetchAllPartialPools();

		const pools = await Promise.all(
			partialPools.map((pool) =>
				this.Helpers.fetchCreateCompletePoolObjectFromPartial({ pool })
			)
		);

		return pools;
	};

	// public fetchPoolForCoinTypes = async (inputs: {
	// 	coinType1: CoinType;
	// 	coinType2: CoinType;
	// }): Promise<DeepBookPoolObject> => {
	// 	const pools = await this.fetchAllPools();
	// };

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSupportedCoins = async (): Promise<CoinType[]> => {
		const pools = await this.Helpers.fetchAllPartialPools();
		const allCoins = pools.reduce(
			(acc, pool) => [...acc, pool.baseCoinType, pool.quoteCoinType],
			[] as CoinType[]
		);
		return Helpers.uniqueArray(allCoins);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public addTradeCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		pool: PartialDeepBookPoolObject;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (Coin<CoinIn>, Coin<CoinOut>, u64 (amountFilled), u64 (amountOut)) */ => {
		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
		};

		if (
			Helpers.stripLeadingZeroesFromType(inputs.coinInType) ===
			Helpers.stripLeadingZeroesFromType(inputs.pool.baseCoinType)
		) {
			return this.Helpers.addTradeBaseToQuoteCommandToTransaction(
				commandInputs
			);
		}

		return this.Helpers.addTradeQuoteToBaseCommandToTransaction(
			commandInputs
		);
	};
}
