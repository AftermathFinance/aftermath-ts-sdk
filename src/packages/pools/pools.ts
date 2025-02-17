import {
	ApiCreatePoolBody,
	ApiEventsBody,
	ApiPoolObjectIdForLpCoinTypeBody,
	ApiPublishLpCoinBody,
	Balance,
	CoinType,
	PoolDepositEvent,
	PoolObject,
	PoolTradeEvent,
	PoolTradeFee,
	PoolWeight,
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
} from "../../types";
import { Pool } from "./pool";
import { Coin } from "../../packages/coin/coin";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { AftermathApi } from "../../general/providers";
import { PoolsApi } from "./api/poolsApi";

/**
 * @class Pools Provider
 *
 * @example
 * ```
 * // Create provider
 * const pools = (new Aftermath("MAINNET")).Pools();
 * // Call sdk
 * const pool = await pools.getPool({ objectId: "0xBEEF" });
 * ```
 */
export class Pools extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * An object containing various constants used in the pools module.
	 */
	public static readonly constants = {
		// TODO: remove this and use fixed class
		feePercentages: {
			totalProtocol: 0.00005, // 0.005%
			// following fees are taked as portions of total protocol fees above
			treasury: 0.5, // 50%
			insuranceFund: 0.3, // 30%
			devWallet: 0.2, // 20%
		},
		referralPercentages: {
			// these percantages are relative to treasury allocation
			discount: 0.05, // 5%
			rebate: 0.05, // 5%
		},
		bounds: {
			maxCoinsInPool: 8,
			maxTradePercentageOfPoolBalance: 0.3, // 30%
			maxWithdrawPercentageOfPoolBalance: 0.3, // 10%
			minSwapFee: 0.0001, // 0.01%
			maxSwapFee: 0.1, // 10%
			minWeight: 0.01, // 1%
			maxWeight: 0.99, // 99%
			minDaoFee: 0, // 0%
			maxDaoFee: 1, // 100%
		},
		defaults: {
			lpCoinDecimals: 9,
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates `Pools` provider to call api.
	 *
	 * @param network - The Sui network to interact with
	 * @returns New `Pools` instance
	 */

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "pools");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	// =========================================================================
	//  Pool Class
	// =========================================================================

	/**
	 * Creates new `Pool` class from queried pool object
	 *
	 * @param objectId - Object id of pool to fetch
	 * @returns New `Pool` instance
	 */
	public async getPool(inputs: { objectId: ObjectId }) {
		const pool = await this.fetchApi<PoolObject>(inputs.objectId);
		return new Pool(pool, this.network, this.Provider);
	}

	/**
	 * Creates `Pool[]` of classes from queried pool objects
	 *
	 * @param objectIds - Object ids of pools to fetch
	 * @returns New `Pool[]` instances
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
		return pools.map((pool) => new Pool(pool, this.network, this.Provider));
	}

	/**
	 * Retrieves all pools from the API and returns an array of Pool objects.
	 * @returns {Promise<Pool[]>} A promise that resolves to an array of Pool objects.
	 */
	public async getAllPools() {
		const pools: PoolObject[] = await this.fetchApi("", {});
		return pools.map((pool) => new Pool(pool, this.network, this.Provider));
	}

	public async getOwnedLpCoins(inputs: {
		walletAddress: SuiAddress;
	}): Promise<PoolLpInfo> {
		return this.fetchApi("owned-lp-coins", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Fetches the API transaction for publishing an LP coin.
	 * @param inputs - The inputs for the transaction.
	 * @returns A promise that resolves with the API transaction.
	 */
	public async getPublishLpCoinTransaction(inputs: ApiPublishLpCoinBody) {
		return this.useProvider().buildPublishLpCoinTx(inputs);
	}

	/**
	 * Fetches the transaction for creating a new pool.
	 * @param inputs The inputs required for creating a new pool.
	 * @returns A Promise that resolves to the transaction data.
	 */
	public async getCreatePoolTransaction(inputs: ApiCreatePoolBody) {
		return this.fetchApiTransaction("transactions/create-pool", inputs);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Returns the pool object ID for the given LP coin type.
	 * @param inputs - The request body containing the LP coin type.
	 * @returns The pool object ID.
	 * @throws An error if the LP coin type is invalid.
	 */
	public getPoolObjectIdForLpCoinType = (inputs: {
		lpCoinType: CoinType;
	}) => {
		return this.getPoolObjectIdsForLpCoinTypes({
			lpCoinTypes: [inputs.lpCoinType],
		});
	};

	public getPoolObjectIdsForLpCoinTypes = async (
		inputs: ApiPoolObjectIdForLpCoinTypeBody
	): Promise<(ObjectId | undefined)[]> => {
		// TODO: handle this case

		// if (
		// 	inputs.lpCoinTypes.some(
		// 		(lpCoinType) => !Pools.isPossibleLpCoinType({ lpCoinType })
		// 	)
		// )
		// 	throw new Error("invalid lp coin type");

		return this.fetchApi<
			(ObjectId | undefined)[],
			ApiPoolObjectIdForLpCoinTypeBody
		>("pool-object-ids", inputs);
	};

	/**
	 * Checks if the given coin type is an LP coin type.
	 * @param inputs - An object containing the LP coin type to check.
	 * @returns A boolean indicating whether the given coin type is an LP coin type.
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
	 * Retrieves the total volume in the last 24 hours.
	 * @returns A Promise that resolves to a number representing the total volume.
	 */
	public getTotalVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	public async getTVL(inputs?: { poolIds?: ObjectId[] }): Promise<number> {
		return this.fetchApi("tvl", inputs ?? {});
	}

	/**
	 * Fetches statistics for pools.
	 * @async
	 * @returns {Promise<PoolStats[]>} The statistics for pools.
	 */
	public async getPoolsStats(
		inputs: ApiPoolsStatsBody
	): Promise<PoolStats[]> {
		return this.fetchApi("stats", inputs);
	}

	public async getOwnedDaoFeePoolOwnerCaps(
		inputs: ApiPoolsOwnedDaoFeePoolOwnerCapsBody
	) {
		return this.useProvider().fetchOwnedDaoFeePoolOwnerCaps(inputs);
	}

	// =========================================================================
	//  Events
	// =========================================================================

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

	public static normalizeInvertSlippage = (slippage: Slippage) =>
		FixedUtils.directUncast(1 - slippage);

	// =========================================================================
	//  Display
	// =========================================================================

	public static displayLpCoinType = (lpCoinType: CoinType): string =>
		new Coin(lpCoinType).coinTypeSymbol
			.toLowerCase()
			.replace("af_lp_", "")
			.split("_")
			.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
			.join(" ") + " LP";

	// =========================================================================
	//  Helpers
	// =========================================================================

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

	private useProvider = () => {
		const provider = this.Provider?.Pools();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
