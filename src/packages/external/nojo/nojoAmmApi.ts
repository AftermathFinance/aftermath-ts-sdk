import { AftermathApi } from "../../../general/providers";
import {
	Pool,
	swapACoin,
	swapBCoin,
	initLoaderIfNeeded,
} from "../../../external/nojo";
import {
	ObjectId,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { NojoAmmApiHelpers } from "./nojoAmmApiHelpers";
import { CoinType } from "../../coin/coinTypes";
import { Balance } from "../../../types";
import { Helpers } from "../../../general/utils";
import { RouterApiInterface } from "../../router/utils/routerApiInterface";
import { NojoPoolObject } from "./nojoAmmTypes";

export class NojoAmmApi implements RouterApiInterface<NojoPoolObject> {
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

	public fetchAllPools = async (): Promise<NojoPoolObject[]> => {
		const poolObjectIds = await this.Helpers.fetchAllPoolObjectIds();
		const poolSuiObjects = this.Provider.Objects().fetchObjectBatch(
			poolObjectIds,
			{
				showContent: true,
			}
		);
		const poolClasses = (await poolSuiObjects).map((poolSuiObject) => {
			const content = poolSuiObject.data?.content;
			if (content === undefined)
				throw new Error("no content found on fetched pool object");
			return Pool.fromSuiParsedData(content);
		});

		return poolClasses.map(NojoAmmApiHelpers.nojoPoolObjectFromClass);
	};

	// public fetchPoolForCoinTypes = async (coinTypeA: CoinType, coinTypeB: CoinType) => {
	//     const poolRegistry = await this.Helpers.fetchPoolRegistry()
	//     poolRegistry.table
	// 	return this.fetchPool(objectId)
	// };

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSupportedCoins = async (): Promise<CoinType[]> => {
		const pools = await this.fetchAllPools();
		const allCoins = pools.reduce(
			(acc, pool) => [...acc, ...pool.typeArgs],
			[] as CoinType[]
		);
		return Helpers.uniqueArray(allCoins);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public addTradeCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		pool: Pool;
		coinIn: TransactionArgument | ObjectId;
		coinInType: CoinType;
		minOut: Balance;
	}): TransactionArgument => {
		const { tx, pool, coinIn, coinInType, minOut } = inputs;

		const swapArgs = {
			pool: pool.id,
			input: coinIn,
			minOut,
		};

		const coinTypesWithZeroes: [CoinType, CoinType] = [
			Helpers.addLeadingZeroesToType(pool.$typeArgs[0]),
			Helpers.addLeadingZeroesToType(pool.$typeArgs[1]),
		];

		let coinOut: TransactionArgument;
		if (coinInType === coinTypesWithZeroes[0]) {
			coinOut = swapACoin(tx, coinTypesWithZeroes, swapArgs);
		} else {
			coinOut = swapBCoin(tx, coinTypesWithZeroes, swapArgs);
		}

		return coinOut;
	};
}
