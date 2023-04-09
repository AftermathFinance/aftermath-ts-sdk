import { TransactionBlock } from "@mysten/sui.js";
import {
	ApiPoolDepositBody,
	ApiPoolTradeBody,
	ApiPoolWithdrawBody,
	Balance,
	CoinType,
	CoinsToBalance,
	PoolDataPoint,
	PoolVolumeDataTimeframeKey,
	PoolObject,
	PoolStats,
	SuiNetwork,
	SerializedTransaction,
	ApiEventsBody,
	EventsWithCursor,
	PoolDepositEvent,
	PoolWithdrawEvent,
	PoolTradeEvent,
} from "../../types";
import { CmmmCalculations } from "./utils/cmmmCalculations";
import { Caller } from "../../general/utils/caller";

export class Pool extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Public Class Members
	/////////////////////////////////////////////////////////////////////

	public stats: PoolStats | undefined;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly pool: PoolObject,
		public readonly network?: SuiNetwork
	) {
		super(network, `pools/${pool.objectId}`);
		this.pool = pool;
	}

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	public async getStats(): Promise<PoolStats> {
		const stats = await this.fetchApi<PoolStats>("stats");
		this.stats = stats;
		return stats;
	}

	public setStats(stats: PoolStats) {
		this.stats = stats;
	}

	public async getVolume(inputs: {
		timeframe: PoolVolumeDataTimeframeKey;
	}): Promise<PoolDataPoint[]> {
		return this.fetchApi(`volume/${inputs.timeframe}`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getDepositTransaction(
		inputs: ApiPoolDepositBody
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, ApiPoolDepositBody>(
				"transactions/deposit",
				inputs
			)
		);
	}

	public async getWithdrawTransaction(
		inputs: ApiPoolWithdrawBody
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, ApiPoolWithdrawBody>(
				"transactions/withdraw",
				inputs
			)
		);
	}

	public async getTradeTransaction(
		inputs: ApiPoolTradeBody
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, ApiPoolTradeBody>(
				"transactions/trade",
				inputs
			)
		);
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
	//// Calculations
	/////////////////////////////////////////////////////////////////////

	public getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
	}) => {
		return BigInt(
			Math.floor(
				CmmmCalculations.calc_out_given_in(
					this.pool,
					inputs.coinInType,
					inputs.coinOutType,
					Number(inputs.coinInAmount)
				)
			)
		);
	};

	public getTradeAmountIn = (inputs: {
		coinOutType: CoinType;
		coinOutAmount: Balance;
		coinInType: CoinType;
	}) => {
		return BigInt(1);
		// const coinIn = this.pool.coins[inputs.coinInType];
		// const coinOut = this.pool.coins[inputs.coinOutType];

		// return CmmmCalculations.calcInGivenOut(
		// 	coinIn.balance,
		// 	coinIn.weight,
		// 	coinOut.balance,
		// 	coinOut.weight,
		// 	inputs.coinOutAmount,
		// 	this.pool.coins[inputs.coinInType].tradeFeeIn
		// );
	};

	public getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		return 1;
		// const coinIn = this.pool.coins[inputs.coinInType];
		// const coinOut = this.pool.coins[inputs.coinOutType];

		// return CmmmCalculations.calcSpotPrice(
		// 	coinIn.balance,
		// 	coinIn.weight,
		// 	coinOut.balance,
		// 	coinOut.weight
		// );
	};

	public getDepositLpMintAmount = (inputs: {
		coinsToBalance: CoinsToBalance;
	}) => {
		return BigInt(1);
		// const pool = this.pool;
		// const poolCoins = pool.coins;

		// const poolCoinBalances = Object.values(poolCoins).map(
		// 	(coin) => coin.balance
		// );
		// const poolCoinWeights = Object.values(poolCoins).map(
		// 	(coin) => coin.weight
		// );

		// const depositCoinBalances = Object.entries(poolCoins).map(
		// 	([coinType, poolCoin]) => {
		// 		const foundBalance = Object.entries(inputs.coinsToBalance).find(
		// 			(coinAndBalance) => coinAndBalance[0] === coinType
		// 		)?.[1];
		// 		return foundBalance ?? BigInt(0);
		// 	}
		// );

		// return CmmmCalculations.calcLpOutGivenExactTokensIn(
		// 	poolCoinBalances,
		// 	poolCoinWeights,
		// 	depositCoinBalances,
		// 	pool.lpCoinSupply,
		// 	pool.coins[Object.keys(poolCoins)[0]].tradeFeeIn
		// );
	};
}
