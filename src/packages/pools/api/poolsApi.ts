import { EventId, ObjectId, SuiAddress, SuiObject } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { PoolsApiHelpers } from "./poolsApiHelpers";
import { CoinType, CoinsToBalance } from "../../coin/coinTypes";
import {
	Balance,
	PoolVolumeDataTimeframeKey,
	PoolDepositEvent,
	PoolDynamicFields,
	PoolObject,
	PoolStats,
	PoolTradeEvent,
	PoolWithdrawEvent,
} from "../../../types";
import { Casting } from "../../../general/utils/casting";
import { Coin } from "../../coin/coin";
import {
	PoolCreateEventOnChain,
	PoolDepositEventOnChain,
	PoolDynamicFieldOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { PoolsApiCasting } from "./poolsApiCasting";
import { Pools } from "../pools";

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
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSpotPrice = async (
		poolId: ObjectId,
		lpCoinType: CoinType,
		coinInType: CoinType,
		coinOutType: CoinType
	): Promise<Balance> => {
		const moveCallTransaction = this.Helpers.spotPriceMoveCall(
			poolId,
			coinInType,
			coinOutType,
			lpCoinType
		);
		const bytes =
			await this.Provider.Inspections().fetchBytesFromTransaction(
				moveCallTransaction
			);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchTradeAmountOut = async (
		poolId: ObjectId,
		coinInType: CoinType,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		coinInBalance: Balance
	) => {
		const moveCallTransaction = this.Helpers.tradeAmountOutMoveCall(
			poolId,
			coinInType,
			coinOutType,
			lpCoinType,
			coinInBalance
		);
		const bytes =
			await this.Provider.Inspections().fetchBytesFromTransaction(
				moveCallTransaction
			);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchDepositLpMintAmount = async (
		poolId: ObjectId,
		lpCoinType: CoinType,
		depositCoinsToBalance: CoinsToBalance
	) => {
		const { coins, balances } = Coin.coinsAndBalancesOverZero(
			depositCoinsToBalance
		);
		const moveCallTransaction = this.Helpers.depositLpMintAmountMoveCall(
			poolId,
			lpCoinType,
			coins,
			balances
		);
		const bytes =
			await this.Provider.Inspections().fetchBytesFromTransaction(
				moveCallTransaction
			);
		return Casting.bigIntFromBytes(bytes);
	};

	public fetchWithdrawAmountOut = async (
		poolId: ObjectId,
		lpCoinType: CoinType,
		withdrawCoinsToBalance: CoinsToBalance
	) => {
		const { coins, balances } = Coin.coinsAndBalancesOverZero(
			withdrawCoinsToBalance
		);
		const moveCallTransaction = this.Helpers.withdrawAmountOutMoveCall(
			poolId,
			lpCoinType,
			coins,
			balances
		);
		const bytes =
			await this.Provider.Inspections().fetchBytesFromTransaction(
				moveCallTransaction
			);
		return Casting.bigIntFromBytes(bytes);
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchTradeEvents = async (cursor?: EventId, eventLimit?: number) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolTradeEventOnChain,
			PoolTradeEvent
		>(
			{
				MoveEvent: this.Helpers.eventTypes.trade,
			},
			PoolsApiCasting.poolTradeEventFromOnChain,
			cursor,
			eventLimit
		);

	// NOTE: the below functions can be used if we want to only look at single events

	// const fetchSingleDepositEvents = async (
	// 	cursor?: EventId,
	// 	eventLimit?: number
	// ) =>
	// 	await fetchCastEventsWithCursor<
	// 		PoolSingleDepositEventOnChain,
	// 		PoolSingleDepositEvent
	// 	>(
	// 		{
	// 			MoveEvent: `${config.indices.packages.pools}::events::SingleAssetDepositEvent`,
	// 		},
	// 		poolSingleDepositEventFromOnChain,
	// 		cursor,
	// 		eventLimit
	// 	);

	public fetchDepositEvents = async (cursor?: EventId, eventLimit?: number) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolDepositEventOnChain,
			PoolDepositEvent
		>(
			{
				MoveEvent: this.Helpers.eventTypes.deposit,
			},
			PoolsApiCasting.poolDepositEventFromOnChain,
			cursor,
			eventLimit
		);

	// const fetchSingleWithdrawEvents = async (
	// 	cursor?: EventId,
	// 	eventLimit?: number
	// ) =>
	// 	await fetchCastEventsWithCursor<
	// 		PoolSingleWithdrawEventOnChain,
	// 		PoolSingleWithdrawEvent
	// 	>(
	// 		{
	// 			MoveEvent: `${config.indices.packages.pools}::events::SingleAssetWithdrawEvent`,
	// 		},
	// 		poolSingleWithdrawEventFromOnChain,
	// 		cursor,
	// 		eventLimit
	// 	);

	public fetchWithdrawEvents = async (
		cursor?: EventId,
		eventLimit?: number
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolWithdrawEventOnChain,
			PoolWithdrawEvent
		>(
			{
				MoveEvent: this.Helpers.eventTypes.withdraw,
			},
			PoolsApiCasting.poolWithdrawEventFromOnChain,
			cursor,
			eventLimit
		);

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchPool = async (objectId: ObjectId) => {
		const object = await this.Provider.provider.getObject(objectId);
		if (object.status !== "Exists")
			throw new Error("pool object does not exist");

		const poolObject = PoolsApiCasting.poolObjectFromSuiObject(
			object.details as SuiObject
		);
		return poolObject;
	};

	public fetchPools = async (objectIds: ObjectId[]) => {
		const objects = await this.Provider.Objects().fetchObjectBatch(
			objectIds
		);
		const poolObjects = objects.map((data) =>
			PoolsApiCasting.poolObjectFromSuiObject(data.details as SuiObject)
		);
		return poolObjects;
	};

	public fetchAllPools = async () => {
		const paginatedEvents = await this.Provider.provider.getEvents(
			{
				MoveEvent: `${this.Helpers.addresses.packages.cmmm}::events::CreatedPoolEvent`,
			}, // query
			null, // cursor
			null, // limit
			"ascending" // order
		);

		let poolObjects: PoolObject[] = [];

		for (const SuiEvent of paginatedEvents.data) {
			const event = SuiEvent.event;
			if (!("moveEvent" in event)) continue;

			const createEvent = event.moveEvent as PoolCreateEventOnChain;

			poolObjects.push(
				PoolsApiCasting.poolObjectFromPoolCreateEventOnChain(
					createEvent
				)
			);
		}

		return poolObjects;
	};

	public fetchPoolDynamicFields = async (poolId: ObjectId) => {
		const allDynamicFields =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType(
				poolId
			);
		const objectIds = allDynamicFields.map((field) => field.objectId);

		const dynamicFieldsAsSuiObjects =
			await this.Provider.Objects().fetchObjectBatch(objectIds);
		const dynamicFieldsOnChain = dynamicFieldsAsSuiObjects.map(
			(dynamicField) =>
				dynamicField.details as SuiObject as PoolDynamicFieldOnChain<any>
		);

		const lpFields = dynamicFieldsOnChain
			.filter((field) => Pools.isLpKeyType(field.data.type))
			.map((field) =>
				PoolsApiCasting.poolLpDynamicFieldFromOnChain(field)
			);

		const amountFields = dynamicFieldsOnChain
			.filter((field) => Pools.isAmountKeyType(field.data.type))
			.map((field) =>
				PoolsApiCasting.poolAmountDynamicFieldFromOnChain(field)
			);

		return {
			lpFields,
			amountFields,
		} as PoolDynamicFields;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchDepositTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		depositCoinsToBalance: CoinsToBalance
	) => {
		const { coins, balances } = Coin.coinsAndBalancesOverZero(
			depositCoinsToBalance
		);
		const transactions = await this.Helpers.fetchBuildDepositTransactions(
			walletAddress,
			poolObjectId,
			poolLpType,
			coins,
			balances
		);
		return transactions;
	};

	public fetchWithdrawTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		withdrawCoinsToBalance: CoinsToBalance,
		withdrawLpTotal: Balance
	) => {
		const { coins, balances } = Coin.coinsAndBalancesOverZero(
			withdrawCoinsToBalance
		);
		const transactions = await this.Helpers.fetchBuildWithdrawTransactions(
			walletAddress,
			poolObjectId,
			poolLpType,
			withdrawLpTotal,
			coins,
			balances
		);
		return transactions;
	};

	public fetchTradeTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		fromCoin: CoinType,
		fromCoinBalance: Balance,
		toCoinType: CoinType
	) => {
		const transactions = await this.Helpers.fetchBuildTradeTransactions(
			walletAddress,
			poolObjectId,
			poolLpType,
			fromCoin,
			fromCoinBalance,
			toCoinType
		);
		return transactions;
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// TODO: use promise.all to execute some of this fetching in parallel
	public fetchPoolStats = async (
		poolObjectId: ObjectId
	): Promise<PoolStats> => {
		const pool = await this.fetchPool(poolObjectId);
		const poolCoins = pool.fields.coins;

		const prices = await this.Provider.Prices().fetchPrices(poolCoins);
		const coinsToDecimals =
			await this.Provider.Coin().Helpers.fetchCoinsToDecimals(poolCoins);

		const tradeEventsWithinTime =
			await this.Provider.Events().fetchEventsWithinTime(
				this.fetchTradeEvents,
				"hour",
				24
			);
		const volume = this.Helpers.fetchCalcPoolVolume(
			poolObjectId,
			poolCoins,
			tradeEventsWithinTime,
			prices,
			coinsToDecimals
		);

		const fetchedDynamicFields = await this.fetchPoolDynamicFields(
			poolObjectId
		);

		const dynamicFields = Pools.sortDynamicFieldsToMatchPoolCoinOrdering(
			fetchedDynamicFields,
			pool
		);

		const tvl = await this.Helpers.fetchCalcPoolTvl(
			dynamicFields,
			prices,
			coinsToDecimals
		);
		const supplyPerLps = this.Helpers.calcPoolSupplyPerLps(dynamicFields);
		const lpPrice = this.Helpers.calcPoolLpPrice(dynamicFields, tvl);

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

	public fetchLpCoinPrices = async (lpCoins: CoinType[]) => {
		const pools = await this.fetchAllPools();

		let lpPrices: number[] = [];
		for (const lpCoin of lpCoins) {
			const lpPool = Pools.findPoolForLpCoin(lpCoin, pools);
			if (!lpPool) throw Error("no pool found for given lp coin type");

			const poolStats = await this.fetchPoolStats(lpPool.objectId);
			lpPrices.push(poolStats.lpPrice);
		}

		return lpPrices;
	};

	// TODO: make this faster this is slow as shit when LP balances are involved...
	// (so much fetching!)
	// TODO: rename this function and/or move it ?
	public fetchAllCoinPrices = async (coins: CoinType[]) => {
		try {
			const lpCoins = coins.filter((coin) => Pools.isLpCoin(coin));
			const nonLpCoins = coins.filter((coin) => !Pools.isLpCoin(coin));

			const lpPrices =
				lpCoins.length > 0 ? await this.fetchLpCoinPrices(lpCoins) : [];
			const nonLpPrices =
				nonLpCoins.length > 0
					? await this.Provider.Prices().fetchPrices(nonLpCoins)
					: [];

			let prices: number[] = [];
			for (const coin of coins) {
				prices.push(
					this.Helpers.findPriceForCoinInPool(
						coin,
						lpCoins,
						nonLpCoins,
						lpPrices,
						nonLpPrices
					)
				);
			}
			return prices;
		} catch (e) {
			console.error(e);
			throw new Error();
		}
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
