import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
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
	PoolCoins,
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

	public async getVolume(
		timeframe: PoolVolumeDataTimeframeKey
	): Promise<PoolDataPoint[]> {
		return this.fetchApi(`volume/${timeframe}`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getDepositTransaction(
		walletAddress: SuiAddress,
		depositCoinAmounts: CoinsToBalance
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, ApiPoolDepositBody>(
				"transactions/deposit",
				{
					walletAddress,
					depositCoinAmounts,
				}
			)
		);
	}

	public async getWithdrawTransaction(
		walletAddress: SuiAddress,
		withdrawCoinAmounts: CoinsToBalance,
		withdrawLpTotal: Balance
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, ApiPoolWithdrawBody>(
				"transactions/withdraw",
				{
					walletAddress,
					withdrawCoinAmounts,
					withdrawLpTotal,
				}
			)
		);
	}

	public async getTradeTransaction(
		walletAddress: SuiAddress,
		fromCoin: CoinType,
		fromCoinAmount: Balance,
		toCoin: CoinType
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, ApiPoolTradeBody>(
				"transactions/trade",
				{
					walletAddress,
					fromCoin,
					fromCoinAmount,
					toCoin,
				}
			)
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	// public async getDepositEvents(
	// 	cursor?: EventId,
	// 	limit?: number
	// ): Promise<EventsWithCursor<PoolDepositEvent>> {
	// 	return this.fetchApi<EventsWithCursor<PoolDepositEvent>, ApiEventsBody>(
	// 		"events/deposit",
	// 		{
	// 			cursor,
	// 			limit,
	// 		}
	// 	);
	// }

	// public async getWithdrawEvents(
	// 	cursor?: EventId,
	// 	limit?: number
	// ): Promise<EventsWithCursor<PoolWithdrawEvent>> {
	// 	return this.fetchApi<
	// 		EventsWithCursor<PoolWithdrawEvent>,
	// 		ApiEventsBody
	// 	>("events/withdraw", {
	// 		cursor,
	// 		limit,
	// 	});
	// }

	// public async getTradeEvents(
	// 	cursor?: EventId,
	// 	limit?: number
	// ): Promise<EventsWithCursor<PoolTradeEvent>> {
	// 	return this.fetchApi<EventsWithCursor<PoolTradeEvent>, ApiEventsBody>(
	// 		"events/trade",
	// 		{
	// 			cursor,
	// 			limit,
	// 		}
	// 	);
	// }

	/////////////////////////////////////////////////////////////////////
	//// Calculations
	/////////////////////////////////////////////////////////////////////

	public getTradeAmountOut = (
		coinInType: CoinType,
		coinInAmount: Balance,
		coinOutType: CoinType
	) => {
		const coinIn = this.pool.coins[coinInType];
		const coinOut = this.pool.coins[coinOutType];

		return CmmmCalculations.calcOutGivenIn(
			coinIn.balance,
			coinIn.weight,
			coinOut.balance,
			coinOut.weight,
			coinInAmount,
			this.pool.coins[coinInType].tradeFeeIn
		);
	};

	public getTradeAmountIn = (
		coinOutType: CoinType,
		coinOutAmount: Balance,
		coinInType: CoinType
	) => {
		const coinIn = this.pool.coins[coinInType];
		const coinOut = this.pool.coins[coinOutType];

		return CmmmCalculations.calcInGivenOut(
			coinIn.balance,
			coinIn.weight,
			coinOut.balance,
			coinOut.weight,
			coinOutAmount,
			this.pool.coins[coinInType].tradeFeeIn
		);
	};

	public getSpotPrice = (coinInType: CoinType, coinOutType: CoinType) => {
		const coinIn = this.pool.coins[coinInType];
		const coinOut = this.pool.coins[coinOutType];

		return CmmmCalculations.calcSpotPrice(
			coinIn.balance,
			coinIn.weight,
			coinOut.balance,
			coinOut.weight
		);
	};

	public getDepositLpMintAmount = (coinsToBalance: CoinsToBalance) => {
		const pool = this.pool;
		const poolCoins = pool.coins;

		const poolCoinBalances = Object.values(poolCoins).map(
			(coin) => coin.balance
		);
		const poolCoinWeights = Object.values(poolCoins).map(
			(coin) => coin.weight
		);

		const depositCoinBalances = Object.entries(poolCoins).map(
			([coinType, poolCoin]) => {
				const foundBalance = Object.entries(coinsToBalance).find(
					(coinAndBalance) => coinAndBalance[0] === coinType
				)?.[1];
				return foundBalance ?? BigInt(0);
			}
		);

		return CmmmCalculations.calcLpOutGivenExactTokensIn(
			poolCoinBalances,
			poolCoinWeights,
			depositCoinBalances,
			pool.lpCoinSupply,
			pool.coins[Object.keys(poolCoins)[0]].tradeFeeIn
		);
	};
}
