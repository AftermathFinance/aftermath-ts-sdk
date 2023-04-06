import { ObjectId } from "@mysten/sui.js";
import {
	ApiEventsBody,
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

	public async getPool(poolObjectId: ObjectId): Promise<Pool> {
		const pool = await this.fetchApi<PoolObject>(`${poolObjectId}`);
		return new Pool(pool, this.network);
	}

	public async getPools(poolObjectIds: ObjectId[]): Promise<Pool[]> {
		const pools = await Promise.all(poolObjectIds.map(this.getPool));
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
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static findPoolForLpCoin = (lpCoin: CoinType, pools: Pool[]) =>
		pools.find((pool) => {
			return pool.pool.lpCoinType.includes(
				new Coin(new Coin(lpCoin).innerCoinType).coinTypeSymbol
			);
		});

	/////////////////////////////////////////////////////////////////////
	//// Type Checking
	/////////////////////////////////////////////////////////////////////

	// remove this once all LP coins have coin metadata ?
	public static isLpCoin = (coin: CoinType) => {
		// return coin.includes(poolsPackageId);
		return coin.includes("AF_LP_");
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

	public static normalizeLpCoinType = (lpCoinType: CoinType) => {
		return `0x${lpCoinType.replaceAll("<", "<0x")}`;
	};

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
