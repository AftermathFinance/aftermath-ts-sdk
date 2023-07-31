import {
	ApiPoolDepositBody,
	ApiPoolTradeBody,
	ApiPoolWithdrawBody,
	Balance,
	CoinType,
	CoinsToBalance,
	DecimalsScalar,
	PoolDataPoint,
	PoolGraphDataTimeframeKey,
	PoolObject,
	PoolStats,
	SuiNetwork,
	ApiEventsBody,
	PoolDepositEvent,
	PoolWithdrawEvent,
	PoolTradeEvent,
	Url,
	ApiPoolAllCoinWithdrawBody,
	NormalizedBalance,
} from "../../types";
import { CmmmCalculations } from "./utils/cmmmCalculations";
import { Caller } from "../../general/utils/caller";
import { Pools } from ".";
import { Casting, Helpers } from "../../general/utils";

export class Pool extends Caller {
	// =========================================================================
	//  Private Constants
	// =========================================================================

	private static readonly constants = {
		percentageBoundsMarginOfError: 0.001, // 0.1%
	};

	// =========================================================================
	//  Public Class Members
	// =========================================================================

	public stats: PoolStats | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly pool: PoolObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `pools/${pool.objectId}`);
		this.pool = pool;
	}

	// =========================================================================
	//  Stats
	// =========================================================================

	public async getStats() {
		const stats = await this.fetchApi<PoolStats>("stats");
		this.setStats(stats);
		return stats;
	}

	public setStats(stats: PoolStats) {
		this.stats = stats;
	}

	public async getVolumeData(inputs: {
		timeframe: PoolGraphDataTimeframeKey;
	}): Promise<PoolDataPoint[]> {
		return this.fetchApi(`volume/${inputs.timeframe}`);
	}

	public async getFeeData(inputs: {
		timeframe: PoolGraphDataTimeframeKey;
	}): Promise<PoolDataPoint[]> {
		return this.fetchApi(`fees/${inputs.timeframe}`);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

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

	public async getAllCoinWithdrawTransaction(
		inputs: ApiPoolAllCoinWithdrawBody
	) {
		return this.fetchApiTransaction<ApiPoolAllCoinWithdrawBody>(
			"transactions/all-coin-withdraw",
			inputs
		);
	}

	public async getTradeTransaction(inputs: ApiPoolTradeBody) {
		return this.fetchApiTransaction<ApiPoolTradeBody>(
			"transactions/trade",
			inputs
		);
	}

	// =========================================================================
	//  Events
	// =========================================================================

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

	// =========================================================================
	//  Calculations
	// =========================================================================

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

	public getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		// PRODUCTION: handle referral in calculation
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

	public getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		// PRODUCTION: handle referral in calculation
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

	public getDepositLpAmountOut = (inputs: {
		amountsIn: CoinsToBalance;
		// PRODUCTION: account for referral in calculation
		referral?: boolean;
	}): {
		lpAmountOut: Balance;
		lpRatio: number;
	} => {
		const calcedLpRatio = CmmmCalculations.calcDepositFixedAmounts(
			this.pool,
			inputs.amountsIn
		);

		if (calcedLpRatio >= Casting.fixedOneBigInt)
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

	public getWithdrawAmountsOut = (inputs: {
		lpRatio: number;
		amountsOutDirection: CoinsToBalance;
		// PRODUCTION: account for referral in calculation
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

			if (amountOut <= Casting.zeroBigInt)
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

	public getAllCoinWithdrawAmountsOut = (inputs: {
		lpRatio: number;
		// PRODUCTION: account for referral in calculation
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

	public getMultiCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountOut: bigint;
	}): number =>
		Number(this.pool.lpCoinSupply - inputs.lpCoinAmountOut) /
		Number(this.pool.lpCoinSupply);

	public getAllCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountOut: bigint;
	}): number =>
		Number(inputs.lpCoinAmountOut) / Number(this.pool.lpCoinSupply);
}
