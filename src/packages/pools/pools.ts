import {
	ApiCreatePoolBody,
	ApiEventsBody,
	ApiPoolObjectIdForLpCoinTypeBody,
	ApiPublishLpCoinBodyV1,
	Balance,
	CoinType,
	PoolDepositEvent,
	PoolObject,
	PoolTradeEvent,
	PoolTradeFee,
	PoolWithdrawEvent,
	Slippage,
	SuiNetwork,
	Url,
	ObjectId,
	PoolStats,
	ApiPoolsStatsBody,
	ApiPoolsOwnedDaoFeePoolOwnerCapsBody,
	PoolLpInfo,
	SuiAddress,
	ApiIndexerEventsBody,
	CallerConfig,
	ApiPublishLpCoinBodyV2,
} from "../../types";
import { Pool } from "./pool";
import { Coin } from "../../packages/coin/coin";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { AftermathApi } from "../../general/providers";
import { PoolsApi } from "./api/poolsApi";

/**
 * The `Pools` class provides a high-level interface for interacting with
 * Aftermath Finance liquidity pools. It allows fetching individual or multiple
 * pools, managing liquidity pool tokens (LP tokens), and creating new pools
 * if you have the required privileges.
 *
 * @example
 * ```typescript
 * const afSdk = new Aftermath("MAINNET");
 * await afSdk.init(); // initialize provider
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
	 * Static constants relevant to the pool logic, such as protocol fees,
	 * referral percentages, and bounds for trading/withdrawal percentages.
	 */
	public static readonly constants = {
		/**
		 * Protocol fee structure: `totalProtocol` is the fraction of trades
		 * that is taken as a fee, which is split among `treasury`, `insuranceFund`,
		 * and `devWallet` in the given proportions.
		 */
		feePercentages: {
			/**
			 * The total fraction (as a decimal) of trades charged by the protocol.
			 * e.g., 0.00005 => 0.005%.
			 */
			totalProtocol: 0.00005,
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
		 * Referral fee structures, applying a discount/rebate to the user and
		 * referrer, taken from the treasury portion of protocol fees.
		 */
		referralPercentages: {
			/**
			 * The fraction of the treasury portion that discounts the user's fee.
			 */
			discount: 0.05,
			/**
			 * The fraction of the treasury portion that acts as a rebate to the referrer.
			 */
			rebate: 0.05,
		},
		/**
		 * Various bounds used to prevent extreme trades or invalid pool configurations.
		 */
		bounds: {
			/**
			 * Maximum decimals for LP coins.
			 */
			maxCoinDecimals: 18,
			/**
			 * Maximum number of distinct coins allowed in a single pool.
			 */
			maxCoinsInPool: 8,
			/**
			 * Maximum fraction (decimal) of a pool's balance that can be traded at once.
			 */
			maxTradePercentageOfPoolBalance: 0.3,
			/**
			 * Maximum fraction (decimal) of a pool's balance that can be withdrawn at once.
			 */
			maxWithdrawPercentageOfPoolBalance: 0.3,
			/**
			 * Minimum and maximum swap fees (0.01% to 10%).
			 */
			minSwapFee: 0.0001,
			maxSwapFee: 0.1,
			/**
			 * Minimum and maximum coin weight for weighted pools (1% to 99%).
			 */
			minWeight: 0.01,
			maxWeight: 0.99,
			/**
			 * Minimum and maximum DAO fee (0% to 100%).
			 */
			minDaoFee: 0,
			maxDaoFee: 1,
		},
		/**
		 * Default parameter(s) used in the absence of explicit user or code settings.
		 */
		defaults: {
			/**
			 * Default decimals for LP coins if none are specified.
			 */
			lpCoinDecimals: 9,
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new `Pools` instance for querying and managing AMM pools on Aftermath.
	 *
	 * @param config - Optional configuration object specifying network or access token.
	 * @param Provider - An optional `AftermathApi` instance providing advanced transaction building.
	 */
	constructor(
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
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
	 * Fetches a single pool by its on-chain `objectId` and returns a new `Pool` instance.
	 *
	 * @param inputs - An object containing `objectId`.
	 * @returns A promise that resolves to a `Pool` instance.
	 *
	 * @example
	 * ```typescript
	 * const pool = await pools.getPool({ objectId: "0x<poolId>" });
	 * console.log(pool.pool.lpCoinType, pool.pool.name);
	 * ```
	 */
	public async getPool(inputs: { objectId: ObjectId }) {
		const pool = await this.fetchApi<PoolObject>(inputs.objectId);
		return new Pool(pool, this.config, this.Provider);
	}

	/**
	 * Fetches multiple pools by their on-chain `objectIds` and returns an array of `Pool` instances.
	 *
	 * @param inputs - An object containing an array of `objectIds`.
	 * @returns A promise that resolves to an array of `Pool` instances.
	 *
	 * @example
	 * ```typescript
	 * const poolArray = await pools.getPools({ objectIds: ["0x<id1>", "0x<id2>"] });
	 * console.log(poolArray.length);
	 * ```
	 */
	public async getPools(inputs: { objectIds: ObjectId[] }) {
		const pools = await this.fetchApi<
			PoolObject[],
			{
				poolIds: ObjectId[];
			}
		>("", {
			poolIds: inputs.objectIds,
		});
		return pools.map((pool) => new Pool(pool, this.config, this.Provider));
	}

	/**
	 * Retrieves all pools recognized by the Aftermath API, returning an array of `Pool` objects.
	 *
	 * @returns An array of `Pool` instances.
	 *
	 * @example
	 * ```typescript
	 * const allPools = await pools.getAllPools();
	 * console.log(allPools.map(p => p.pool.name));
	 * ```
	 */
	public async getAllPools() {
		const pools: PoolObject[] = await this.fetchApi("", {});
		return pools.map((pool) => new Pool(pool, this.config, this.Provider));
	}

	/**
	 * Fetches information about all owned LP coins for a given wallet address.
	 * This indicates the user's liquidity positions across multiple pools.
	 *
	 * @param inputs - An object containing the `walletAddress`.
	 * @returns A `PoolLpInfo` object summarizing the user's LP balances.
	 *
	 * @example
	 * ```typescript
	 * const lpCoins = await pools.getOwnedLpCoins({ walletAddress: "0x<address>" });
	 * console.log(lpCoins);
	 * ```
	 */
	public async getOwnedLpCoins(inputs: {
		walletAddress: SuiAddress;
	}): Promise<PoolLpInfo> {
		return this.fetchApi("owned-lp-coins", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Constructs or fetches a transaction to publish a new LP coin package,
	 * typically used by advanced users or devs establishing new liquidity pools.
	 *
	 * @param inputs - Includes the user `walletAddress` and the `lpCoinDecimals`.
	 * @returns A transaction object (or data) that can be signed and published to Sui.
	 * @deprecated Use getPublishLpCoinTransactionV2
	 *
	 * @example
	 * ```typescript
	 * const publishTx = await pools.getPublishLpCoinTransactionV1({
	 *   walletAddress: "0x<address>",
	 *   lpCoinDecimals: 9
	 * });
	 * ```
	 */
	public async getPublishLpCoinTransactionV1(inputs: ApiPublishLpCoinBodyV1) {
		return this.useProvider().buildPublishLpCoinTx(inputs);
	}

	/**
	 * Constructs a transaction to create a new LP coin on-chain,
	 * typically used by advanced users or devs establishing new liquidity pools.
	 *
	 * @param inputs - The body describing how to form the new LP coin.
	 * @returns A transaction object that can be signed and executed.
	 *
	 * @example
	 * ```typescript
	 * const createLpTx = await pools.getCreateLpTransaction({
	 *   walletAddress: "0x<address>",
	 *   lpCoinMetadata: {
	 *     name: "MyPool LP",
	 *     symbol: "MYPLP"
	 *   },
	 *   coinsInfo: [
	 *     {
	 *       coinType: "0x<coinA>",
	 *       weight: 0.5,
	 *       decimals: 9
	 *     },
	 *     // ...
	 *   ],
	 *   poolName: "My Weighted Pool",
	 *   poolFlatness: 1,
	 *   respectDecimals: true,
	 * });
	 * ```
	 */
	public async getPublishLpCoinTransactionV2(inputs: ApiPublishLpCoinBodyV2) {
		return this.fetchApiTransaction(
			"transactions/publish-lp-coin-v2",
			inputs
		);
	}

	/**
	 * Constructs a transaction to create a brand new pool on-chain, given coin types,
	 * initial weights, fees, and possible DAO fee info.
	 *
	 * @param inputs - The body describing how to form the new pool.
	 * @returns A transaction object that can be signed and executed.
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
	 * Retrieves the on-chain pool object ID corresponding to a specific LP coin type.
	 *
	 * @param inputs - Contains the `lpCoinType` string.
	 * @returns The pool object ID if it exists.
	 *
	 * @example
	 * ```typescript
	 * const poolId = await pools.getPoolObjectIdForLpCoinType({
	 *   lpCoinType: "0x<lpCoinType>"
	 * });
	 * console.log(poolId);
	 * ```
	 */
	public getPoolObjectIdForLpCoinType = (inputs: {
		lpCoinType: CoinType;
	}) => {
		return this.getPoolObjectIdsForLpCoinTypes({
			lpCoinTypes: [inputs.lpCoinType],
		});
	};

	/**
	 * Retrieves multiple pool object IDs given an array of LP coin types.
	 * If a given LP coin type has no associated pool, it might return `undefined`.
	 *
	 * @param inputs - Contains an array of `lpCoinTypes`.
	 * @returns An array of `ObjectId | undefined` of matching length.
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
		inputs: ApiPoolObjectIdForLpCoinTypeBody
	): Promise<(ObjectId | undefined)[]> {
		return this.fetchApi<
			(ObjectId | undefined)[],
			ApiPoolObjectIdForLpCoinTypeBody
		>("pool-object-ids", inputs);
	}

	/**
	 * Checks if a given coin type is recognized as an LP coin.
	 * Internally calls `getPoolObjectIdForLpCoinType`.
	 *
	 * @param inputs - Contains the `lpCoinType` to check.
	 * @returns `true` if the coin is an LP token, `false` otherwise.
	 */
	public isLpCoinType = async (inputs: { lpCoinType: CoinType }) => {
		try {
			await this.getPoolObjectIdForLpCoinType(inputs);
			return true;
		} catch (e) {
			return false;
		}
	};

	/**
	 * Retrieves the total volume across all pools in the last 24 hours.
	 *
	 * @returns A promise resolving to a numeric volume (e.g., in USD).
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
	 * Retrieves the total value locked (TVL) across all or specific pool IDs.
	 *
	 * @param inputs - Optionally provide an array of specific `poolIds`. If omitted, returns global TVL.
	 * @returns A promise resolving to a numeric TVL (e.g., in USD).
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
	 * Fetches an array of `PoolStats` objects for a given set of pools,
	 * including volume, fees, TVL, and other metrics.
	 *
	 * @param inputs - Must include an array of `poolIds`.
	 * @returns An array of `PoolStats` in matching order.
	 *
	 * @example
	 * ```typescript
	 * const stats = await pools.getPoolsStats({ poolIds: ["0x<id1>", "0x<id2>"] });
	 * console.log(stats[0].volume, stats[1].tvl);
	 * ```
	 */
	public async getPoolsStats(
		inputs: ApiPoolsStatsBody
	): Promise<PoolStats[]> {
		return this.fetchApi("stats", inputs);
	}

	/**
	 * Returns all DAO fee pool owner capabilities owned by a particular user.
	 * This is used to see which pools' DAO fees the user can update.
	 *
	 * @param inputs - An object with user `walletAddress`.
	 * @returns Data about each `DaoFeePoolOwnerCapObject` the user owns.
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
		return this.useProvider().fetchOwnedDaoFeePoolOwnerCaps(inputs);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches user-specific interaction events (deposits, withdrawals) across pools,
	 * optionally with pagination.
	 *
	 * @param inputs - An object containing `walletAddress`, plus optional pagination (`cursor`, `limit`).
	 * @returns An event set with a cursor for further queries if available.
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
	 * Returns how much coin remains **after** applying the protocol fees
	 * (and referral discount if `withReferral` is `true`).
	 *
	 * @param inputs - The original `amount` and an optional referral flag.
	 * @returns The post-fee (net) amount as a bigint.
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
					(1 -
						(this.constants.feePercentages.totalProtocol -
							referralDiscount))
			)
		);
	};

	/**
	 * The inverse calculation: given a net amount (post-fees), figure out
	 * the original gross amount. Used when we already have fees subtracted
	 * but need to restore an original quantity.
	 *
	 * @param inputs - The net `amount` after fees, plus an optional referral flag.
	 * @returns The original gross amount as a bigint.
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
							(this.constants.feePercentages.totalProtocol -
								referralDiscount)))
			)
		);
	};

	/**
	 * A helper to transform a user-provided slippage fraction, e.g. 0.01,
	 * into a 1 - slippage format, if needed for certain math operations.
	 *
	 * @param slippage - The decimal fraction of slippage tolerance, e.g. 0.01 => 1%.
	 * @returns A big integer representing `1 - slippage` in a fixed context.
	 */
	public static normalizeInvertSlippage = (slippage: Slippage) =>
		FixedUtils.directUncast(1 - slippage);

	// =========================================================================
	//  Display
	// =========================================================================

	/**
	 * Produces a user-friendly string for an LP coin type, e.g. "Sui Coin LP"
	 * by analyzing the coin type symbol. Typically used in UIs or logs.
	 *
	 * @param lpCoinType - The coin type for the LP token.
	 * @returns A string representation for display, e.g. "Af_lp_abc" => "Abc LP".
	 */
	public static displayLpCoinType = (lpCoinType: CoinType): string =>
		Coin.getCoinTypeSymbol(lpCoinType)
			.toLowerCase()
			.replace("af_lp_", "")
			.split("_")
			.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
			.join(" ") + " LP";

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * A quick heuristic check to see if the given `lpCoinType` string
	 * might represent an Aftermath LP token. This is not a full on-chain validation.
	 *
	 * @param inputs - An object containing `lpCoinType`.
	 * @returns `true` if it matches a known pattern; otherwise `false`.
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
	private useProvider = () => {
		const provider = this.Provider?.Pools();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
