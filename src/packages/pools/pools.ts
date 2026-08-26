import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Helpers } from "../../general/utils/helpers";
import { Coin } from "../../packages/coin/coin";
import type {
	ApiCreatePoolBody,
	ApiIndexerEventsBody,
	ApiPoolObjectIdForLpCoinTypeBody,
	ApiPoolsOwnedDaoFeePoolOwnerCapsBody,
	ApiPoolsStatsBody,
	ApiPoolsSummaryBody,
	ApiPublishLpCoinBody,
	Balance,
	CallerConfig,
	CoinType,
	ObjectId,
	PoolDepositEvent,
	PoolLpInfo,
	PoolObject,
	PoolStats,
	PoolSummary,
	PoolWithdrawEvent,
	Slippage,
	SuiAddress,
} from "../../types";
import { Pool } from "./pool";

/**
 * Provides high-level pool reads, transaction requests, fee helpers, and pool
 * discovery for Aftermath AMMs.
 *
 * API methods return decoded `bigint` amounts in coin or LP smallest units.
 * Transaction methods return unsigned `Transaction` objects. Network failures
 * are normalized as `AftermathTransportError` by the shared caller.
 *
 * @example
 * ```typescript
 * const afSdk = await Aftermath.create({ network: "MAINNET" });
 *
 * const pools = afSdk.Pools();
 *
 * // Fetch a single pool
 * const pool = await pools.getPool({ objectId: "0x<poolId>" });
 *
 * // Fetch multiple pools
 * const poolArray = await pools.getPools({ objectIds: ["0x<id1>", "0x<id2>"] });
 * ```
 */
