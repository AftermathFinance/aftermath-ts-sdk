import {
	ApiPoolDepositBody,
	ApiPoolTradeBody,
	ApiPoolWithdrawBody,
	Balance,
	CoinType,
	CoinsToBalance,
	PoolDataPoint,
	PoolGraphDataTimeframeKey,
	PoolObject,
	PoolStats,
	SuiNetwork,
	PoolDepositEvent,
	PoolWithdrawEvent,
	PoolTradeEvent,
	Url,
	ApiPoolAllCoinWithdrawBody,
	ApiIndexerEventsBody,
	IndexerEventsWithCursor,
} from "../../types";
import { CmmmCalculations } from "./utils/cmmmCalculations";
import { Caller } from "../../general/utils/caller";
import { Pools } from ".";
import { Casting, Helpers } from "../../general/utils";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Coin } from "..";
import { AftermathApi } from "../../general/providers";

/**
 * Represents a pool object and provides methods for interacting with the pool.
 * @class
 */
export class Pool extends Caller {
	/**
	 * Private constants used in the class.
	 */
	private static readonly constants = {
		percentageBoundsMarginOfError: 0.001, // 0.1%
	};

	/**
	 * The pool statistics.
	 */
	public stats: PoolStats | undefined;

	/**
	 * Creates a new instance of the Pool class.
	 * @constructor
	 * @param {PoolObject} pool - The pool object.
	 * @param {SuiNetwork} [network] - The network to use.
	 */
	constructor(
		public readonly pool: PoolObject,
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, `pools/${pool.objectId}`);
		this.pool = pool;
	}

	/**
	 * Fetches the pool statistics.
	 * @async
	 * @returns {Promise<PoolStats>} The pool statistics.
	 */
	public async getStats(): Promise<PoolStats> {
		const stats = await this.fetchApi<PoolStats>("stats");
		this.setStats(stats);
		return stats;
	}

	/**
	 * Sets the pool statistics.
	 * @param {PoolStats} stats - The pool statistics.
	 */
	public setStats(stats: PoolStats): void {
		this.stats = stats;
	}

	/**
	 * Fetches the volume data for the pool.
	 * @async
	 * @param {Object} inputs - The inputs for the method.
	 * @param {PoolGraphDataTimeframeKey} inputs.timeframe - The timeframe for the data.
	 * @returns {Promise<PoolDataPoint[]>} The volume data for the pool.
	 */
	public async getVolumeData(inputs: {
		timeframe: PoolGraphDataTimeframeKey;
	}): Promise<PoolDataPoint[]> {
		return this.fetchApi(`volume/${inputs.timeframe}`);
	}

	/**
	 * Fetches the fee data for the pool.
	 * @async
	 * @param {Object} inputs - The inputs for the method.
	 * @param {PoolGraphDataTimeframeKey} inputs.timeframe - The timeframe for the data.
	 * @returns {Promise<PoolDataPoint[]>} The fee data for the pool.
	 */
	public async getFeeData(inputs: {
		timeframe: PoolGraphDataTimeframeKey;
	}): Promise<PoolDataPoint[]> {
		return this.fetchApi(`fees/${inputs.timeframe}`);
	}

	/**
	 * Retrieves the volume in the last 24 hours for the pool.
	 * @returns A promise that resolves to the volume in the last 24 hours.
	 */
	public getVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	/**
	 * Fetches the deposit transaction for the pool.
	 * @async
	 * @param {ApiPoolDepositBody} inputs - The inputs for the method.
	 * @returns {Promise<TransactionBlock>} The deposit transaction for the pool.
	 */
	public async getDepositTransaction(
		inputs: ApiPoolDepositBody
	): Promise<TransactionBlock> {
		return this.useProvider().fetchBuildDepositTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Fetches the withdraw transaction for the pool.
	 * @async
	 * @param {ApiPoolWithdrawBody} inputs - The inputs for the method.
	 * @returns {Promise<TransactionBlock>} The withdraw transaction for the pool.
	 */
	public async getWithdrawTransaction(
		inputs: ApiPoolWithdrawBody
	): Promise<TransactionBlock> {
		return this.useProvider().fetchBuildWithdrawTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Fetches the all coin withdraw transaction for the pool.
	 * @async
	 * @param {ApiPoolAllCoinWithdrawBody} inputs - The inputs for the method.
	 * @returns {Promise<TransactionBlock>} The all coin withdraw transaction for the pool.
	 */
	public async getAllCoinWithdrawTransaction(
		inputs: ApiPoolAllCoinWithdrawBody
	): Promise<TransactionBlock> {
		return this.useProvider().fetchBuildAllCoinWithdrawTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Fetches the trade transaction for the pool.
	 * @async
	 * @param {ApiPoolTradeBody} inputs - The inputs for the method.
	 * @returns {Promise<TransactionBlock>} The trade transaction for the pool.
	 */
	public async getTradeTransaction(
		inputs: ApiPoolTradeBody
	): Promise<TransactionBlock> {
		return this.useProvider().fetchBuildTradeTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Fetches the deposit events for the pool.
	 * @async
	 * @param {ApiIndexerEventsBody} inputs - The inputs for the method.
	 * @returns {Promise<IndexerEventsWithCursor<PoolDepositEvent>>} The deposit events for the pool.
	 */
	public async getDepositEvents(inputs: ApiIndexerEventsBody) {
		return this.fetchApiIndexerEvents<PoolDepositEvent>(
			"events/deposit",
			inputs
		);
	}

	/**
	 * Fetches the withdraw events for the pool.
	 * @async
	 * @param {ApiIndexerEventsBody} inputs - The inputs for the method.
	 * @returns {Promise<IndexerEventsWithCursor<PoolWithdrawEvent>>} The withdraw events for the pool.
	 */
	public async getWithdrawEvents(
		inputs: ApiIndexerEventsBody
	): Promise<IndexerEventsWithCursor<PoolWithdrawEvent>> {
		return this.fetchApiIndexerEvents<PoolWithdrawEvent>(
			"events/withdraw",
			inputs
		);
	}

	/**
	 * Fetches the trade events for the pool.
	 * @async
	 * @param {ApiIndexerEventsBody} inputs - The inputs for the method.
	 * @returns {Promise<IndexerEventsWithCursor<PoolTradeEvent>>} The trade events for the pool.
	 */
	public async getTradeEvents(
		inputs: ApiIndexerEventsBody
	): Promise<IndexerEventsWithCursor<PoolTradeEvent>> {
		return this.fetchApiIndexerEvents<PoolTradeEvent>(
			"events/trade",
			inputs
		);
	}

	/**
	 * Calculates the spot price for the pool.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {CoinType} inputs.coinInType - The input coin type.
	 * @param {CoinType} inputs.coinOutType - The output coin type.
	 * @param {boolean} [inputs.withFees] - Whether to include fees in the calculation.
	 * @returns {number} The spot price for the pool.
	 */
	public getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
		withFees?: boolean;
	}) => {
		const spotPriceWithDecimals = CmmmCalculations.calcSpotPriceWithFees(
			Helpers.deepCopy(this.pool),
			inputs.coinInType,
			inputs.coinOutType,
			!inputs.withFees
		);

		return (
			(spotPriceWithDecimals *
				Number(this.pool.coins[inputs.coinOutType].decimalsScalar)) /
			Number(this.pool.coins[inputs.coinInType].decimalsScalar)
		);
	};

	// TODO: account for referral discount for all calculations

	/**
	 * Calculates the output amount for a trade.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {CoinType} inputs.coinInType - The input coin type.
	 * @param {Balance} inputs.coinInAmount - The input coin amount.
	 * @param {CoinType} inputs.coinOutType - The output coin type.
	 * @param {boolean} [inputs.referral] - Whether the trade includes a referral.
	 * @returns {Balance} The output amount for the trade.
	 */
	public getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referral?: boolean;
	}): Balance => {
		const pool = Helpers.deepCopy(this.pool);
		const coinInPoolBalance = pool.coins[inputs.coinInType].balance;
		const coinOutPoolBalance = pool.coins[inputs.coinOutType].balance;

		const coinInAmountWithFees = Pools.getAmountWithProtocolFees({
			amount: inputs.coinInAmount,
		});

		if (
			Number(coinInAmountWithFees) / Number(coinInPoolBalance) >=
			Pools.constants.bounds.maxTradePercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		)
			throw new Error(
				"coinInAmountWithFees / coinInPoolBalance >= maxTradePercentageOfPoolBalance"
			);

		const coinOutAmount = CmmmCalculations.calcOutGivenIn(
			pool,
			inputs.coinInType,
			inputs.coinOutType,
			coinInAmountWithFees
		);

		if (coinOutAmount <= 0) throw new Error("coinOutAmount <= 0");

		if (
			Number(coinOutAmount) / Number(coinOutPoolBalance) >=
			Pools.constants.bounds.maxTradePercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		)
			throw new Error(
				"coinOutAmount / coinOutPoolBalance >= maxTradePercentageOfPoolBalance"
			);

		return coinOutAmount;
	};

	/**
	 * Calculates the input amount for a trade.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {CoinType} inputs.coinInType - The input coin type.
	 * @param {Balance} inputs.coinOutAmount - The output coin amount.
	 * @param {CoinType} inputs.coinOutType - The output coin type.
	 * @param {boolean} [inputs.referral] - Whether the trade includes a referral.
	 * @returns {Balance} The input amount for the trade.
	 */
	public getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referral?: boolean;
	}): Balance => {
		const pool = Helpers.deepCopy(this.pool);
		const coinInPoolBalance = pool.coins[inputs.coinInType].balance;
		const coinOutPoolBalance = pool.coins[inputs.coinOutType].balance;

		if (
			Number(inputs.coinOutAmount) / Number(coinOutPoolBalance) >=
			Pools.constants.bounds.maxTradePercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		)
			throw new Error(
				"coinOutAmount / coinOutPoolBalance >= maxTradePercentageOfPoolBalance"
			);

		const coinInAmount = CmmmCalculations.calcInGivenOut(
			pool,
			inputs.coinInType,
			inputs.coinOutType,
			inputs.coinOutAmount
		);

		if (coinInAmount <= 0) throw new Error("coinInAmount <= 0");

		if (
			Number(coinInAmount) / Number(coinInPoolBalance) >=
			Pools.constants.bounds.maxTradePercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		)
			throw new Error(
				"coinInAmount / coinInPoolBalance >= maxTradePercentageOfPoolBalance"
			);

		const coinInAmountWithoutFees = Pools.getAmountWithoutProtocolFees({
			amount: coinInAmount,
		});

		return coinInAmountWithoutFees;
	};

	/**
	 * Calculates the LP amount and ratio for a deposit.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {CoinsToBalance} inputs.amountsIn - The input amounts.
	 * @param {boolean} [inputs.referral] - Whether the deposit includes a referral.
	 * @returns {Object} The LP amount and ratio for the deposit.
	 */
	public getDepositLpAmountOut = (inputs: {
		amountsIn: CoinsToBalance;
		referral?: boolean;
	}): {
		lpAmountOut: Balance;
		lpRatio: number;
	} => {
		const calcedLpRatio = CmmmCalculations.calcDepositFixedAmounts(
			this.pool,
			inputs.amountsIn
		);

		if (calcedLpRatio >= Casting.Fixed.fixedOneB)
			throw new Error("lpRatio >= 1");

		const lpRatio = Casting.bigIntToFixedNumber(calcedLpRatio);
		const lpAmountOut = BigInt(
			Math.floor(Number(this.pool.lpCoinSupply) * (1 / lpRatio - 1))
		);

		return {
			lpAmountOut,
			lpRatio,
		};
	};

	/**
	 * Calculates the output amounts for a withdraw.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {number} inputs.lpRatio - The LP ratio.
	 * @param {CoinsToBalance} inputs.amountsOutDirection - The output amounts.
	 * @param {boolean} [inputs.referral] - Whether the withdraw includes a referral.
	 * @returns {CoinsToBalance} The output amounts for the withdraw.
	 */
	public getWithdrawAmountsOut = (inputs: {
		lpRatio: number;
		amountsOutDirection: CoinsToBalance;
		referral?: boolean;
	}): CoinsToBalance => {
		const amountsOut = CmmmCalculations.calcWithdrawFlpAmountsOut(
			this.pool,
			inputs.amountsOutDirection,
			inputs.lpRatio
		);

		for (const coin of Object.keys(amountsOut)) {
			if (
				!(coin in inputs.amountsOutDirection) ||
				inputs.amountsOutDirection[coin] <= BigInt(0)
			)
				continue;

			const amountOut = amountsOut[coin];

			if (amountOut <= BigInt(0))
				throw new Error(`amountsOut[${coin}] <= 0 `);

			if (
				amountOut / this.pool.coins[coin].balance >=
				Pools.constants.bounds.maxWithdrawPercentageOfPoolBalance
			)
				throw new Error(
					"coinOutAmount / coinOutPoolBalance >= maxWithdrawPercentageOfPoolBalance"
				);
		}

		return amountsOut;
	};

	/**
	 * Calculates the output amounts for an all coin withdraw.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {number} inputs.lpRatio - The LP ratio.
	 * @param {boolean} [inputs.referral] - Whether the withdraw includes a referral.
	 * @returns {CoinsToBalance} The output amounts for the all coin withdraw.
	 */
	public getAllCoinWithdrawAmountsOut = (inputs: {
		lpRatio: number;
		referral?: boolean;
	}): CoinsToBalance => {
		if (inputs.lpRatio >= 1) throw new Error("lpRatio >= 1");

		const amountsOut: CoinsToBalance = Object.entries(
			this.pool.coins
		).reduce((acc, [coin, info]) => {
			return {
				...acc,
				[coin]: BigInt(
					Math.floor(Number(info.balance) * inputs.lpRatio)
				),
			};
		}, {});

		return amountsOut;
	};

	/**
	 * Calculates the LP ratio for a multi-coin withdraw.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {bigint} inputs.lpCoinAmountOut - The LP coin amount out.
	 * @returns {number} The LP ratio for the multi-coin withdraw.
	 */
	public getMultiCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountOut: bigint;
	}): number =>
		Number(this.pool.lpCoinSupply - inputs.lpCoinAmountOut) /
		Number(this.pool.lpCoinSupply);

	/**
	 * Calculates the LP ratio for an all coin withdraw.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {bigint} inputs.lpCoinAmountOut - The LP coin amount out.
	 * @returns {number} The LP ratio for the all coin withdraw.
	 */
	public getAllCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountOut: bigint;
	}): number =>
		Number(inputs.lpCoinAmountOut) / Number(this.pool.lpCoinSupply);

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Pools();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
