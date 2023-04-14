import { ObjectId } from "@mysten/sui.js";
import {
	ApiEventsBody,
	ApiPoolObjectIdForLpCoinTypeBody,
	Balance,
	CoinType,
	EventsWithCursor,
	PoolDepositEvent,
	PoolObject,
	PoolTradeEvent,
	PoolTradeFee,
	PoolWeight,
	PoolWithdrawEvent,
	Slippage,
	SuiNetwork,
} from "../../types";
import { Pool } from "./pool";
import { Coin } from "../../packages/coin/coin";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";

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
			maxSwapPercentageOfPoolBalance: 0.3, // 30%
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "pools");
	}

	/////////////////////////////////////////////////////////////////////
	//// Class Objects
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Pool Class
	/////////////////////////////////////////////////////////////////////

	public async getPool(inputs: { objectId: ObjectId }): Promise<Pool> {
		const pool = await this.fetchApi<PoolObject>(`${inputs.objectId}`);
		return new Pool(pool, this.network);
	}

	public async getPools(inputs: { objectIds: ObjectId[] }): Promise<Pool[]> {
		const pools = await Promise.all(
			inputs.objectIds.map((objectId) => this.getPool({ objectId }))
		);
		return pools;
	}

	public async getAllPools(): Promise<Pool[]> {
		const pools = await this.fetchApi<PoolObject[]>("");
		return pools.map((pool) => new Pool(pool, this.network));
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getDepositEvents(
		inputs: ApiEventsBody
	): Promise<EventsWithCursor<PoolDepositEvent>> {
		return this.fetchApi<EventsWithCursor<PoolDepositEvent>, ApiEventsBody>(
			"events/deposit",
			inputs
		);
	}

	public async getWithdrawEvents(
		inputs: ApiEventsBody
	): Promise<EventsWithCursor<PoolWithdrawEvent>> {
		return this.fetchApi<
			EventsWithCursor<PoolWithdrawEvent>,
			ApiEventsBody
		>("events/withdraw", inputs);
	}

	public async getTradeEvents(
		inputs: ApiEventsBody
	): Promise<EventsWithCursor<PoolTradeEvent>> {
		return this.fetchApi<EventsWithCursor<PoolTradeEvent>, ApiEventsBody>(
			"events/trade",
			inputs
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public getPoolObjectIdForLpCoinType = (
		inputs: ApiPoolObjectIdForLpCoinTypeBody
	) => {
		return this.fetchApi<ObjectId, ApiPoolObjectIdForLpCoinTypeBody>(
			"poolObjectId",
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
		new Coin(Coin.coinTypeFromKeyType(lpCoinType)).coinTypeSymbol
			.toLowerCase()
			.replace("af_lp_", "")
			.split("_")
			.map((word) => Helpers.capitalizeOnlyFirstLetter(word))
			.join(" ") + " LP";
}