export class Pools extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Protocol fee fractions, referral settings, safety bounds, and defaults used
	 * by the high-level pool helpers.
	 */
	public static readonly constants = {
		/**
		 * Protocol fee fractions. `totalProtocol` is taken from a trade and the
		 * other fields describe its allocation.
		 */
		feePercentages: {
			/**
			 * The total decimal fraction charged by the protocol. `0.00005` is
			 * `0.005%`.
			 */
			totalProtocol: 0.000_05,
			/**
			 * The fraction of `totalProtocol` allocated to the treasury.
			 */
			treasury: 0.5,
			/**
			 * The fraction of `totalProtocol` allocated to the insurance fund.
			 */
			insuranceFund: 0.3,
			/**
			 * The fraction of `totalProtocol` allocated to the dev wallet.
			 */
			devWallet: 0.2,
		},
		/**
		 * Referral fractions applied to the treasury allocation. The static fee
		 * helper uses `discount`; referral transaction builders register the
		 * referrer separately.
		 */
		referralPercentages: {
			/**
			 * The fraction of the treasury allocation used as a user fee discount.
			 */
			discount: 0.05,
			/**
			 * The configured fraction of the treasury allocation reserved as a
			 * referrer rebate.
			 */
			rebate: 0.05,
		},
		/**
		 * Decimal safety bounds enforced by local estimates and pool creation
		 * validation.
		 */
		bounds: {
			/**
			 * Maximum number of distinct coins allowed in a single pool.
			 */
			maxCoinsInPool: 8,
			/**
			 * Maximum decimal fraction of a pool balance accepted for one trade.
			 */
			maxTradePercentageOfPoolBalance: 0.3,
			/**
			 * Maximum decimal fraction of a pool balance accepted for one withdrawal.
			 */
			maxWithdrawPercentageOfPoolBalance: 0.3,
			/**
			 * Minimum and maximum decimal swap fees. The range is `0.0001` to `0.1`,
			 * or `0.01%` to `10%`.
			 */
			minSwapFee: 0.0001,
			maxSwapFee: 0.1,
			/**
			 * Minimum and maximum decimal coin weights. The range is 1% to 99%.
			 */
			minWeight: 0.01,
			maxWeight: 0.99,
			/**
			 * Minimum and maximum decimal DAO fees. The range is 0% to 100%.
			 */
			minDaoFee: 0,
			maxDaoFee: 1,
		},
		/**
		 * Defaults used when a caller does not supply an explicit value.
		 */
		defaults: {
			/**
			 * Default LP coin decimal precision.
			 */
			lpCoinDecimals: 9,
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a pool client without making a network request.
	 *
	 * Supply `api` when transaction methods must select coins or configure
	 * referral transactions. Read methods can use `config` alone.
	 *
	 * @param config - Optional API host, network, and access-token configuration.
	 * @param api - Optional provider used by transaction builders and DAO-fee commands.
	 */
	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "pools");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	// =========================================================================
	//  Pool Class
	// =========================================================================

	/**
	 * Fetches one pool by its on-chain object ID and wraps it in `Pool`.
	 *
	 * @param inputs - The pool object ID to read.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for a `Pool` backed by the decoded API object.
	 * @throws `AftermathTransportError` for HTTP, network, abort, timeout, or decode failures.
	 *
	 * @example
	 * ```typescript
	 * const pool = await pools.getPool({ objectId: "0x<poolId>" });
	 * console.log(pool.pool.lpCoinType, pool.pool.name);
	 * ```
	 */
	public async getPool(
		inputs: { objectId: ObjectId },
		abortSignal?: AbortSignal
	) {
		const pool = await this.fetchApi<PoolObject>(
			inputs.objectId,
			undefined,
			abortSignal
		);
		return new Pool(pool, this.config, this.api);
	}

	/**
	 * Fetches multiple pools by object ID and wraps the returned objects in `Pool`.
	 *
	 * @param inputs - The pool object IDs to read.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for pools in the API response order.
	 * @throws `AftermathTransportError` for the batch request or response failures.
	 *
	 * @example
	 * ```typescript
	 * const poolArray = await pools.getPools({ objectIds: ["0x<id1>", "0x<id2>"] });
	 * console.log(poolArray.length);
	 * ```
	 */
	public async getPools(
		inputs: { objectIds: ObjectId[] },
		abortSignal?: AbortSignal
	) {
		const pools = await this.fetchApi<
			PoolObject[],
			{
				poolIds: ObjectId[];
			}
		>(
			"",
			{
				poolIds: inputs.objectIds,
			},
			abortSignal
		);
		return pools.map((pool) => new Pool(pool, this.config, this.api));
	}

	/**
	 * Fetches every pool recognized by the Aftermath API.
	 *
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for all decoded `Pool` instances.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const allPools = await pools.getAllPools();
	 * console.log(allPools.map(p => p.pool.name));
	 * ```
	 */
	public async getAllPools(abortSignal?: AbortSignal) {
		const pools: PoolObject[] = await this.fetchApi("", {}, abortSignal);
		return pools.map((pool) => new Pool(pool, this.config, this.api));
	}

	/**
	 * Fetches the LP coin balances owned by a wallet across pools.
	 *
	 * @param inputs - The wallet address to inspect.
	 * @returns A promise for LP coin types, pool IDs, and smallest-unit balances.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const lpCoins = await pools.getOwnedLpCoins({ walletAddress: "0x<address>" });
	 * console.log(lpCoins);
	 * ```
	 */
	public async getOwnedLpCoins(inputs: {
		walletAddress: SuiAddress;
	}): Promise<PoolLpInfo[]> {
		return this.fetchApi("owned-lp-coins", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds an unsigned transaction that publishes the compiled LP coin package.
	 *
	 * The transaction transfers the resulting upgrade capability to
	 * `walletAddress`. It is not signed, submitted, or serialized by this method.
	 *
	 * @param inputs - Publisher address and compiled LP coin decimal precision.
	 * @returns A promise for the unsigned publish `Transaction`.
	 * @throws `Error` when the provider lacks the compiled package for the requested decimals.
	 *
	 * @example
	 * ```typescript
	 * const publishTx = await pools.getPublishLpCoinTransaction({
	 *   walletAddress: "0x<address>",
	 *   lpCoinDecimals: 9
	 * });
	 * ```
	 */
	public async getPublishLpCoinTransaction(inputs: ApiPublishLpCoinBody) {
		return this.poolsApi().buildPublishLpCoinTx(inputs);
	}

	/**
	 * Builds an unsigned transaction that creates a new pool on chain.
	 *
	 * The API serializes nested `bigint` deposits with an `n` suffix, and the
	 * caller must supply a creation capability and initial coin balances. This
	 * method does not sign, submit, or serialize the returned `Transaction`.
	 *
	 * @param inputs - Pool type, metadata, coin configuration, capability, and fee settings.
	 * @returns A promise for the unsigned pool-creation `Transaction`.
	 * @throws `AftermathTransportError` when the API cannot build or decode the transaction.
	 *
	 * @example
	 * ```typescript
	 * const createPoolTx = await pools.getCreatePoolTransaction({
	 *   walletAddress: "0x<address>",
	 *   lpCoinType: "0x<lpCoin>",
	 *   lpCoinMetadata: {
	 *     name: "MyPool LP",
	 *     symbol: "MYPLP"
	 *   },
	 *   coinsInfo: [
	 *     {
	 *       coinType: "0x<coinA>",
	 *       weight: 0.5,
	 *       decimals: 9,
	 *       tradeFeeIn: 0.003,
	 *       initialDeposit: 1_000_000_000n
	 *     },
	 *     // ...
	 *   ],
	 *   poolName: "My Weighted Pool",
	 *   createPoolCapId: "0x<capId>",
	 *   respectDecimals: true,
	 * });
	 * ```
	 */
	public async getCreatePoolTransaction(inputs: ApiCreatePoolBody) {
		return this.fetchApiTransaction("transactions/create-pool", inputs);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Resolves one LP coin type through the batch pool-ID endpoint.
	 *
	 * The response is an array with one entry, which can be `undefined` when the
	 * type is not registered. Use `getPoolObjectIdsForLpCoinTypes` for several
	 * types.
	 *
	 * @param inputs - The LP coin type to resolve.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for a one-entry `(ObjectId | undefined)[]` result.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const poolId = await pools.getPoolObjectIdForLpCoinType({
	 *   lpCoinType: "0x<lpCoinType>"
	 * });
	 * console.log(poolId);
	 * ```
	 */
	public getPoolObjectIdForLpCoinType = (
		inputs: { lpCoinType: CoinType },
		abortSignal?: AbortSignal
	) => {
		return this.getPoolObjectIdsForLpCoinTypes(
			{
				lpCoinTypes: [inputs.lpCoinType],
			},
			abortSignal
		);
	};

	/**
	 * Resolves LP coin types to pool object IDs.
	 *
	 * The response preserves input order and uses `undefined` for an LP type with
	 * no associated pool.
	 *
	 * @param inputs - LP coin types to resolve.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for one result per input type.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const poolIds = await pools.getPoolObjectIdsForLpCoinTypes({
	 *   lpCoinTypes: ["0x<lpCoinA>", "0x<lpCoinB>"]
	 * });
	 * console.log(poolIds);
	 * ```
	 */
	public async getPoolObjectIdsForLpCoinTypes(
		inputs: ApiPoolObjectIdForLpCoinTypeBody,
		abortSignal?: AbortSignal
	): Promise<(ObjectId | undefined)[]> {
		return this.fetchApi<
			(ObjectId | undefined)[],
			ApiPoolObjectIdForLpCoinTypeBody
		>("pool-object-ids", inputs, abortSignal);
	}

	/**
	 * Checks whether an LP coin type maps to a registered pool.
	 *
	 * This performs the same API read as `getPoolObjectIdForLpCoinType` and does
	 * not validate the coin type from its string shape alone.
	 *
	 * @param inputs - The LP coin type to resolve.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for `true` when the API returns a pool ID.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public isLpCoinType = async (
		inputs: { lpCoinType: CoinType },
		abortSignal?: AbortSignal
	): Promise<boolean> => {
		const result = await this.getPoolObjectIdForLpCoinType(inputs, abortSignal);
		return result.some((id) => id !== undefined);
	};

	/**
	 * Fetches the protocol-wide 24-hour pool volume.
	 *
	 * @returns A promise for the numeric API value. This method does not convert its unit.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const totalVol24 = await pools.getTotalVolume24hrs();
	 * console.log("Protocol-wide 24h volume:", totalVol24);
	 * ```
	 */
	public getTotalVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	/**
	 * Fetches total value locked across all pools or a selected pool set.
	 *
	 * @param inputs - Optional pool IDs. Omit the argument for protocol-wide TVL.
	 * @returns A promise for the numeric API TVL value. This method does not convert its unit.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const allTvl = await pools.getTVL();
	 * const subsetTvl = await pools.getTVL({ poolIds: ["0x<id1>", "0x<id2>"] });
	 * ```
	 */
	public async getTVL(inputs?: { poolIds?: ObjectId[] }): Promise<number> {
		return this.fetchApi("tvl", inputs ?? {});
	}

	/**
	 * Fetches analytics for a selected set of pools.
	 *
	 * @param inputs - Pool object IDs to include, in the requested order.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for the corresponding `PoolStats` values.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const stats = await pools.getPoolsStats({ poolIds: ["0x<id1>", "0x<id2>"] });
	 * console.log(stats[0].volume, stats[1].tvl);
	 * ```
	 */
	public async getPoolsStats(
		inputs: ApiPoolsStatsBody,
		abortSignal?: AbortSignal
	): Promise<PoolStats[]> {
		return this.fetchApi("stats", inputs, abortSignal);
	}

	/**
	 * Fetches pool objects and analytics in one API response.
	 *
	 * Omit `poolIds` to request every pool summary.
	 *
	 * @param inputs - Optional pool IDs to include.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for pool objects paired with current `PoolStats`.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getPoolSummaries(
		inputs?: ApiPoolsSummaryBody,
		abortSignal?: AbortSignal
	): Promise<PoolSummary[]> {
		return this.fetchApi("summary", inputs ?? {}, abortSignal);
	}

	/**
	 * Fetches DAO fee owner capabilities owned by a wallet.
	 *
	 * Each returned capability identifies a DAO fee pool whose fee or recipient
	 * the wallet can update. DAO-fee package addresses must be configured.
	 *
	 * @param inputs - The wallet address to inspect.
	 * @returns A promise for the owned DAO fee capability objects.
	 * @throws `Error` when DAO-fee addresses are not configured.
	 *
	 * @example
	 * ```typescript
	 * const daoCaps = await pools.getOwnedDaoFeePoolOwnerCaps({
	 *   walletAddress: "0x<address>"
	 * });
	 * console.log(daoCaps);
	 * ```
	 */
	public async getOwnedDaoFeePoolOwnerCaps(
		inputs: ApiPoolsOwnedDaoFeePoolOwnerCapsBody
	) {
		return this.poolsApi().fetchOwnedDaoFeePoolOwnerCaps(inputs);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches a wallet's deposit and withdrawal events across pools.
	 *
	 * @param inputs - Wallet address and optional indexer pagination fields.
	 * @returns A promise for paginated `PoolDepositEvent` and `PoolWithdrawEvent` values.
	 * @throws `AftermathTransportError` when the indexer request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const userEvents = await pools.getInteractionEvents({
	 *   walletAddress: "0x...",
	 *   limit: 10,
	 * });
	 * console.log(userEvents.events, userEvents.nextCursor);
	 * ```
	 */
	public async getInteractionEvents(
		inputs: ApiIndexerEventsBody & {
			walletAddress: SuiAddress;
		}
	) {
		return this.fetchApiIndexerEvents<
			PoolDepositEvent | PoolWithdrawEvent,
			ApiIndexerEventsBody & {
				walletAddress: SuiAddress;
			}
		>("interaction-events-by-user", inputs);
	}

	// =========================================================================
	//  Fees
	// =========================================================================

	/**
	 * Applies the protocol fee to a smallest-unit amount.
	 *
	 * The default protocol fee is `0.00005`, or `0.005%`. With
	 * `withReferral: true`, the helper reduces only the treasury portion by the
	 * configured referral discount. It does not register a referrer or calculate
	 * the separate referrer rebate. Use a referral-aware transaction builder for
	 * that side effect.
	 *
	 * @param inputs - The gross amount in a coin's smallest unit and optional referral flag.
	 * @returns The net amount in the same smallest unit, rounded down.
	 *
	 * @example
	 * ```typescript
	 * const netAmount = Pools.getAmountWithProtocolFees({ amount: 1_000_000n });
	 * ```
	 */
	public static getAmountWithProtocolFees = (inputs: {
		amount: Balance;
		withReferral?: boolean;
	}) => {
		const referralDiscount = inputs.withReferral
			? this.constants.feePercentages.totalProtocol *
				this.constants.feePercentages.treasury *
				this.constants.referralPercentages.discount
			: 0;

		return BigInt(
			Math.floor(
				Number(inputs.amount) *
					(1 - (this.constants.feePercentages.totalProtocol - referralDiscount))
			)
		);
	};

	/**
	 * Reverses `getAmountWithProtocolFees` for a smallest-unit amount.
	 *
	 * The result is rounded down. With `withReferral: true`, it uses the same
	 * treasury discount as the forward calculation. It does not register a
	 * referrer or pay a referral rebate.
	 *
	 * @param inputs - The net amount in a coin's smallest unit and optional referral flag.
	 * @returns The estimated gross amount in the same smallest unit, rounded down.
	 */
	public static getAmountWithoutProtocolFees = (inputs: {
		amount: Balance;
		withReferral?: boolean;
	}) => {
		const referralDiscount = inputs.withReferral
			? this.constants.feePercentages.totalProtocol *
				this.constants.feePercentages.treasury *
				this.constants.referralPercentages.discount
			: 0;

		return BigInt(
			Math.floor(
				Number(inputs.amount) *
					(1 /
						(1 -
							(this.constants.feePercentages.totalProtocol - referralDiscount)))
			)
		);
	};

	/**
	 * Converts a decimal slippage tolerance to the fixed-point minimum-result factor.
	 *
	 * @param slippage - A decimal fraction from `0` to `1`. `0.01` represents 1%.
	 * @returns `1 - slippage` encoded as an on-chain fixed-point bigint.
	 */
	public static normalizeInvertSlippage = (slippage: Slippage) =>
		FixedUtils.directUncast(1 - slippage);

	// =========================================================================
	//  Display
	// =========================================================================

	/**
	 * Formats an Aftermath LP coin type for display.
	 *
	 * The method reads the type symbol, removes the `AF_LP_` prefix when present,
	 * title-cases underscore-separated components, and appends `LP`. It does not
	 * validate the type on chain.
	 *
	 * @param lpCoinType - The fully qualified LP coin type.
	 * @returns A display label such as `"A B LP"`.
	 */
	public static displayLpCoinType = (lpCoinType: CoinType): string =>
		`${Coin.getCoinTypeSymbol(lpCoinType)
			.toLowerCase()
			.replace("af_lp_", "")
			.split("_")
			.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
			.join(" ")} LP`;

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Performs a string-shape check for an Aftermath LP coin type.
	 *
	 * The check requires three `::` segments, an `af_lp` module segment, and an
	 * `AF_LP` symbol segment. It does not query the API or prove that a pool exists.
	 *
	 * @param inputs - The coin type string to inspect.
	 * @returns `true` when the string matches the heuristic pattern.
	 */
	public static isPossibleLpCoinType = (inputs: { lpCoinType: CoinType }) => {
		const { lpCoinType } = inputs;
		return (
			lpCoinType.split("::").length === 3 &&
			lpCoinType.split("::")[1].includes("af_lp") &&
			lpCoinType.split("::")[2].includes("AF_LP")
		);
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Provides a typed reference to the `Pools` part of the `AftermathApi`,
	 * throwing an error if not defined.
	 */
	private readonly poolsApi = () => {
		const pools = this.api?.Pools();
		if (!pools) {
			throw new Error("missing AftermathApi instance");
		}
		return pools;
	};
}
