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
} from "../../types";
import { Pool } from "./pool";
import { Coin } from "../../packages/coin/coin";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";
import { Fixed } from "../../general/utils/fixed";

/**
 * @class Pools Provider
 *
 * @example
 * ```
 * // Create provider
 * const pools = (new Aftermath("TESTNET")).Pools();
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
	constructor(public readonly network?: SuiNetwork | Url) {
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
		return new Pool(pool, this.network);
	}

	/**
	 * Creates `Pool[]` of classes from queried pool objects
	 *
	 * @param objectIds - Object ids of pools to fetch
	 * @returns New `Pool[]` instances
	 */
	public async getPools(inputs: { objectIds: ObjectId[] }) {
		// NOTE: should this pass array of pools directly instead (caching performance though...)
		// could put logic for handling into api itself (prob best idea)
		const pools = await Promise.all(
			inputs.objectIds.map((objectId) => this.getPool({ objectId }))
		);
		return pools;
	}

	/**
	 * Retrieves all pools from the API and returns an array of Pool objects.
	 * @returns {Promise<Pool[]>} A promise that resolves to an array of Pool objects.
	 */

	public async getAllPools() {
		const pools = await this.fetchApi<PoolObject[]>("");
		return pools.map((pool) => new Pool(pool, this.network));
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
		return this.fetchApiTransaction<ApiPublishLpCoinBody>(
			"transactions/publish-lp-coin",
			inputs
		);
	}

	/**
	 * Fetches the transaction for creating a new pool.
	 * @param inputs The inputs required for creating a new pool.
	 * @returns A Promise that resolves to the transaction data.
	 */
	public async getCreatePoolTransaction(inputs: ApiCreatePoolBody) {
		return this.fetchApiTransaction<ApiCreatePoolBody>(
			"transactions/create-pool",
			inputs
		);
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
	public getPoolObjectIdForLpCoinType = (
		inputs: ApiPoolObjectIdForLpCoinTypeBody
	) => {
		if (!Pools.isPossibleLpCoinType(inputs))
			throw new Error("invalid lp coin type");

		return this.fetchApi<ObjectId, ApiPoolObjectIdForLpCoinTypeBody>(
			"pool-object-id",
			inputs
		);
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

	public static normalizeSlippage = (slippage: Slippage) =>
		Fixed.directUncast(1 - slippage);

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
}
