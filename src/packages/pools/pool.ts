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
import { Pools } from ".";
import { Casting, Helpers } from "../../general/utils";

export class Pool extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Private Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		percentageBoundsMarginOfError: 0.00001,
	};

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

	public async getStats() {
		const stats = await this.fetchApi<PoolStats>("stats");
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

	public async getDepositTransaction(inputs: ApiPoolDepositBody) {
		return this.fetchApiTransaction<ApiPoolDepositBody>(
			"transactions/deposit",
			inputs
		);
	}

	public async getWithdrawTransaction(inputs: ApiPoolWithdrawBody) {
		return this.fetchApiTransaction<ApiPoolWithdrawBody>(
			"transactions/withdraw",
			inputs
		);
	}

	public async getTradeTransaction(inputs: ApiPoolTradeBody) {
		return this.fetchApiTransaction<ApiPoolTradeBody>(
			"transactions/trade",
			inputs
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getDepositEvents(inputs: ApiEventsBody) {
		const eventsWithCursor = await this.fetchApiEvents<PoolDepositEvent>(
			"events/deposit",
			inputs
		);

		// PRODUCTION: temporary until "And" filter can be used for event filtering
		return {
			...eventsWithCursor,
			events: eventsWithCursor.events.filter(
				(event) => event.poolId === this.pool.objectId
			),
		};
	}

	public async getWithdrawEvents(inputs: ApiEventsBody) {
		const eventsWithCursor = await this.fetchApiEvents<PoolWithdrawEvent>(
			"events/withdraw",
			inputs
		);

		// PRODUCTION: temporary until "And" filter can be used for event filtering
		return {
			...eventsWithCursor,
			events: eventsWithCursor.events.filter(
				(event) => event.poolId === this.pool.objectId
			),
		};
	}

	public async getTradeEvents(inputs: ApiEventsBody) {
		const eventsWithCursor = await this.fetchApiEvents<PoolTradeEvent>(
			"events/trade",
			inputs
		);

		// PRODUCTION: temporary until "And" filter can be used for event filtering
		return {
			...eventsWithCursor,
			events: eventsWithCursor.events.filter(
				(event) => event.poolId === this.pool.objectId
			),
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Calculations
	/////////////////////////////////////////////////////////////////////

	public getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		// PRODUCTION: handle referral in calculation
		referral?: boolean;
	}): {
		coinOutAmount: Balance;
		error?: string;
	} => {
		const pool = Helpers.deepCopy(this.pool);
		const coinInPoolBalance = pool.coins[inputs.coinInType].balance;
		const coinOutPoolBalance = pool.coins[inputs.coinOutType].balance;

		const coinInAmountWithFees = Pools.getAmountWithProtocolFees({
			amount: inputs.coinInAmount,
		});

		if (
			Number(coinInAmountWithFees) / Number(coinInPoolBalance) >=
			Pools.constants.bounds.maxSwapPercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		)
			return {
				coinOutAmount: Casting.zeroBigInt,
				error: "coinInAmountWithFees / coinInPoolBalance >= maxSwapPercentageOfPoolBalance",
			};

		try {
			const coinOutAmount = CmmmCalculations.calcOutGivenIn(
				pool,
				inputs.coinInType,
				inputs.coinOutType,
				coinInAmountWithFees
			);

			if (coinOutAmount <= 0)
				return {
					coinOutAmount: Casting.zeroBigInt,
					error: "coinOutAmount <= 0",
				};

			if (
				Number(coinOutAmount) / Number(coinOutPoolBalance) >=
				Pools.constants.bounds.maxSwapPercentageOfPoolBalance -
					Pool.constants.percentageBoundsMarginOfError
			)
				return {
					coinOutAmount: Casting.zeroBigInt,
					error: "coinOutAmount / coinOutPoolBalance >= maxSwapPercentageOfPoolBalance",
				};

			return { coinOutAmount };
		} catch (e) {
			return {
				coinOutAmount: Casting.zeroBigInt,
				error: "calculation failed",
			};
		}
	};

	public getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		// PRODUCTION: handle referral in calculation
		referral?: boolean;
	}): {
		coinInAmount: Balance;
		error?: string;
	} => {
		const pool = Helpers.deepCopy(this.pool);
		const coinInPoolBalance = pool.coins[inputs.coinInType].balance;
		const coinOutPoolBalance = pool.coins[inputs.coinOutType].balance;

		if (
			Number(inputs.coinOutAmount) / Number(coinOutPoolBalance) >=
			Pools.constants.bounds.maxSwapPercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		)
			return {
				coinInAmount: Casting.u64MaxBigInt,
				error: "coinOutAmount / coinOutPoolBalance >= maxSwapPercentageOfPoolBalance",
			};

		try {
			const coinInAmount = CmmmCalculations.calcInGivenOut(
				pool,
				inputs.coinInType,
				inputs.coinOutType,
				inputs.coinOutAmount
			);

			if (coinInAmount <= 0)
				return {
					coinInAmount: Casting.u64MaxBigInt,
					error: "coinInAmount <= 0",
				};

			if (
				Number(coinInAmount) / Number(coinInPoolBalance) >=
				Pools.constants.bounds.maxSwapPercentageOfPoolBalance -
					Pool.constants.percentageBoundsMarginOfError
			)
				return {
					coinInAmount: Casting.u64MaxBigInt,
					error: "coinInAmount / coinInPoolBalance >= maxSwapPercentageOfPoolBalance",
				};

			const coinInAmountWithoutFees = Pools.getAmountWithoutProtocolFees({
				amount: coinInAmount,
			});

			return { coinInAmount: coinInAmountWithoutFees };
		} catch (e) {
			return {
				coinInAmount: Casting.u64MaxBigInt,
				error: "calculation failed",
			};
		}
	};

	public getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
		withFees?: boolean;
	}) => {
		return CmmmCalculations.calcSpotPriceWithFees(
			Helpers.deepCopy(this.pool),
			inputs.coinInType,
			inputs.coinOutType,
			!inputs.withFees
		);
	};

	public getDepositLpAmountOut = (inputs: {
		amountsIn: CoinsToBalance;
		// PRODUCTION: account for referral in calculation
		referral?: boolean;
	}): {
		lpAmountOut: Balance;
		lpRatio: number;
		error?: string;
	} => {
		try {
			let calcedLpRatio = CmmmCalculations.calcDepositFixedAmounts(
				this.pool,
				inputs.amountsIn
			);

			let error = undefined;
			let lpAmountOut: Balance;
			let lpRatio: number;

			if (calcedLpRatio >= Casting.fixedOneBigInt) {
				error = "lpRatio >= 1";
				lpRatio = 1;
				lpAmountOut = Casting.zeroBigInt;
			} else {
				lpRatio = Casting.bigIntToFixedNumber(calcedLpRatio);
				lpAmountOut = BigInt(
					Math.floor(Number(this.pool.lpCoinSupply) * (1 - lpRatio))
				);
			}

			return {
				lpAmountOut,
				lpRatio,
				error,
			};
		} catch (e) {
			return {
				lpRatio: 1,
				lpAmountOut: Casting.zeroBigInt,
				error: "calculation failed",
			};
		}
	};

	public getWithdrawAmountsOut = (inputs: {
		lpRatio: number;
		amountsOutDirection: CoinsToBalance;
		// PRODUCTION: account for referral in calculation
		referral?: boolean;
	}): {
		amountsOut: CoinsToBalance;
		error?: string;
	} => {
		try {
			const calcedAmountsOut = CmmmCalculations.calcWithdrawFlpAmountsOut(
				this.pool,
				inputs.amountsOutDirection,
				inputs.lpRatio
			);

			let amountsOut = { ...calcedAmountsOut };
			let error = undefined;

			for (const coin in Object.keys(calcedAmountsOut)) {
				if (calcedAmountsOut[coin] <= Casting.zeroBigInt) {
					if (error === undefined) error = "";

					error += `amountsOut[${coin}] <= 0 `;
					amountsOut = {};
				}
			}
			if (error !== undefined) error = error.trim();

			return {
				amountsOut,
				error,
			};
		} catch (e) {
			return {
				amountsOut: {},
				error: "calculation failed",
			};
		}
	};

	public getWithdrawLpRatio = (inputs: { lpCoinAmountOut: bigint }): number =>
		Number(this.pool.lpCoinSupply - inputs.lpCoinAmountOut) /
		Number(this.pool.lpCoinSupply);
}
