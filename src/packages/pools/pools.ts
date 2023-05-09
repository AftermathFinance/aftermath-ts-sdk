import { ObjectId } from "@mysten/sui.js";
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
} from "../../types";
import { Pool } from "./pool";
import { Coin } from "../../packages/coin/coin";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";

/**
 * @class Pools Provider
 *
 * @example
 * ```
 * // Create provider
 * const pools = (new Aftermath("testnet")).Pools();
 * // Call sdk
 * const pool = await pools.getPool({ objectId: "0xBEEF" });
 * ```
 */
export class Pools extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		decimals: {
			lpCoinDecimals: 9,
			coinWeightDecimals: 18,
			spotPriceDecimals: 18,
			tradeFeeDecimals: 18,
			slippageDecimals: 18,
		},
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
			maxCoinsInPool: 12,
			maxSwapPercentageOfPoolBalance: 0.3, // 30%
			minSwapFee: 0.0001,
			maxSwapFee: 0.1,
			minWeight: 0.01,
			maxWeight: 0.99,
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	/**
	 * Creates `Pools` provider to call api.
	 *
	 * @param network - The Sui network to interact with
	 * @returns New `Pools` instance
	 */
	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "pools");
	}

	/////////////////////////////////////////////////////////////////////
	//// Class Objects
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Pool Class
	/////////////////////////////////////////////////////////////////////

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

	public async getAllPools() {
		const pools = await this.fetchApi<PoolObject[]>("");
		return pools.map((pool) => new Pool(pool, this.network));
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getPublishLpCoinTransaction(inputs: ApiPublishLpCoinBody) {
		return this.fetchApiTransaction<ApiPublishLpCoinBody>(
			"transactions/publish-lp-coin",
			inputs
		);
	}

	public async getCreatePoolTransaction(inputs: ApiCreatePoolBody) {
		return this.fetchApiTransaction<ApiCreatePoolBody>(
			"transactions/create-pool",
			inputs
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getDepositEvents(inputs: ApiEventsBody) {
		return this.fetchApiEvents<PoolDepositEvent>("events/deposit", inputs);
	}

	public async getWithdrawEvents(inputs: ApiEventsBody) {
		return this.fetchApiEvents<PoolWithdrawEvent>(
			"events/withdraw",
			inputs
		);
	}

	public async getTradeEvents(inputs: ApiEventsBody) {
		return this.fetchApiEvents<PoolTradeEvent>("events/trade", inputs);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public getPoolObjectIdForLpCoinType = (
		inputs: ApiPoolObjectIdForLpCoinTypeBody
	) => {
		return this.fetchApi<ObjectId, ApiPoolObjectIdForLpCoinTypeBody>(
			"pool-object-id",
			inputs
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Fees
	/////////////////////////////////////////////////////////////////////

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

	/////////////////////////////////////////////////////////////////////
	//// With Decimals Conversions
	/////////////////////////////////////////////////////////////////////

	public static coinWeightWithDecimals = (weight: PoolWeight) =>
		Number(weight) / 10 ** Pools.constants.decimals.coinWeightDecimals;

	public static spotPriceWithDecimals = (spotPrice: Balance) =>
		Number(spotPrice) / 10 ** Pools.constants.decimals.spotPriceDecimals;

	public static tradeFeeWithDecimals = (tradeFee: PoolTradeFee) =>
		Number(tradeFee) / 10 ** Pools.constants.decimals.tradeFeeDecimals;

	public static lpCoinBalanceWithDecimals = (balance: Balance) =>
		Number(balance) / 10 ** Pools.constants.decimals.lpCoinDecimals;

	/////////////////////////////////////////////////////////////////////
	//// Normalize Conversions
	/////////////////////////////////////////////////////////////////////

	public static normalizePoolTradeFee = (tradeFee: PoolTradeFee) => {
		return Coin.balanceWithDecimals(
			tradeFee,
			Pools.constants.decimals.tradeFeeDecimals
		);
	};

	public static normalizeLpCoinBalance = (balance: number) =>
		Coin.normalizeBalance(balance, Pools.constants.decimals.lpCoinDecimals);

	public static normalizeSlippage = (slippage: Slippage) =>
		Coin.normalizeBalance(
			1 - slippage,
			Pools.constants.decimals.slippageDecimals
		);

	/////////////////////////////////////////////////////////////////////
	//// Display
	/////////////////////////////////////////////////////////////////////

	public static displayLpCoinType = (lpCoinType: CoinType): string =>
		new Coin(lpCoinType).coinTypeSymbol
			.toLowerCase()
			.replace("af_lp_", "")
			.split("_")
			.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
			.join(" ") + " LP";
}
