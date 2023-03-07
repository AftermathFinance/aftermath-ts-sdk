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
import { CastingApiHelpers } from "../../../general/api/castingApiHelpers";
import { InspectionsApiHelpers } from "../../../general/api/inspectionsApiHelpers";
import { Coin } from "../../coin/coin";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import {
	PoolCreateEventOnChain,
	PoolDepositEventOnChain,
	PoolDynamicFieldOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsCastingTypes";
import { PoolsApiCasting } from "./poolsApiCasting";
import { DynamicFieldsApiHelpers } from "../../../general/api/dynamicFieldsApiHelpers";
import { ObjectsApiHelpers } from "../../../general/api/objectsApiHelpers";
import { Pools } from "../pools";

export class PoolsApi extends PoolsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private inspectionsApiHelpers: InspectionsApiHelpers;
	private eventsApiHelpers: EventsApiHelpers;
	private dynamicFieldsApiHelpers: DynamicFieldsApiHelpers;
	private objectsApiHelpers: ObjectsApiHelpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(rpcProvider: AftermathApi) {
		super(rpcProvider);

		this.inspectionsApiHelpers = new InspectionsApiHelpers(rpcProvider);
		this.eventsApiHelpers = new EventsApiHelpers(rpcProvider);
		this.dynamicFieldsApiHelpers = new DynamicFieldsApiHelpers(rpcProvider);
		this.objectsApiHelpers = new ObjectsApiHelpers(rpcProvider);
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
		const moveCallTransaction = this.spotPriceMoveCall(
			poolId,
			coinInType,
			coinOutType,
			lpCoinType
		);
		const bytes =
			await this.inspectionsApiHelpers.fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return CastingApiHelpers.bigIntFromBytes(bytes);
	};

	public fetchTradeAmountOut = async (
		poolId: ObjectId,
		coinInType: CoinType,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		coinInBalance: Balance
	) => {
		const moveCallTransaction = this.tradeAmountOutMoveCall(
			poolId,
			coinInType,
			coinOutType,
			lpCoinType,
			coinInBalance
		);
		const bytes =
			await this.inspectionsApiHelpers.fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return CastingApiHelpers.bigIntFromBytes(bytes);
	};

	public fetchDepositLpMintAmount = async (
		poolId: ObjectId,
		lpCoinType: CoinType,
		depositCoinsToBalance: CoinsToBalance
	) => {
		const { coins, balances } = Coin.coinsAndBalancesOverZero(
			depositCoinsToBalance
		);
		const moveCallTransaction = this.depositLpMintAmountMoveCall(
			poolId,
			lpCoinType,
			coins,
			balances
		);
		const bytes =
			await this.inspectionsApiHelpers.fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return CastingApiHelpers.bigIntFromBytes(bytes);
	};

	public fetchWithdrawAmountOut = async (
		poolId: ObjectId,
		lpCoinType: CoinType,
		withdrawCoinsToBalance: CoinsToBalance
	) => {
		const { coins, balances } = Coin.coinsAndBalancesOverZero(
			withdrawCoinsToBalance
		);
		const moveCallTransaction = this.withdrawAmountOutMoveCall(
			poolId,
			lpCoinType,
			coins,
			balances
		);
		const bytes =
			await this.inspectionsApiHelpers.fetchBytesFromMoveCallTransaction(
				moveCallTransaction
			);
		return CastingApiHelpers.bigIntFromBytes(bytes);
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public fetchTradeEvents = async (cursor?: EventId, eventLimit?: number) =>
		await this.eventsApiHelpers.fetchCastEventsWithCursor<
			PoolTradeEventOnChain,
			PoolTradeEvent
		>(
			{
				MoveEvent: this.tradeEventType(),
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
		await this.eventsApiHelpers.fetchCastEventsWithCursor<
			PoolDepositEventOnChain,
			PoolDepositEvent
		>(
			{
				MoveEvent: this.depositEventType(),
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
		await this.eventsApiHelpers.fetchCastEventsWithCursor<
			PoolWithdrawEventOnChain,
			PoolWithdrawEvent
		>(
			{
				MoveEvent: this.withdrawEventType(),
			},
			PoolsApiCasting.poolWithdrawEventFromOnChain,
			cursor,
			eventLimit
		);

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchPool = async (objectId: ObjectId) => {
		const object = await this.rpcProvider.provider.getObject(objectId);
		if (object.status !== "Exists")
			throw new Error("pool object does not exist");

		const poolObject = PoolsApiCasting.poolObjectFromSuiObject(
			object.details as SuiObject
		);
		return poolObject;
	};

	public fetchPools = async (objectIds: ObjectId[]) => {
		const objects = await this.objectsApiHelpers.fetchObjectBatch(
			objectIds
		);
		const poolObjects = objects.map((data) =>
			PoolsApiCasting.poolObjectFromSuiObject(data.details as SuiObject)
		);
		return poolObjects;
	};

	public fetchAllPools = async () => {
		const paginatedEvents = await this.rpcProvider.provider.getEvents(
			{
				MoveEvent: `${this.poolsAddresses.packages.cmmm}::events::CreatedPoolEvent`,
			}, // query
			null, // cursor
			null, // limit
			"ascending" // order
		);

		let poolObjects: PoolObject[] = [];

		for (const suiEventEnvelope of paginatedEvents.data) {
			const event = suiEventEnvelope.event;
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
			await this.dynamicFieldsApiHelpers.fetchAllDynamicFieldsOfType(
				poolId
			);
		const objectIds = allDynamicFields.map((field) => field.objectId);

		const dynamicFieldsAsSuiObjects =
			await this.objectsApiHelpers.fetchObjectBatch(objectIds);
		const dynamicFieldsOnChain = dynamicFieldsAsSuiObjects.map(
			(dynamicField) =>
				dynamicField.details as SuiObject as PoolDynamicFieldOnChain
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
		const transactions = await this.fetchBuildDepositTransactions(
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
		const transactions = await this.fetchBuildWithdrawTransactions(
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
		const transactions = await this.fetchBuildTradeTransactions(
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

		const prices = await fetchPythPrices(poolCoins);
		const coinsToDecimals = await this.coinApiHelpers.fetchCoinsToDecimals(
			poolCoins
		);

		const swapEventsWithinTime =
			await this.eventsApiHelpers.fetchEventsWithinTime(
				this.fetchTradeEvents,
				"hour",
				24
			);
		const volume = this.fetchCalcPoolVolume(
			poolObjectId,
			poolCoins,
			swapEventsWithinTime,
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

		const tvl = await this.fetchCalcPoolTvl(
			dynamicFields,
			prices,
			coinsToDecimals
		);
		const supplyPerLps = this.calcPoolSupplyPerLps(dynamicFields);
		const lpPrice = this.calcPoolLpPrice(dynamicFields, tvl);

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
				nonLpCoins.length > 0 ? await fetchPythPrices(nonLpCoins) : [];

			let prices: number[] = [];
			for (const coin of coins) {
				prices.push(
					this.findPriceForCoinInPool(
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
		const timeframeValue = this.poolVolumeDataTimeframes[timeframe];

		const [pool, tradeEvents] = await Promise.all([
			this.fetchPool(poolObjectId),
			(
				await this.eventsApiHelpers.fetchEventsWithinTime(
					this.fetchTradeEvents,
					timeframeValue.timeUnit,
					timeframeValue.time
				)
			).filter((swap) => swap.poolId === poolObjectId),
		]);

		return await this.fetchCalcPoolVolumeData(
			pool,
			tradeEvents,
			timeframeValue.timeUnit,
			timeframeValue.time,
			timeframeValue.time
		);
	};
}
