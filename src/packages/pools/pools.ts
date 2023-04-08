import { ObjectId } from "@mysten/sui.js";
import {
	ApiEventsBody,
	ApiPoolObjectIdForLpCoinTypeBody,
	Balance,
	CoinType,
	EventsWithCursor,
	PoolDepositEvent,
	PoolObject,
	PoolTradeEvent,
	PoolTradeFee,
	PoolWeight,
	PoolWithdrawEvent,
	Slippage,
	SuiNetwork,
} from "../../types";
import { Pool } from "./pool";
import { Coin } from "../../packages/coin/coin";
import { Helpers } from "../../general/utils/helpers";
import { Caller } from "../../general/utils/caller";

export class Pools extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		lpCoinDecimals: 9,
		coinWeightDecimals: 18,
		spotPriceDecimals: 18,
		tradeFeeDecimals: 18,
		slippageDecimals: 18,
		maxTradeFee: BigInt(1000000000000000000),
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "pools");
	}

	/////////////////////////////////////////////////////////////////////
	//// Class Objects
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Pool Class
	/////////////////////////////////////////////////////////////////////

	public async getPool(inputs: { objectId: ObjectId }): Promise<Pool> {
		const pool = await this.fetchApi<PoolObject>(`${inputs.objectId}`);
		return new Pool(pool, this.network);
	}

	public async getPools(inputs: { objectIds: ObjectId[] }): Promise<Pool[]> {
		const pools = await Promise.all(
			inputs.objectIds.map((objectId) => this.getPool({ objectId }))
		);
		return pools;
	}

	public async getAllPools(): Promise<Pool[]> {
		const pools = await this.fetchApi<PoolObject[]>("");
		return pools.map((pool) => new Pool(pool, this.network));
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getDepositEvents(
		inputs: ApiEventsBody
	): Promise<EventsWithCursor<PoolDepositEvent>> {
		return this.fetchApi<EventsWithCursor<PoolDepositEvent>, ApiEventsBody>(
			"events/deposit",
			inputs
		);
	}

	public async getWithdrawEvents(
		inputs: ApiEventsBody
	): Promise<EventsWithCursor<PoolWithdrawEvent>> {
		return this.fetchApi<
			EventsWithCursor<PoolWithdrawEvent>,
			ApiEventsBody
		>("events/withdraw", inputs);
	}

	public async getTradeEvents(
		inputs: ApiEventsBody
	): Promise<EventsWithCursor<PoolTradeEvent>> {
		return this.fetchApi<EventsWithCursor<PoolTradeEvent>, ApiEventsBody>(
			"events/trade",
			inputs
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public getPoolObjectIdForLpCoinType = (
		inputs: ApiPoolObjectIdForLpCoinTypeBody
	) => {
		return this.fetchApi<ObjectId, ApiPoolObjectIdForLpCoinTypeBody>(
			"poolObjectId",
			inputs
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Conversions
	/////////////////////////////////////////////////////////////////////

	public static coinWeightWithDecimals = (weight: PoolWeight) =>
		Number(weight) / 10 ** Pools.constants.coinWeightDecimals;

	public static spotPriceWithDecimals = (spotPrice: Balance) =>
		Number(spotPrice) / 10 ** Pools.constants.spotPriceDecimals;

	public static tradeFeeWithDecimals = (tradeFee: PoolTradeFee) =>
		Number(tradeFee) / 10 ** Pools.constants.tradeFeeDecimals;

	public static normalizeLpCoinBalance = (balance: number) =>
		Coin.normalizeBalance(balance, Pools.constants.lpCoinDecimals);

	public static lpCoinBalanceWithDecimals = (balance: Balance) =>
		Number(balance) / 10 ** Pools.constants.lpCoinDecimals;

	public static normalizeSlippage = (slippage: Slippage) =>
		Coin.normalizeBalance(slippage, Pools.constants.slippageDecimals);

	/////////////////////////////////////////////////////////////////////
	//// Display
	/////////////////////////////////////////////////////////////////////

	public static displayLpCoinType = (lpCoinType: CoinType): string =>
		new Coin(Coin.coinTypeFromKeyType(lpCoinType)).coinTypeSymbol
			.toLowerCase()
			.replace("af_lp_", "")
			.split("_")
			.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
			.join(" ") + " LP";
}
