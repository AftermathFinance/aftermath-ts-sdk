import { SignableTransaction, SuiAddress } from "@mysten/sui.js";
import AftermathProvider from "../aftermathProvider/aftermathProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	ApiPoolDepositBody,
	ApiPoolSwapBody,
	ApiPoolWithdrawBody,
	Balance,
	CoinType,
	CoinsToBalance,
	IndicesPoolDataPoint,
	IndicesPoolVolumeDataTimeframeKey,
	PoolDynamicFields,
	PoolObject,
	PoolStats,
} from "../types";
import { Cmmm } from "./utils/cmmm";

export class Pool extends AftermathProvider {
	constructor(
		public readonly network: SuiNetwork,
		public readonly pool: PoolObject,
		public readonly dynamicFields: PoolDynamicFields
	) {
		super(network, `pools/${pool.objectId}`);
		this.pool = pool;
	}

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	public async getStats(): Promise<PoolStats> {
		return this.fetchApi("stats");
	}

	public async getVolume(
		timeframe: IndicesPoolVolumeDataTimeframeKey
	): Promise<IndicesPoolDataPoint[]> {
		return this.fetchApi(`volume/${timeframe}`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getDepositTransactions(
		walletAddress: SuiAddress,
		depositCoinAmounts: CoinsToBalance
	): Promise<SignableTransaction[]> {
		return this.fetchApi<SignableTransaction[], ApiPoolDepositBody>(
			"transactions/deposit",
			{
				walletAddress,
				depositCoinAmounts,
			}
		);
	}

	public async getWithdrawTransactions(
		walletAddress: SuiAddress,
		withdrawCoinAmounts: CoinsToBalance,
		withdrawLpTotal: Balance
	): Promise<SignableTransaction[]> {
		return this.fetchApi<SignableTransaction[], ApiPoolWithdrawBody>(
			"transactions/withdraw",
			{
				walletAddress,
				withdrawCoinAmounts,
				withdrawLpTotal,
			}
		);
	}

	public async getTradeTransactions(
		walletAddress: SuiAddress,
		fromCoin: CoinType,
		fromCoinAmount: Balance,
		toCoin: CoinType
	): Promise<SignableTransaction[]> {
		return this.fetchApi<SignableTransaction[], ApiPoolSwapBody>(
			"transactions/trade",
			{
				walletAddress,
				fromCoin,
				fromCoinAmount,
				toCoin,
			}
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Calculations
	/////////////////////////////////////////////////////////////////////

	public getTradeAmountOut(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	): Balance {
		return Cmmm.swapAmountOutGivenIn(
			this.pool,
			this.dynamicFields,
			{
				coin: coinIn,
				balance: coinInAmount,
			},
			coinOut
		);
	}

	public getTradeAmountIn(
		coinOut: CoinType,
		coinOutAmount: Balance,
		coinIn: CoinType
	): Balance {
		return Cmmm.swapAmountInGivenOut(
			this.pool,
			this.dynamicFields,
			{
				coin: coinOut,
				balance: coinOutAmount,
			},
			coinIn
		);
	}

	public getSpotPrice(coinIn: CoinType, coinOut: CoinType): number {
		return Cmmm.spotPrice(this.pool, this.dynamicFields, coinIn, coinOut);
	}

	public getDepositLpMintAmount(coinsToBalance: CoinsToBalance): Balance {
		return Cmmm.depositLpMintAmount(
			this.pool,
			this.dynamicFields,
			coinsToBalance
		);
	}
}
