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
	Percentage,
	SuiAddress,
	ObjectId,
} from "../../types";
import { CmmmCalculations } from "./utils/cmmmCalculations";
import { Caller } from "../../general/utils/caller";
import { Pools } from ".";
import { Casting, Helpers } from "../../general/utils";
import { Transaction } from "@mysten/sui/transactions";
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

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Fetches the deposit transaction for the pool.
	 * @async
	 * @param {ApiPoolDepositBody} inputs - The inputs for the method.
	 * @returns {Promise<Transaction>} The deposit transaction for the pool.
	 */
	public async getDepositTransaction(
		inputs: ApiPoolDepositBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildDepositTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Fetches the withdraw transaction for the pool.
	 * @async
	 * @param {ApiPoolWithdrawBody} inputs - The inputs for the method.
	 * @returns {Promise<Transaction>} The withdraw transaction for the pool.
	 */
	public async getWithdrawTransaction(
		inputs: ApiPoolWithdrawBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildWithdrawTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Fetches the all coin withdraw transaction for the pool.
	 * @async
	 * @param {ApiPoolAllCoinWithdrawBody} inputs - The inputs for the method.
	 * @returns {Promise<Transaction>} The all coin withdraw transaction for the pool.
	 */
	public async getAllCoinWithdrawTransaction(
		inputs: ApiPoolAllCoinWithdrawBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildAllCoinWithdrawTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Fetches the trade transaction for the pool.
	 * @async
	 * @param {ApiPoolTradeBody} inputs - The inputs for the method.
	 * @returns {Promise<Transaction>} The trade transaction for the pool.
	 */
	public async getTradeTransaction(
		inputs: ApiPoolTradeBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildTradeTx({
			...inputs,
			pool: this,
		});
	}

	public async getUpdateDaoFeeTransaction(inputs: {
		walletAddress: SuiAddress;
		daoFeePoolOwnerCapId: ObjectId;
		newFeePercentage: Percentage;
	}): Promise<Transaction> {
		const daoFeePoolId = this.pool.daoFeePoolObject?.objectId;
		if (!daoFeePoolId) throw new Error("this pool has no DAO fee");

		return this.useProvider().buildDaoFeePoolUpdateFeeBpsTx({
			...inputs,
			daoFeePoolId,
			lpCoinType: this.pool.lpCoinType,
			newFeeBps: Casting.percentageToBps(inputs.newFeePercentage),
		});
	}

	public async getUpdateDaoFeeRecipientTransaction(inputs: {
		walletAddress: SuiAddress;
		daoFeePoolOwnerCapId: ObjectId;
		newFeeRecipient: SuiAddress;
	}): Promise<Transaction> {
		const daoFeePoolId = this.pool.daoFeePoolObject?.objectId;
		if (!daoFeePoolId) throw new Error("this pool has no DAO fee");

		return this.useProvider().buildDaoFeePoolUpdateFeeRecipientTx({
			...inputs,
			daoFeePoolId,
			lpCoinType: this.pool.lpCoinType,
			newFeeRecipient: Helpers.addLeadingZeroesToType(
				inputs.newFeeRecipient
			),
		});
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

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

	// =========================================================================
	//  Events
	// =========================================================================

	public async getInteractionEvents(
		inputs: ApiIndexerEventsBody & {
			walletAddress: SuiAddress;
		}
	) {
		return this.fetchApiEvents<
			PoolDepositEvent | PoolWithdrawEvent,
			ApiIndexerEventsBody
		>("interaction-events-by-user", inputs);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

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

		const coinInAmountWithFees = this.getAmountWithDAOFee({
			amount: Pools.getAmountWithProtocolFees({
				amount: inputs.coinInAmount,
			}),
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

		const coinInAmountWithoutFees = this.getAmountWithoutDAOFee({
			amount: Pools.getAmountWithoutProtocolFees({
				amount: coinInAmount,
			}),
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
			Object.entries(inputs.amountsIn).reduce(
				(acc, [coin, amount]) => ({
					...acc,
					[coin]: this.getAmountWithDAOFee({ amount }),
				}),
				{}
			)
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

			amountsOut[coin] = this.getAmountWithDAOFee({
				amount: amountOut,
			});
		}

		return amountsOut;
	};

	public getWithdrawAmountsOutSimple = (inputs: {
		lpCoinAmountIn: Balance;
		coinTypesOut: CoinType[];
		referral?: boolean;
	}): CoinsToBalance => {
		const { lpCoinAmountIn, coinTypesOut, referral } = inputs;

		const lpCoinSupply = this.pool.lpCoinSupply;

		let withdrawAmountsEstimates: CoinsToBalance = {};
		coinTypesOut.forEach((poolCoin) => {
			const poolCoinAmountInPool =
				this.pool.coins[Helpers.addLeadingZeroesToType(poolCoin)]
					.balance;

			const poolCoinAmount =
				Number(poolCoinAmountInPool) *
				(Number(lpCoinAmountIn) / Number(lpCoinSupply));

			withdrawAmountsEstimates[Helpers.addLeadingZeroesToType(poolCoin)] =
				BigInt(Math.floor(poolCoinAmount));
		});

		const lpRatio = this.getMultiCoinWithdrawLpRatio({
			lpCoinAmountIn,
		});
		const amountsOut = this.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection: withdrawAmountsEstimates,
			referral,
		});

		for (const coin of Object.keys(amountsOut)) {
			if (
				!coinTypesOut
					.map((coinOut) => Helpers.addLeadingZeroesToType(coinOut))
					.includes(coin)
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

			amountsOut[coin] = this.getAmountWithDAOFee({
				amount: amountOut,
			});
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
				[coin]: this.getAmountWithDAOFee({
					amount: BigInt(
						Math.floor(Number(info.balance) * inputs.lpRatio)
					),
				}),
			};
		}, {});

		return amountsOut;
	};

	/**
	 * Calculates the LP ratio for a multi-coin withdraw.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {bigint} inputs.lpCoinAmountIn - The LP coin amount out.
	 * @returns {number} The LP ratio for the multi-coin withdraw.
	 */
	public getMultiCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountIn: bigint;
	}): number =>
		Number(this.pool.lpCoinSupply - inputs.lpCoinAmountIn) /
		Number(this.pool.lpCoinSupply);

	/**
	 * Calculates the LP ratio for an all coin withdraw.
	 * @param {Object} inputs - The inputs for the method.
	 * @param {bigint} inputs.lpCoinAmountIn - The LP coin amount out.
	 * @returns {number} The LP ratio for the all coin withdraw.
	 */
	public getAllCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountIn: bigint;
	}): number =>
		Number(inputs.lpCoinAmountIn) / Number(this.pool.lpCoinSupply);

	// =========================================================================
	//  Getters
	// =========================================================================

	public daoFeePercentage = (): Percentage | undefined => {
		return this.pool.daoFeePoolObject
			? Casting.bpsToPercentage(this.pool.daoFeePoolObject.feeBps)
			: undefined;
	};

	public daoFeeRecipient = (): SuiAddress | undefined => {
		return this.pool.daoFeePoolObject?.feeRecipient;
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private getAmountWithDAOFee = (inputs: { amount: Balance }) => {
		const daoFeePercentage = this.daoFeePercentage();
		if (!daoFeePercentage) return inputs.amount;

		return BigInt(
			Math.floor(Number(inputs.amount) * (1 - daoFeePercentage))
		);
	};

	private getAmountWithoutDAOFee = (inputs: { amount: Balance }) => {
		const daoFeePercentage = this.daoFeePercentage();
		if (!daoFeePercentage) return inputs.amount;

		return BigInt(
			Math.floor(Number(inputs.amount) * (1 / (1 - daoFeePercentage)))
		);
	};

	private useProvider = () => {
		const provider = this.Provider?.Pools();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
