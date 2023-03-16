import {
	ApiRouterFirstTradeTransactionsBody,
	ApiRouterIntermediateTradeTransactionsBody,
	ApiRouterPathInfoBody,
	Balance,
	CoinType,
	RouterPath,
	RouterCompleteRoute,
	SuiNetwork,
	PoolDynamicFields,
	RouterPaths,
} from "../../types";
import { Pool } from "../pools/pool";
import { ObjectId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";

// TODO: create router object
export class Router extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Private Static Contstants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		tradePartitionCount: BigInt(100),
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly pools: Pool[],
		public readonly network?: SuiNetwork
	) {
		super(network, "router");

		// if (pools.length <= 0) throw new Error("pools has length of 0");
		this.pools = pools;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supportedCoins");
	}

	public getRoute(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): RouterCompleteRoute {
		const filteredPools = Router.filterPoolsContainingCoins(
			this.pools,
			coinIn,
			coinOut
		);

		const paths = Router.createPaths(
			filteredPools,
			coinIn,
			coinInAmount,
			coinOut
		);

		const completeRoute = Router.completeRouteFromPaths(
			paths,
			coinIn,
			coinInAmount,
			coinOut
		);

		return completeRoute;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getFirstTradeTransactions(
		walletAddress: SuiAddress,
		path: RouterPath,
		fromCoinAmount: Balance
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiRouterFirstTradeTransactionsBody
		>("transactions/trade", {
			walletAddress,
			fromCoinAmount,
			path,
		});
	}

	public async getIntermediateTradeTransactions(
		path: RouterPath,
		fromCoinId: ObjectId
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiRouterIntermediateTradeTransactionsBody
		>("transactions/trade", {
			fromCoinId,
			path,
		});
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	private static indexOfBestPoolForTrade = (
		pools: Pool[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	) => {
		return Helpers.indexOfMax(
			pools.map((pool) =>
				pool.getTradeAmountOut(coinIn, coinInAmount, coinOut)
			)
		);
	};

	private static getUpdatedPoolAndAmountOutAfterTrade = (
		pool: Pool,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	) => {
		const coinOutAmount = pool.getTradeAmountOut(
			coinIn,
			coinInAmount,
			coinOut
		);

		const poolDynamicFields = pool.dynamicFields;
		const poolAmountDynamicFields = poolDynamicFields.amountFields;

		const coinInDynamicFieldIndex = poolAmountDynamicFields.findIndex(
			(field) => field.coin === coinIn
		);
		const coinOutDynamicFieldIndex = poolAmountDynamicFields.findIndex(
			(field) => field.coin === coinOut
		);

		let newAmountDynamicFields = [...poolAmountDynamicFields];
		newAmountDynamicFields[coinInDynamicFieldIndex].value += coinInAmount;
		newAmountDynamicFields[coinOutDynamicFieldIndex].value -= coinOutAmount;

		const newDynamicFields: PoolDynamicFields = {
			...poolDynamicFields,
			amountFields: newAmountDynamicFields,
		};

		return {
			coinOutAmount,
			pool: new Pool(pool.pool, newDynamicFields, pool.network),
		};
	};

	private static filterPoolsContainingCoins = (
		pools: Pool[],
		coinIn: CoinType,
		coinOut: CoinType
	) => {
		return pools.filter(
			(pool) =>
				pool.pool.fields.coins.includes(coinIn) &&
				pool.pool.fields.coins.includes(coinOut)
		);
	};

	private static createPaths = (
		pools: Pool[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): RouterPaths => {
		const coinInPartitionAmount =
			coinInAmount / Router.constants.tradePartitionCount;
		const coinInRemainderAmount =
			coinInAmount % Router.constants.tradePartitionCount;

		let currentPools = pools;
		let currentPaths = Router.createEmptyPaths(
			pools.map((pool) => pool.pool.objectId)
		);

		const emptyArray = Array(
			Number(Router.constants.tradePartitionCount) + 1
		).fill(undefined);

		for (const i of emptyArray) {
			const { pools: updatedPools, paths: updatedPaths } =
				Router.findNextPathAndUpdatePoolsAndPaths(
					currentPools,
					currentPaths,
					coinIn,
					i === 0 ? coinInRemainderAmount : coinInPartitionAmount,
					coinOut
				);

			currentPools = updatedPools;
			currentPaths = updatedPaths;
		}

		return currentPaths;
	};

	private static findNextPathAndUpdatePoolsAndPaths = (
		pools: Pool[],
		paths: RouterPaths,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	) => {
		const indexOfBestPool = Router.indexOfBestPoolForTrade(
			pools,
			coinIn,
			coinInAmount,
			coinOut
		);

		const bestPool = pools[indexOfBestPool];
		const { pool: updatedPool, coinOutAmount } =
			Router.getUpdatedPoolAndAmountOutAfterTrade(
				bestPool,
				coinIn,
				coinInAmount,
				coinOut
			);

		let newPools = [...pools];
		newPools[indexOfBestPool] = updatedPool;

		const newPaths: RouterPaths = {
			...paths,
			[bestPool.pool.objectId]: {
				...paths[bestPool.pool.objectId],
				coinInAmount:
					paths[bestPool.pool.objectId].coinInAmount + coinInAmount,
				coinOutAmount:
					paths[bestPool.pool.objectId].coinOutAmount + coinOutAmount,
				spotPrice: bestPool.getSpotPrice(coinIn, coinOut),
				tradeFee: bestPool.pool.fields.tradeFee,
			},
		};

		return {
			pools: newPools,
			paths: newPaths,
		};
	};

	private static createEmptyPaths = (
		poolObjectIds: ObjectId[]
	): RouterPaths => {
		let emptyPaths: RouterPaths = poolObjectIds.reduce((acc, cur) => {
			return {
				...acc,
				[cur]: {
					coinInAmount: 0,
					coinOutAmount: 0,
					spotPrice: -1,
					tradeFee: BigInt(-1),
				},
			};
		}, {});

		return { ...emptyPaths };
	};

	private static completeRouteFromPaths = (
		paths: RouterPaths,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): RouterCompleteRoute => {
		const coinOutAmount = Object.values(paths).reduce(
			(acc, cur) => acc + cur.coinOutAmount,
			BigInt(0)
		);

		const spotPrice =
			Object.values(paths).reduce((acc, cur) => acc + cur.spotPrice, 0) /
			Object.keys(paths).length;

		const tradeFee =
			Object.values(paths).reduce(
				(acc, cur) => acc + cur.tradeFee,
				BigInt(0)
			) / BigInt(Object.keys(paths).length);

		return {
			coinIn,
			coinOut,
			coinInAmount,
			coinOutAmount,
			spotPrice,
			tradeFee,
			paths,
		};
	};
}
