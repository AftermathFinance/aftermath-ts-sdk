import type { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../general/providers";
import { Casting, Helpers } from "../../general/utils";
import { Caller } from "../../general/utils/caller";
import type {
	ApiIndexerEventsBody,
	ApiPoolAllCoinWithdrawBody,
	ApiPoolDepositBody,
	ApiPoolTradeBody,
	ApiPoolWithdrawBody,
	Balance,
	CallerConfig,
	CoinsToBalance,
	CoinType,
	ObjectId,
	Percentage,
	PoolCoin,
	PoolDataPoint,
	PoolDepositEvent,
	PoolGraphDataTimeframeKey,
	PoolObject,
	PoolStats,
	PoolWithdrawEvent,
	SuiAddress,
} from "../../types";
import { Pools } from ".";
import { CmmmCalculations } from "./utils/cmmmCalculations";

/**
 * Represents one Aftermath AMM pool and its local math, API reads, and
 * transaction builders.
 *
 * Coin and LP amounts accepted by this class are `bigint` values in the
 * corresponding coin's smallest unit. Spot prices are decimal `number` ratios.
 * Local calculations use JavaScript floating-point intermediates and can differ
 * from Move by a rounding unit. Transaction builders use the pool estimate as
 * the expected value and pass the caller's slippage to Move for the final check.
 *
 * @example
 * ```typescript
 * const afSdk = await Aftermath.create({ network: "MAINNET" });
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
	 * Internal margin used when checking the protocol's maximum trade percentage.
	 * The value is a decimal fraction of a pool balance.
	 */
	private static readonly constants = {
		percentageBoundsMarginOfError: 0.001, // 0.1%
	};

	/**
	 * The last statistics object loaded by `getStats`, or `undefined` until a
	 * stats read completes. The cache is not refreshed automatically.
	 */
	public stats: PoolStats | undefined;

	/**
	 * Creates a local view of a fetched pool object.
	 *
	 * The constructor does not make a network request. Supply `api` when you
	 * need transaction builders. Without it, API-backed transaction methods throw
	 * `Error("missing AftermathApi instance")`.
	 *
	 * @param pool - The fetched `PoolObject`, including normalized coin balances.
	 * @param config - Optional API host, network, and access-token configuration.
	 * @param api - Optional provider used by transaction builders and referral setup.
	 */
	constructor(
		public readonly pool: PoolObject,
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, `pools/${pool.objectId}`);
		this.pool = pool;
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds a transaction that deposits liquidity into this pool.
	 *
	 * The method selects the wallet's input coin objects through `AftermathApi`,
	 * computes an expected LP ratio locally, and adds the Move deposit command.
	 * The returned `Transaction` is not signed or serialized.
	 *
	 * @param inputs - Wallet address, smallest-unit amounts keyed by coin type, and slippage.
	 * @returns An unsigned `Transaction` containing the deposit commands.
	 * @throws `Error` when no provider is attached or local pool math rejects the deposit.
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
		return this.poolsApi().fetchBuildDepositTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Builds a transaction that withdraws a fixed LP amount in a selected output direction.
	 *
	 * `amountsOutDirection` describes the relative output direction. The method
	 * computes expected smallest-unit outputs from `lpCoinAmount`, then encodes
	 * those expectations and `slippage` in the Move command. The returned
	 * `Transaction` is unsigned and not serialized.
	 *
	 * @param inputs - Wallet address, direction amounts, LP amount in smallest units, and slippage.
	 * @returns An unsigned `Transaction` containing the withdrawal commands.
	 * @throws `Error` when no provider is attached or local pool math rejects the withdrawal.
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
		return this.poolsApi().fetchBuildWithdrawTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Builds a transaction that burns an LP amount and returns every pool coin
	 * in proportion to the pool balances.
	 *
	 * `lpCoinAmount` is in LP smallest units. The returned `Transaction` is
	 * unsigned and not serialized. A configured referrer is registered before the
	 * withdrawal command, but this path does not take a slippage parameter.
	 *
	 * @param inputs - Wallet address, LP amount in smallest units, and optional referrer.
	 * @returns An unsigned `Transaction` containing the all-coin withdrawal.
	 * @throws `Error` when no provider is attached or coin selection fails.
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
		return this.poolsApi().fetchBuildAllCoinWithdrawTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Builds an unsigned exact-input swap transaction for two pool coin types.
	 *
	 * The method computes an expected output in smallest units, selects the input
	 * coin through `AftermathApi`, registers an optional referrer, and encodes the
	 * expected output with the caller's decimal slippage tolerance. It does not
	 * sign or serialize the returned `Transaction`.
	 *
	 * @param inputs - Wallet address, coin types, input amount in smallest units, and slippage.
	 * @returns An unsigned `Transaction` containing the swap command.
	 * @throws `Error` when no provider is attached, coin selection fails, or local math rejects the trade.
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
		return this.poolsApi().fetchBuildTradeTx({
			...inputs,
			pool: this,
		});
	}

	/**
	 * Builds an unsigned transaction that updates this pool's DAO fee.
	 *
	 * The provider converts `newFeePercentage` to basis points before encoding the
	 * Move call. The caller must own the `daoFeePoolOwnerCapId` capability.
	 *
	 * @param inputs - Wallet address, owner-cap object ID, and new decimal fee fraction.
	 * @returns An unsigned `Transaction` that updates the DAO fee in basis points.
	 * @throws `Error` when this pool has no DAO fee configuration or no provider is attached.
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
		if (!daoFeePoolId) {
			throw new Error("this pool has no DAO fee");
		}

		return this.poolsApi().buildDaoFeePoolUpdateFeeBpsTx({
			...inputs,
			daoFeePoolId,
			lpCoinType: this.pool.lpCoinType,
			newFeeBps: Casting.percentageToBps(inputs.newFeePercentage),
		});
	}

	/**
	 * Builds an unsigned transaction that updates this pool's DAO fee recipient.
	 *
	 * The caller must own the `daoFeePoolOwnerCapId` capability. The recipient is
	 * normalized to a full Sui address before it is encoded in Move.
	 *
	 * @param inputs - Wallet address, owner-cap object ID, and new recipient address.
	 * @returns An unsigned `Transaction` that updates the DAO fee recipient.
	 * @throws `Error` when this pool has no DAO fee configuration or no provider is attached.
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
		if (!daoFeePoolId) {
			throw new Error("this pool has no DAO fee");
		}

		return this.poolsApi().buildDaoFeePoolUpdateFeeRecipientTx({
			...inputs,
			daoFeePoolId,
			lpCoinType: this.pool.lpCoinType,
			newFeeRecipient: Helpers.addLeadingZeroesToType(inputs.newFeeRecipient),
		});
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetches the pool's analytics from the Aftermath API and caches the result.
	 *
	 * The API returns numeric metrics without a unit conversion in this class.
	 * Inspect the configured API's `PoolStats` contract for the meaning of each
	 * metric.
	 *
	 * @returns A promise for the current `PoolStats` object. The same object is stored in `stats`.
	 * @throws `AftermathTransportError` when the API request fails or its response cannot be decoded.
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
	 * Replaces the local statistics cache without making an API request.
	 *
	 * @param stats - The analytics object to store in `stats`.
	 */
	public setStats(stats: PoolStats): void {
		this.stats = stats;
	}

	/**
	 * Fetches volume data points for a supported analytics timeframe.
	 *
	 * @param inputs - A supported timeframe such as `"1D"` or `"1W"`.
	 * @returns A promise for API timestamps and numeric volume values.
	 * @throws `AftermathTransportError` when the API request or response fails.
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
	 * Fetches fee data points for a supported analytics timeframe.
	 *
	 * @param inputs - A supported timeframe such as `"1D"` or `"1W"`.
	 * @returns A promise for API timestamps and numeric fee values.
	 * @throws `AftermathTransportError` when the API request or response fails.
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
	 * Fetches this pool's 24-hour volume from the API.
	 *
	 * @returns A promise for the numeric API volume value. This class does not convert its unit.
	 * @throws `AftermathTransportError` when the API request or response fails.
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
	 * Fetches deposit and withdrawal events for one wallet in this pool.
	 *
	 * `cursor` and `limit` are forwarded to the indexer endpoint. When a full
	 * page is returned, the result includes the next numeric cursor.
	 *
	 * @param inputs - Wallet address and optional indexer pagination fields.
	 * @returns A promise for paginated `PoolDepositEvent` and `PoolWithdrawEvent` values.
	 * @throws `AftermathTransportError` when the indexer request or response fails.
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
	 * Calculates the instantaneous spot price from one pool coin to another.
	 *
	 * The result is a decimal `coinIn`-per-`coinOut` ratio adjusted for each
	 * coin's decimal scalar. By default the result excludes swap and DAO fees.
	 * Set `withFees` to `true` to include the fee terms used by the local CMMM
	 * calculation.
	 *
	 * @param inputs - Input and output coin types, plus the optional fee flag.
	 * @returns The decimal spot-price ratio in coin units, not a smallest-unit `bigint`.
	 * @throws When either coin type is not present in this pool.
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

	// Referral discounts are registered by transaction builders, but are not part
	// of these local estimates until the calculation path supports them.

	/**
	 * Calculates the output for an exact-input swap in this pool.
	 *
	 * The input and return value are smallest-unit `bigint` amounts. The local
	 * calculation applies the pool swap fees, the protocol fee, and the configured
	 * DAO fee. The `referral` flag is accepted for API compatibility but does not
	 * currently change this local estimate. A transaction referrer is registered
	 * separately by `getTradeTransaction`.
	 *
	 * @param inputs - Input type, smallest-unit amount, output type, and optional referral flag.
	 * @returns The expected output in `coinOutType` smallest units.
	 * @throws `Error` when the input or output exceeds the configured pool-balance limit or the result is zero.
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
		) {
			throw new Error(
				"coinInAmountWithFees / coinInPoolBalance >= maxTradePercentageOfPoolBalance"
			);
		}

		const coinOutAmount = CmmmCalculations.calcOutGivenIn(
			pool,
			inputs.coinInType,
			inputs.coinOutType,
			coinInAmountWithFees
		);

		if (coinOutAmount <= 0) {
			throw new Error("coinOutAmount <= 0");
		}

		if (
			Number(coinOutAmount) / Number(coinOutPoolBalance) >=
			Pools.constants.bounds.maxTradePercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		) {
			throw new Error(
				"coinOutAmount / coinOutPoolBalance >= maxTradePercentageOfPoolBalance"
			);
		}

		return coinOutAmount;
	};

	/**
	 * Calculates the input for an exact-output swap in this pool.
	 *
	 * The input and output are smallest-unit `bigint` amounts. The local
	 * calculation applies pool, protocol, and DAO fees when reversing the quote.
	 * The `referral` flag is accepted for API compatibility but does not currently
	 * change this local estimate.
	 *
	 * @param inputs - Input type, desired output in smallest units, output type, and optional referral flag.
	 * @returns The required input in `coinInType` smallest units.
	 * @throws `Error` when the requested output or calculated input exceeds the configured pool-balance limit or the result is zero.
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
		) {
			throw new Error(
				"coinOutAmount / coinOutPoolBalance >= maxTradePercentageOfPoolBalance"
			);
		}

		const coinInAmount = CmmmCalculations.calcInGivenOut(
			pool,
			inputs.coinInType,
			inputs.coinOutType,
			inputs.coinOutAmount
		);

		if (coinInAmount <= 0) {
			throw new Error("coinInAmount <= 0");
		}

		if (
			Number(coinInAmount) / Number(coinInPoolBalance) >=
			Pools.constants.bounds.maxTradePercentageOfPoolBalance -
				Pool.constants.percentageBoundsMarginOfError
		) {
			throw new Error(
				"coinInAmount / coinInPoolBalance >= maxTradePercentageOfPoolBalance"
			);
		}

		const coinInAmountWithoutFees = this.getAmountWithoutDAOFee({
			amount: Pools.getAmountWithoutProtocolFees({
				amount: coinInAmount,
			}),
		});

		return coinInAmountWithoutFees;
	};

	/**
	 * Calculates the LP result for a fixed-amount liquidity deposit.
	 *
	 * `lpAmountOut` is a smallest-unit LP amount. `lpRatio` is the decimal
	 * retained-balance scalar used by the CMMM solver. The implementation derives
	 * `lpAmountOut` as `floor(lpCoinSupply * (1 / lpRatio - 1))`, so `lpRatio` is
	 * not itself the minted-LP fraction. The optional referral flag does not alter
	 * this local estimate.
	 *
	 * @param inputs - Deposit amounts keyed by coin type in each coin's smallest unit.
	 * @returns The estimated LP smallest-unit amount and the decimal solver ratio.
	 * @throws `Error` when the solver returns a ratio of at least `1`.
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

		if (calcedLpRatio >= Casting.Fixed.fixedOneB) {
			throw new Error("lpRatio >= 1");
		}

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
	 * Calculates a multi-coin withdrawal for a retained LP ratio and output direction.
	 *
	 * `lpRatio` is the fraction of the original pool balance retained after the
	 * LP burn. For example, `0.9` means that 10% of the LP position is burned.
	 * Positive entries in `amountsOutDirection` select the direction and relative
	 * amounts. The returned record contains every pool coin in smallest units.
	 * DAO fees are deducted from selected positive outputs. The `referral` flag is
	 * currently accepted but does not change the local estimate.
	 *
	 * @param inputs - Retained LP ratio, output direction, and optional referral flag.
	 * @returns Output amounts keyed by pool coin type, in smallest units.
	 * @throws `Error` when a selected output is zero, too large for the pool, or fails the local invariant solve.
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
			) {
				continue;
			}

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
	 * Estimates a multi-coin withdrawal from an LP amount and selected output types.
	 *
	 * The method first estimates each selected coin from the LP share, uses those
	 * amounts as the direction vector, and returns the full pool-coin map produced
	 * by `getWithdrawAmountsOut`. Amounts are smallest-unit `bigint` values.
	 *
	 * @param inputs - LP amount to burn in smallest units, selected output types, and optional referral flag.
	 * @returns Estimated output amounts keyed by pool coin type, in smallest units.
	 * @throws `Error` when the LP amount or a selected output fails pool-balance checks.
	 */
	public getWithdrawAmountsOutSimple = (inputs: {
		lpCoinAmountIn: Balance;
		coinTypesOut: CoinType[];
		referral?: boolean;
	}): CoinsToBalance => {
		const { lpCoinAmountIn, coinTypesOut, referral } = inputs;

		const lpCoinSupply = this.pool.lpCoinSupply;

		const withdrawAmountsEstimates: CoinsToBalance = {};
		coinTypesOut.forEach((poolCoin) => {
			const poolCoinAmountInPool =
				this.pool.coins[Helpers.addLeadingZeroesToType(poolCoin)].balance;

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
			) {
				continue;
			}

			const amountOut = amountsOut[coin];
			if (amountOut <= BigInt(0)) {
				throw new Error(`amountsOut[${coin}] <= 0 `);
			}

			if (
				amountOut / this.pool.coins[coin].balance >=
				Pools.constants.bounds.maxWithdrawPercentageOfPoolBalance
			) {
				throw new Error(
					"coinOutAmount / coinOutPoolBalance >= maxWithdrawPercentageOfPoolBalance"
				);
			}

			amountsOut[coin] = this.getAmountWithDAOFee({
				amount: amountOut,
			});
		}

		return amountsOut;
	};

	/**
	 * Calculates a proportionate all-coin withdrawal.
	 *
	 * Here `lpRatio` is the fraction of LP supply burned, unlike the retained ratio
	 * accepted by `getWithdrawAmountsOut`. For example, `0.1` burns 10% and
	 * returns 10% of each pool balance after the configured DAO fee. The referral
	 * flag is accepted for API compatibility but does not alter this local estimate.
	 *
	 * @param inputs - Decimal LP fraction to burn. It must be less than `1`.
	 * @returns All pool coin amounts in smallest units, after DAO fee adjustment.
	 * @throws `Error` when `lpRatio` is at least `1`.
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
		if (inputs.lpRatio >= 1) {
			throw new Error("lpRatio >= 1");
		}

		const amountsOut: CoinsToBalance = Object.entries(this.pool.coins).reduce(
			(acc, [coin, info]) => {
				return {
					...acc,
					[coin]: this.getAmountWithDAOFee({
						amount: BigInt(Math.floor(Number(info.balance) * inputs.lpRatio)),
					}),
				};
			},
			{}
		);

		return amountsOut;
	};

	/**
	 * Converts a multi-coin LP burn amount into the retained pool ratio.
	 *
	 * For a supply of `1_000` and a burn of `100`, this method returns `0.9`.
	 *
	 * @param inputs - LP amount to burn in the LP coin's smallest unit.
	 * @returns The decimal fraction of the pool retained after the burn.
	 */
	public getMultiCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountIn: bigint;
	}): number =>
		Number(this.pool.lpCoinSupply - inputs.lpCoinAmountIn) /
		Number(this.pool.lpCoinSupply);

	/**
	 * Converts an all-coin LP burn amount into the burned pool ratio.
	 *
	 * For a supply of `200` and a burn of `50`, this method returns `0.25`.
	 *
	 * @param inputs - LP amount to burn in the LP coin's smallest unit.
	 * @returns The decimal fraction of the pool burned.
	 */
	public getAllCoinWithdrawLpRatio = (inputs: {
		lpCoinAmountIn: bigint;
	}): number => Number(inputs.lpCoinAmountIn) / Number(this.pool.lpCoinSupply);

	// =========================================================================
	//  Getters
	// =========================================================================

	/**
	 * Returns the pool coin types in ascending lexicographic order.
	 *
	 * @returns An array of coin type strings.
	 */
	public coins = (): CoinType[] => {
		return Object.keys(this.pool.coins).sort((a, b) => a.localeCompare(b));
	};

	/**
	 * Returns the pool coin metadata in coin-type order.
	 *
	 * @returns An array of `PoolCoin`.
	 */
	public poolCoins = (): PoolCoin[] => {
		return Object.entries(this.pool.coins)
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map((data) => data[1]);
	};

	/**
	 * Returns `[CoinType, PoolCoin]` entries sorted by coin type.
	 *
	 * @returns An array of coin-type => `PoolCoin` pairs.
	 */
	public poolCoinEntries = (): [CoinType, PoolCoin][] => {
		return Object.entries(this.pool.coins).sort((a, b) =>
			a[0].localeCompare(b[0])
		);
	};

	/**
	 * Returns the current DAO fee as a decimal fraction, if configured.
	 *
	 * @returns The fee fraction, where `0.01` is 1%, or `undefined` without a DAO fee pool.
	 */
	public daoFeePercentage = (): Percentage | undefined => {
		return this.pool.daoFeePoolObject
			? Casting.bpsToPercentage(this.pool.daoFeePoolObject.feeBps)
			: undefined;
	};

	/**
	 * Returns the Sui address that receives the configured DAO fee.
	 *
	 * @returns The normalized recipient address, or `undefined` without a DAO fee pool.
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
	private readonly getAmountWithDAOFee = (inputs: { amount: Balance }) => {
		const daoFeePercentage = this.daoFeePercentage();
		if (!daoFeePercentage) {
			return inputs.amount;
		}

		return BigInt(Math.floor(Number(inputs.amount) * (1 - daoFeePercentage)));
	};

	/**
	 * The inverse operation of `getAmountWithDAOFee`, used in internal calculations
	 * when we need to back out how much input was needed prior to the fee cut.
	 *
	 * @param inputs - Contains `amount` as a bigint.
	 * @returns The pre-fee amount as a bigint.
	 */
	private readonly getAmountWithoutDAOFee = (inputs: { amount: Balance }) => {
		const daoFeePercentage = this.daoFeePercentage();
		if (!daoFeePercentage) {
			return inputs.amount;
		}

		return BigInt(
			Math.floor(Number(inputs.amount) * (1 / (1 - daoFeePercentage)))
		);
	};

	/**
	 * Provides an instance of the Pools provider from `AftermathApi`.
	 * Throws an error if not defined.
	 */
	private readonly poolsApi = () => {
		const pools = this.api?.Pools();
		if (!pools) {
			throw new Error("missing AftermathApi instance");
		}
		return pools;
	};
}
