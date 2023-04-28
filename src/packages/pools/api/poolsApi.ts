import { EventId, ObjectId, SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { PoolsApiHelpers } from "./poolsApiHelpers";
import { CoinType, CoinsToBalance, CoinsToPrice } from "../../coin/coinTypes";
import {
	Balance,
	PoolVolumeDataTimeframeKey,
	PoolDepositEvent,
	PoolStats,
	PoolTradeEvent,
	PoolWithdrawEvent,
	SerializedTransaction,
	Slippage,
	PoolCreationLpCoinMetadata,
	PoolCreationCoinInfo,
	PoolName,
	PoolFlatness,
	PoolWeight,
	PoolTradeFee,
} from "../../../types";
import {
	PoolCreateEventOnChain,
	PoolDepositEventOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { Casting } from "../../../general/utils/casting";
import { Pool } from "..";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Aftermath } from "../../../general/providers";

export class PoolsApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new PoolsApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchTradeEvents = async (
		cursor?: EventId,
		limit?: number
		// poolObjectId?: ObjectId
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolTradeEventOnChain,
			PoolTradeEvent
		>(
			// poolObjectId
			// 	? {
			// 			And: [
			// 				{ MoveEventType: this.Helpers.eventTypes.trade },
			// 				{
			// 					MoveEventField: {
			// 						path: "pool_id",
			// 						value: poolObjectId,
			// 					},
			// 				},
			// 			],
			// 	  }
			// 	: { MoveEventType: this.Helpers.eventTypes.trade },
			{ MoveEventType: this.Helpers.eventTypes.trade },
			Casting.pools.poolTradeEventFromOnChain,
			cursor,
			limit
		);

	public fetchDepositEvents = async (
		cursor?: EventId,
		limit?: number
		// poolObjectId?: ObjectId
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolDepositEventOnChain,
			PoolDepositEvent
		>(
			// poolObjectId
			// 	? {
			// 			And: [
			// 				{ MoveEventType: this.Helpers.eventTypes.deposit },
			// 				{
			// 					MoveEventField: {
			// 						path: "pool_id",
			// 						value: poolObjectId,
			// 					},
			// 				},
			// 			],
			// 	  }
			// 	: { MoveEventType: this.Helpers.eventTypes.deposit },
			{ MoveEventType: this.Helpers.eventTypes.deposit },
			Casting.pools.poolDepositEventFromOnChain,
			cursor,
			limit
		);

	public fetchWithdrawEvents = async (
		cursor?: EventId,
		limit?: number
		// poolObjectId?: ObjectId
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolWithdrawEventOnChain,
			PoolWithdrawEvent
		>(
			// poolObjectId
			// 	? {
			// 			And: [
			// 				{ MoveEventType: this.Helpers.eventTypes.withdraw },
			// 				{
			// 					MoveEventField: {
			// 						path: "pool_id",
			// 						value: poolObjectId,
			// 					},
			// 				},
			// 			],
			// 	  }
			// 	: { MoveEventType: this.Helpers.eventTypes.withdraw },
			{ MoveEventType: this.Helpers.eventTypes.withdraw },
			Casting.pools.poolWithdrawEventFromOnChain,
			cursor,
			limit
		);

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchPool = async (objectId: ObjectId) => {
		return this.Provider.Objects().fetchCastObject(
			objectId,
			Casting.pools.poolObjectFromSuiObject
		);
	};

	public fetchPools = async (objectIds: ObjectId[]) => {
		return this.Provider.Objects().fetchCastObjectBatch(
			objectIds,
			Casting.pools.poolObjectFromSuiObject
		);
	};

	public fetchAllPools = async () => {
		const poolObjectIds = await this.Helpers.fetchAllPoolObjectIds();
		return this.fetchPools(poolObjectIds);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchDepositTransaction = async (
		walletAddress: SuiAddress,
		pool: Pool,
		depositCoinsToBalance: CoinsToBalance,
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<SerializedTransaction> => {
		const transaction = await this.Helpers.fetchBuildDepositTransaction(
			walletAddress,
			pool,
			depositCoinsToBalance,
			slippage,
			referrer
		);
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			transaction
		);
	};

	public fetchWithdrawTransaction = async (
		walletAddress: SuiAddress,
		pool: Pool,
		withdrawCoinsToBalance: CoinsToBalance,
		lpCoinAmount: Balance,
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<SerializedTransaction> => {
		const transaction = await this.Helpers.fetchBuildWithdrawTransaction(
			walletAddress,
			pool,
			withdrawCoinsToBalance,
			lpCoinAmount,
			slippage,
			referrer
		);
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			transaction
		);
	};

	public fetchTradeTransaction = async (
		walletAddress: SuiAddress,
		pool: Pool,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOutType: CoinType,
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<SerializedTransaction> => {
		const transaction = await this.Helpers.fetchBuildTradeTransaction(
			walletAddress,
			pool,
			coinIn,
			coinInAmount,
			coinOutType,
			slippage,
			referrer
		);
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			transaction
		);
	};

	public publishLpCoinTransaction = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.buildPublishLpCoinTransaction(inputs)
		);
	};

	public fetchCreatePoolTransaction = async (inputs: {
		walletAddress: SuiAddress;
		lpCoinType: CoinType;
		lpCoinMetadata: PoolCreationLpCoinMetadata;
		coinsInfo: {
			coinId: ObjectId;
			coinType: CoinType;
			weight: number;
			tradeFeeIn: number;
		}[];
		poolName: PoolName;
		poolFlatness: 0 | 1;
		createPoolCapId?: ObjectId;
	}): Promise<SerializedTransaction> => {
		// NOTE: these are temp defaults down below since some selections are currently disabled in contracts
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildCreatePoolTransaction({
				...inputs,

				poolFlatness:
					inputs.poolFlatness === 1
						? Casting.fixedOneBigInt
						: BigInt(0),

				coinsInfo: inputs.coinsInfo.map((info) => {
					return {
						...info,
						weight: Casting.numberToFixedBigInt(info.weight),
						tradeFeeIn: Casting.numberToFixedBigInt(
							info.tradeFeeIn
						),
						depositFee: BigInt(0),
						withdrawFee: BigInt(0),
						tradeFeeOut: BigInt(0),
					};
				}),
			})
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchPoolObjectIdForLpCoinType = async (
		lpCoinType: CoinType
	): Promise<ObjectId> => {
		const tx =
			this.Helpers.poolObjectIdForLpCoinTypeDevInspectTransaction(
				lpCoinType
			);

		const bytes =
			await this.Provider.Inspections().fetchBytesFromTransaction(tx);

		return Casting.addressFromBytes(bytes);
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// TODO: use promise.all to execute some of this fetching in parallel
	public fetchPoolStats = async (
		pool: Pool,
		coinsToPrice: CoinsToPrice
	): Promise<PoolStats> => {
		const poolCoins = pool.pool.coins;
		const poolCoinTypes = Object.keys(poolCoins);

		// TODO: move this outside of func to be called externally via provider in api ?
		const coinsToDecimals =
			await this.Provider.Coin().Helpers.fetchCoinsToDecimals(
				poolCoinTypes
			);

		// PRODUCTION: remove all notions of sdk from api functions !

		const tradeEventsWithinTime =
			await this.Provider.Events().fetchEventsWithinTime(
				(cursor, limit) =>
					pool.getTradeEvents({
						cursor,
						limit,
					}),
				"hour",
				24
			);

		const volume = this.Helpers.fetchCalcPoolVolume(
			tradeEventsWithinTime,
			coinsToPrice,
			coinsToDecimals
		);

		const tvl = await this.Helpers.fetchCalcPoolTvl(
			pool.pool.coins,
			coinsToPrice,
			coinsToDecimals
		);
		const supplyPerLps = this.Helpers.calcPoolSupplyPerLps(
			poolCoins,
			pool.pool.lpCoinSupply
		);
		const lpPrice = this.Helpers.calcPoolLpPrice(
			pool.pool.lpCoinSupply,
			tvl
		);

		return {
			volume,
			tvl,
			supplyPerLps,
			lpPrice,
			// TODO: perform actual calculations for these values
			fees: 523.32,
			aprRange: [13.22, 16.73],
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Prices
	/////////////////////////////////////////////////////////////////////

	// TODO: make this faster this is slow as shit when LP balances are involved...
	// (so much fetching!)
	// TODO: rename this function and/or move it ?
	public fetchLpCoinsToPrice = async (
		provider: Aftermath,
		lpCoins: CoinType[]
	) => {
		// PRODUCTION: remove all notions of sdk from api functions !

		const lpCoinPoolObjectIds = await Promise.all(
			lpCoins.map((lpCoinType) =>
				provider.Pools().getPoolObjectIdForLpCoinType({ lpCoinType })
			)
		);
		const lpCoinPools = await provider
			.Pools()
			.getPools({ objectIds: lpCoinPoolObjectIds });

		const poolStats = await Promise.all(
			lpCoinPools.map((lpPool) => lpPool.getStats())
		);

		let lpCoinsToPrice: CoinsToPrice = {};

		for (const [index, lpCoin] of lpCoins.entries()) {
			const stats = poolStats[index];
			lpCoinsToPrice = {
				...lpCoinsToPrice,
				[lpCoin]: stats.lpPrice,
			};
		}

		return lpCoinsToPrice;
	};

	/////////////////////////////////////////////////////////////////////
	//// Graph Data
	/////////////////////////////////////////////////////////////////////

	public fetchPoolVolumeData = async (
		poolObjectId: ObjectId,
		timeframe: PoolVolumeDataTimeframeKey
	) => {
		const timeframeValue = this.Helpers.poolVolumeDataTimeframes[timeframe];

		const [pool, tradeEvents] = await Promise.all([
			this.fetchPool(poolObjectId),
			(
				await this.Provider.Events().fetchEventsWithinTime(
					// TODO: fetch only pool's events
					this.fetchTradeEvents,
					timeframeValue.timeUnit,
					timeframeValue.time
				)
			).filter((trade) => trade.poolId === poolObjectId),
		]);

		return await this.Helpers.fetchCalcPoolVolumeData(
			pool,
			tradeEvents,
			timeframeValue.timeUnit,
			timeframeValue.time,
			timeframeValue.time
		);
	};
}
