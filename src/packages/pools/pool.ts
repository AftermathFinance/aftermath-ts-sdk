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
	PoolCoin,
	CallerConfig,
} from "../../types";
import { CmmmCalculations } from "./utils/cmmmCalculations";
import { Caller } from "../../general/utils/caller";
import { Pools } from ".";
import { Casting, Helpers } from "../../general/utils";
import { Transaction } from "@mysten/sui/transactions";
import { Coin } from "..";
import { AftermathApi } from "../../general/providers";

/**
 * The `Pool` class encapsulates all the functionality needed to interact
 * with a specific AMM pool on the Aftermath platform. It allows you to
 * calculate trade amounts, deposit/withdraw amounts, fetch transactions,
 * and retrieve on-chain statistics and event data.
 *
 * @example
 * ```typescript
 * const afSdk = new Aftermath("MAINNET");
 * await afSdk.init(); // initialize provider
 *
 * const pools = afSdk.Pools();
 * const pool = await pools.getPool({ objectId: "0x..." });
 *
 * const stats = await pool.getStats();
 * const tradeTx = await pool.getTradeTransaction({
 *   walletAddress: "0x...",
 *   coinInType: "0x2::sui::SUI",
 *   coinInAmount: BigInt(1e9),
 *   coinOutType: "0x<yourCoin>",
 *   slippage: 0.01,
 * });
 * ```
 */
export class Pool extends Caller {
	/**
	 * Internal margin of error used in trade calculations to prevent
	 * exceeding maximum allowed percentages of pool balances.
	 */
	private static readonly constants = {
		percentageBoundsMarginOfError: 0.001, // 0.1%
	};

	/**
	 * An optional cached object containing statistical data about the pool
	 * (volume, fees, APR, etc.).
	 */
	public stats: PoolStats | undefined;

