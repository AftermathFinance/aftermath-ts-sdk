import { SignableTransaction, SuiAddress } from "@mysten/sui.js";
import {
	ApiPoolDepositBody,
	ApiPoolTradeBody,
	ApiPoolWithdrawBody,
	Balance,
	CoinType,
	CoinsToBalance,
	IndicesPoolDataPoint,
	PoolVolumeDataTimeframeKey,
	PoolDynamicFields,
	PoolObject,
	PoolStats,
	SuiNetwork,
} from "../../types";
import { CmmmCalculations } from "./utils/cmmmCalculations";
import { Aftermath } from "../../general/providers/aftermath";

export class Pool extends Aftermath {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly pool: PoolObject,
		public readonly dynamicFields: PoolDynamicFields,
		public readonly network?: SuiNetwork
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
		timeframe: PoolVolumeDataTimeframeKey
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
		return this.fetchApi<SignableTransaction[], ApiPoolTradeBody>(
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

	public getTradeAmountOut = (
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType
	) => {
		const coinInPoolBalance = this.balanceForCoin(coinIn);
		const coinOutPoolBalance = this.balanceForCoin(coinOut);
		const coinInWeight = this.weightForCoin(coinIn);
		const coinOutWeight = this.weightForCoin(coinOut);

		return CmmmCalculations.calcOutGivenIn(
			coinInPoolBalance,
			coinInWeight,
			coinOutPoolBalance,
			coinOutWeight,
			coinInAmount,
			this.pool.fields.tradeFee
		);
	};

	public getTradeAmountIn = (
		coinOut: CoinType,
		coinOutAmount: Balance,
		coinIn: CoinType
	) => {
		const coinOutPoolBalance = this.balanceForCoin(coinOut);
		const coinInPoolBalance = this.balanceForCoin(coinIn);
		const coinOutWeight = this.weightForCoin(coinOut);
		const coinInWeight = this.weightForCoin(coinIn);

		return CmmmCalculations.calcInGivenOut(
			coinInPoolBalance,
			coinInWeight,
			coinOutPoolBalance,
			coinOutWeight,
			coinOutAmount,
			this.pool.fields.tradeFee
		);
	};

	public getSpotPrice = (coinIn: CoinType, coinOut: CoinType) => {
		const coinInPoolBalance = this.balanceForCoin(coinIn);
		const coinOutPoolBalance = this.balanceForCoin(coinOut);
		const coinInWeight = this.weightForCoin(coinIn);
		const coinOutWeight = this.weightForCoin(coinOut);

		return CmmmCalculations.calcSpotPrice(
			coinInPoolBalance,
			coinInWeight,
			coinOutPoolBalance,
			coinOutWeight
		);
	};

	public getDepositLpMintAmount = (coinsToBalance: CoinsToBalance) => {
		const lpTotalSupply = this.dynamicFields.lpFields[0].value;
		const poolCoinBalances = this.dynamicFields.amountFields.map(
			(field) => field.value
		);
		const depositCoinBalances = this.pool.fields.coins.map((coin) => {
			const foundBalance = Object.entries(coinsToBalance).find(
				(coinAndBalance) => coinAndBalance[0] === coin
			)?.[1];
			return foundBalance ?? BigInt(0);
		});

		return CmmmCalculations.calcLpOutGivenExactTokensIn(
			poolCoinBalances,
			this.pool.fields.weights,
			depositCoinBalances,
			lpTotalSupply,
			this.pool.fields.tradeFee
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public weightForCoin = (coin: CoinType) => {
		const coinIndex = this.pool.fields.coins.findIndex(
			(aCoin) => aCoin === coin
		);
		if (coinIndex < 0) throw new Error("coin not found in pool object");
		return this.pool.fields.weights[coinIndex];
	};

	public balanceForCoin = (coin: CoinType) => {
		const poolBalance = this.dynamicFields.amountFields.find(
			(field) => field.coin === coin
		);
		if (!poolBalance)
			throw new Error("coin not found in pool dynamic fields");
		return poolBalance.value;
	};
}