	/**
	 * Creates a new instance of the `Pool` class for on-chain interaction.
	 *
	 * @param pool - The fetched `PoolObject` from Aftermath API or on-chain query.
	 * @param config - Optional caller configuration (e.g., network, access token).
	 * @param Provider - An optional `AftermathApi` instance for advanced transaction usage.
	 */
	constructor(
		public readonly pool: PoolObject,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, `pools/${pool.objectId}`);
		this.pool = pool;
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds or fetches a deposit transaction to add liquidity to this pool.
	 * The resulting `Transaction` can be signed and submitted by the user.
	 *
	 * @param inputs - The deposit parameters including coin amounts, slippage, etc.
	 * @returns A `Transaction` to deposit funds into the pool.
	 *
	 * @example
	 * ```typescript
	 * const depositTx = await pool.getDepositTransaction({
	 *   walletAddress: "0x...",
	 *   amountsIn: { "0x<coin>": BigInt(1000000) },
	 *   slippage: 0.01,
	 * });
	 * ```
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
	 * Builds or fetches a withdrawal transaction to remove liquidity from this pool.
	 *
	 * @param inputs - The parameters specifying how much LP is burned, desired coins out, slippage, etc.
	 * @returns A `Transaction` to withdraw funds from the pool.
	 *
	 * @example
	 * ```typescript
	 * const withdrawTx = await pool.getWithdrawTransaction({
	 *   walletAddress: "0x...",
	 *   amountsOutDirection: {
	 *     "0x<coin>": BigInt(500000),
	 *   },
	 *   lpCoinAmount: BigInt(1000000),
	 *   slippage: 0.01,
	 * });
	 * ```
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
	 * Builds or fetches a transaction to withdraw all coin types from this pool,
	 * effectively "burning" an LP position in exchange for multiple coin outputs.
	 *
	 * @param inputs - The parameters specifying how much LP to burn.
	 * @returns A `Transaction` to withdraw all coins from the pool in proportion.
	 *
	 * @example
	 * ```typescript
	 * const allCoinWithdrawTx = await pool.getAllCoinWithdrawTransaction({
	 *   walletAddress: "0x...",
	 *   lpCoinAmount: BigInt(500000),
	 * });
	 * ```
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
	 * Builds or fetches a trade transaction to swap between two coin types in this pool.
	 *
	 * @param inputs - The trade parameters including coin in/out, amounts, slippage, etc.
	 * @returns A `Transaction` that can be signed and executed for the swap.
	 *
	 * @example
	 * ```typescript
	 * const tradeTx = await pool.getTradeTransaction({
	 *   walletAddress: "0x...",
	 *   coinInType: "0x<coinA>",
	 *   coinInAmount: BigInt(1000000),
	 *   coinOutType: "0x<coinB>",
	 *   slippage: 0.005,
	 * });
	 * ```
	 */
	public async getTradeTransaction(
		inputs: ApiPoolTradeBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildTradeTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Builds a transaction to update the DAO fee percentage for this pool,
	 * if it has a DAO fee configured. The user must own the appropriate
	 * `daoFeePoolOwnerCap`.
	 *
	 * @param inputs - Includes user wallet, `daoFeePoolOwnerCapId`, and the new fee percentage.
	 * @returns A `Transaction` that can be signed to update the DAO fee on chain.
	 * @throws If this pool has no DAO fee configuration.
	 *
	 * @example
	 * ```typescript
	 * const tx = await pool.getUpdateDaoFeeTransaction({
	 *   walletAddress: "0x...",
	 *   daoFeePoolOwnerCapId: "0x<capId>",
	 *   newFeePercentage: 0.01, // 1%
	 * });
	 * ```
	 */
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

	/**
	 * Builds a transaction to update the DAO fee recipient for this pool,
	 * if it has a DAO fee configured. The user must own the appropriate
	 * `daoFeePoolOwnerCap`.
	 *
	 * @param inputs - Includes user wallet, `daoFeePoolOwnerCapId`, and the new fee recipient.
	 * @returns A `Transaction` that can be signed to update the DAO fee recipient on chain.
	 * @throws If this pool has no DAO fee configuration.
	 *
	 * @example
	 * ```typescript
	 * const tx = await pool.getUpdateDaoFeeRecipientTransaction({
	 *   walletAddress: "0x...",
	 *   daoFeePoolOwnerCapId: "0x<capId>",
	 *   newFeeRecipient: "0x<recipient>",
	 * });
	 * ```
	 */
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
	 * Fetches comprehensive pool statistics (volume, TVL, fees, APR, etc.) from the Aftermath API.
	 * Also caches the result in `this.stats`.
	 *
	 * @returns A promise resolving to `PoolStats` object.
	 *
	 * @example
	 * ```typescript
	 * const stats = await pool.getStats();
	 * console.log(stats.volume, stats.fees, stats.apr);
	 * ```
	 */
	public async getStats(): Promise<PoolStats> {
		const stats = await this.fetchApi<PoolStats>("stats");
		this.setStats(stats);
		return stats;
	}

	/**
	 * Caches the provided stats object into `this.stats`.
	 *
	 * @param stats - The `PoolStats` object to store.
	 */
	public setStats(stats: PoolStats): void {
		this.stats = stats;
	}

	/**
	 * Fetches an array of volume data points for a specified timeframe.
	 * This is often used for charting or historical references.
	 *
	 * @param inputs - Contains a `timeframe` key, such as `"1D"` or `"1W"`.
	 * @returns A promise resolving to an array of `PoolDataPoint`.
	 *
	 * @example
	 * ```typescript
	 * const volumeData = await pool.getVolumeData({ timeframe: "1D" });
	 * console.log(volumeData); // e.g. [{ time: 1686000000, value: 123.45 }, ...]
	 * ```
	 */
	public async getVolumeData(inputs: {
		timeframe: PoolGraphDataTimeframeKey;
	}): Promise<PoolDataPoint[]> {
		return this.fetchApi(`volume/${inputs.timeframe}`);
	}

	/**
	 * Fetches an array of fee data points for a specified timeframe.
	 *
	 * @param inputs - Contains a `timeframe` key, e.g., `"1D"` or `"1W"`.
	 * @returns A promise resolving to an array of `PoolDataPoint`.
	 *
	 * @example
	 * ```typescript
	 * const feeData = await pool.getFeeData({ timeframe: "1D" });
	 * console.log(feeData);
	 * ```
	 */
	public async getFeeData(inputs: {
		timeframe: PoolGraphDataTimeframeKey;
	}): Promise<PoolDataPoint[]> {
		return this.fetchApi(`fees/${inputs.timeframe}`);
	}

	/**
	 * Retrieves the 24-hour volume for this specific pool.
	 *
	 * @returns A promise resolving to a number (volume in 24h).
	 *
	 * @example
	 * ```typescript
	 * const vol24h = await pool.getVolume24hrs();
	 * console.log("Pool 24h Volume:", vol24h);
	 * ```
	 */
	public getVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches user interaction events (deposit/withdraw) with this pool, optionally paginated.
	 *
	 * @param inputs - Includes user `walletAddress` and optional pagination fields.
	 * @returns A promise that resolves to `PoolDepositEvent | PoolWithdrawEvent` objects with a cursor if more exist.
	 *
	 * @example
	 * ```typescript
	 * const events = await pool.getInteractionEvents({ walletAddress: "0x...", limit: 10 });
	 * console.log(events.events, events.nextCursor);
	 * ```
	 */
	public async getInteractionEvents(
		inputs: ApiIndexerEventsBody & {
			walletAddress: SuiAddress;
		}
	) {
		return this.fetchApiIndexerEvents<
			PoolDepositEvent | PoolWithdrawEvent,
			ApiIndexerEventsBody
		>("interaction-events-by-user", inputs);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates the instantaneous spot price for swapping from `coinInType`
	 * to `coinOutType` within this pool. Optionally includes fees in the price.
	 *
	 * @param inputs - Object specifying input coin, output coin, and a boolean for `withFees`.
	 * @returns The numerical spot price (float).
	 *
	 * @example
	 * ```typescript
	 * const price = pool.getSpotPrice({
	 *   coinInType: "0x<coinA>",
	 *   coinOutType: "0x<coinB>",
	 *   withFees: true,
	 * });
	 * console.log("Spot Price:", price);
	 * ```
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

		// Adjust for decimals difference
		return (
			(spotPriceWithDecimals *
				Number(this.pool.coins[inputs.coinOutType].decimalsScalar)) /
			Number(this.pool.coins[inputs.coinInType].decimalsScalar)
		);
	};

	// TODO: account for referral discount for all calculations

	/**
	 * Calculates how much output coin you would receive when trading
	 * a given input coin and amount in this pool, factoring in protocol
	 * and optional DAO fees.
	 *
	 * @param inputs - Includes `coinInType`, `coinInAmount`, and `coinOutType`.
	 * @returns A bigint representing how many output coins you'd get.
	 * @throws Error if the trade amount is too large relative to the pool balance.
	 *
	 * @example
	 * ```typescript
	 * const amountOut = pool.getTradeAmountOut({
	 *   coinInType: "0x<coinA>",
	 *   coinInAmount: BigInt(1000000),
	 *   coinOutType: "0x<coinB>",
	 * });
	 * ```
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
	 * Calculates how much input coin is required to obtain a certain output coin amount
	 * from this pool, factoring in fees.
	 *
	 * @param inputs - Includes `coinInType`, desired `coinOutAmount`, and `coinOutType`.
	 * @returns A bigint representing the needed input amount.
	 * @throws Error if the desired output is too large relative to pool balances.
	 *
	 * @example
	 * ```typescript
	 * const amountIn = pool.getTradeAmountIn({
	 *   coinInType: "0x<coinA>",
	 *   coinOutAmount: BigInt(1000000),
	 *   coinOutType: "0x<coinB>"
	 * });
	 * ```
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
	 * Calculates how many LP tokens you receive for providing liquidity
	 * in specific coin amounts. Also returns a ratio for reference.
	 *
	 * @param inputs - Contains the amounts in for each coin in the pool.
	 * @returns An object with `lpAmountOut` and `lpRatio`.
	 *
	 * @example
	 * ```typescript
	 * const depositCalc = pool.getDepositLpAmountOut({
	 *   amountsIn: { "0x<coinA>": BigInt(1000000), "0x<coinB>": BigInt(500000) },
	 * });
	 * console.log(depositCalc.lpAmountOut, depositCalc.lpRatio);
	 * ```
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
	 * Calculates how many coins a user will receive when withdrawing a specific ratio or LP amount.
	 * This method is used in multi-coin withdrawals where you specify how much of each coin you want.
	 *
	 * @param inputs - The LP ratio and an object specifying direction amounts for each coin.
	 * @returns A `CoinsToBalance` object with final amounts out, factoring in DAO fees.
	 *
	 * @example
	 * ```typescript
	 * const outAmounts = pool.getWithdrawAmountsOut({
	 *   lpRatio: 0.1,
	 *   amountsOutDirection: { "0x<coinA>": BigInt(500000) },
	 * });
	 * console.log(outAmounts);
	 * ```
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
			if (amountOut <= 0) {
				throw new Error(`amountsOut[${coin}] <= 0`);
			}

			if (
				Number(amountOut) / Number(this.pool.coins[coin].balance) >=
				Pools.constants.bounds.maxWithdrawPercentageOfPoolBalance
			) {
				throw new Error(
					"coinOutAmount / coinOutPoolBalance >= maxWithdrawPercentageOfPoolBalance"
				);
			}

			amountsOut[coin] = this.getAmountWithDAOFee({ amount: amountOut });
		}

		return amountsOut;
	};

	/**
	 * A simplified multi-coin withdraw approach: calculates all outputs by proportion of the
	 * user's LP share among selected coin types. Useful for approximate or "blind" all-coin out logic.
	 *
	 * @param inputs - Contains the `lpCoinAmountIn` to burn, and which coin types to receive.
	 * @returns A record mapping coin type => final amounts out.
	 */
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
	 * Calculates how many coins you get when withdrawing **all** coin types from the pool,
	 * given a ratio. This is typically used for proportionate withdrawal.
	 *
	 * @param inputs - Includes `lpRatio`, the portion of your LP to burn (0 < ratio < 1).
	 * @returns A record of coin type => amounts out, after factoring in any fees.
	 *
	 * @example
	 * ```typescript
	 * const allOut = pool.getAllCoinWithdrawAmountsOut({ lpRatio: 0.1 });
	 * console.log(allOut); // amounts for each coin
	 * ```
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
	 * For multi-coin withdraw, calculates the ratio of how much LP you are burning
	 * relative to the total supply. e.g. if user burns 100 of 1000 supply => ratio 0.1.
	 *
	 * @param inputs - Contains the `lpCoinAmountIn` to burn.
	 * @returns A float ratio (0 < ratio < 1).
	 */
	public getMultiCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountIn: bigint;
	}): number =>
		Number(this.pool.lpCoinSupply - inputs.lpCoinAmountIn) /
		Number(this.pool.lpCoinSupply);

	/**
	 * For an all-coin withdraw, calculates the ratio of how much LP is burned
	 * relative to total supply. e.g. if user burns 50 of 200 supply => ratio 0.25.
	 *
	 * @param inputs - Contains the `lpCoinAmountIn`.
	 * @returns A float ratio, typically 0 < ratio < 1.
	 */
	public getAllCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountIn: bigint;
	}): number =>
		Number(inputs.lpCoinAmountIn) / Number(this.pool.lpCoinSupply);

	// =========================================================================
	//  Getters
	// =========================================================================

	/**
	 * Returns an array of coin types in ascending lexicographic order
	 * for the coins contained in this pool.
	 *
	 * @returns An array of coin type strings.
	 */
	public coins = (): CoinType[] => {
		return Object.keys(this.pool.coins).sort((a, b) => a.localeCompare(b));
	};

	/**
	 * Returns an array of `PoolCoin` objects, one for each coin in this pool,
	 * sorted lexicographically by coin type.
	 *
	 * @returns An array of `PoolCoin`.
	 */
	public poolCoins = (): PoolCoin[] => {
		return Object.entries(this.pool.coins)
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map((data) => data[1]);
	};

	/**
	 * Returns an array of `[CoinType, PoolCoin]` pairs, sorted by coin type.
	 *
	 * @returns An array of coin-type => `PoolCoin` pairs.
	 */
	public poolCoinEntries = (): [CoinType, PoolCoin][] => {
		return Object.entries(this.pool.coins).sort((a, b) =>
			a[0].localeCompare(b[0])
		);
	};

	/**
	 * Returns the current DAO fee percentage, if configured (0 < fee <= 100%).
	 *
	 * @returns A decimal fraction representing the fee (e.g., 0.01 = 1%) or `undefined`.
	 */
	public daoFeePercentage = (): Percentage | undefined => {
		return this.pool.daoFeePoolObject
			? Casting.bpsToPercentage(this.pool.daoFeePoolObject.feeBps)
			: undefined;
	};

	/**
	 * Returns the Sui address that currently receives the DAO fee portion of
	 * pool trades, or `undefined` if no DAO fee is configured.
	 *
	 * @returns The DAO fee recipient address.
	 */
	public daoFeeRecipient = (): SuiAddress | undefined => {
		return this.pool.daoFeePoolObject?.feeRecipient;
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Applies the DAO fee (if present) to a given `amount`, effectively reducing
	 * that amount by the fee fraction. e.g. if fee is 2%, it returns 98% of the input.
	 *
	 * @param inputs - Contains `amount` as a bigint.
	 * @returns The post-fee amount as a bigint.
	 */
	private getAmountWithDAOFee = (inputs: { amount: Balance }) => {
		const daoFeePercentage = this.daoFeePercentage();
		if (!daoFeePercentage) return inputs.amount;

		return BigInt(
			Math.floor(Number(inputs.amount) * (1 - daoFeePercentage))
		);
	};

	/**
	 * The inverse operation of `getAmountWithDAOFee`, used in internal calculations
	 * when we need to back out how much input was needed prior to the fee cut.
	 *
	 * @param inputs - Contains `amount` as a bigint.
	 * @returns The pre-fee amount as a bigint.
	 */
	private getAmountWithoutDAOFee = (inputs: { amount: Balance }) => {
		const daoFeePercentage = this.daoFeePercentage();
		if (!daoFeePercentage) return inputs.amount;

		return BigInt(
			Math.floor(Number(inputs.amount) * (1 / (1 - daoFeePercentage)))
		);
	};

	/**
	 * Provides an instance of the Pools provider from `AftermathApi`.
	 * Throws an error if not defined.
	 */
	private useProvider = () => {
		const provider = this.Provider?.Pools();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
