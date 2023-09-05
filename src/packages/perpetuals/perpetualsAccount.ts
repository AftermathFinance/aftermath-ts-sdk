import { SuiAddress } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCancelOrderBody,
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsLimitOrderBody,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsWithdrawCollateralBody,
	Balance,
	PerpetualsAccountCap,
	PerpetualsAccountObject,
	PerpetualsMarketId,
	PerpetualsOrderId,
	PerpetualsPosition,
	SuiNetwork,
	Url,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { Helpers } from "../../general/utils";

export class PerpetualsAccount extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly account: PerpetualsAccountObject,
		public readonly accountCap: PerpetualsAccountCap,
		public readonly network?: SuiNetwork | Url
	) {
		super(network);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Collateral Txs
	// =========================================================================

	public async getDepositCollateralTx(inputs: {
		walletAddress: SuiAddress;
		amount: Balance;
	}) {
		return this.fetchApiTransaction<ApiPerpetualsDepositCollateralBody>(
			"transactions/deposit-collateral",
			{
				...inputs,
				coinType: this.accountCap.coinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getWithdrawCollateralTx(inputs: {
		walletAddress: SuiAddress;
		amount: Balance;
	}) {
		return this.fetchApiTransaction<ApiPerpetualsWithdrawCollateralBody>(
			"transactions/withdraw-collateral",
			{
				...inputs,
				coinType: this.accountCap.coinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	// =========================================================================
	//  Order Txs
	// =========================================================================

	public async getPlaceMarketOrderTx(inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
		side: boolean;
		size: bigint;
	}) {
		return this.fetchApiTransaction<ApiPerpetualsMarketOrderBody>(
			"transactions/market-order",
			{
				...inputs,
				coinType: this.accountCap.coinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getPlaceLimitOrderTx(inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
		side: boolean;
		size: bigint;
		price: bigint;
		orderType: bigint;
	}) {
		return this.fetchApiTransaction<ApiPerpetualsLimitOrderBody>(
			"transactions/limit-order",
			{
				...inputs,
				coinType: this.accountCap.coinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getCancelOrderTx(inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
		side: boolean;
		orderId: PerpetualsOrderId;
	}) {
		return this.fetchApiTransaction<ApiPerpetualsCancelOrderBody>(
			"transactions/cancel-order",
			{
				...inputs,
				coinType: this.accountCap.coinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	// =========================================================================
	//  Position Txs
	// =========================================================================

	// TODO
	// public async getClosePositionTx(inputs: {
	// 	walletAddress: SuiAddress;
	// 	marketId: PerpetualsMarketId;
	// }) {
	// 	const position = this.positionForMarketId({ ...inputs });

	// 	return this.getPlaceMarketOrderTx({
	// 		...inputs,
	// 		side: if (position.baseAssetAmount,
	// 		size: position.baseAssetAmount,
	// 	});
	// }

	// TODO: place order + stop loss / take profits
	// =========================================================================
	//  Calculations
	// =========================================================================

	public calcFreeCollateral = (inputs: {
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): number => {
		const totalFunding = this.calcUnrealizedFundingsForAccount({
			...inputs,
		});

		const { totalPnL, totalMinInitialMargin } =
			this.calcPnLAndMarginForAccount({
				...inputs,
			});

		let collateral = IFixedUtils.numberFromIFixed(this.account.collateral);

		collateral -= totalFunding;

		let cappedMargin;
		if (totalPnL < 0) {
			cappedMargin = collateral * inputs.collateralPrice + totalPnL;
		} else {
			cappedMargin = collateral * inputs.collateralPrice;
		}

		if (cappedMargin >= totalMinInitialMargin) {
			return (
				(cappedMargin - totalMinInitialMargin) / inputs.collateralPrice
			);
		} else return 0;
	};

	// TODO
	// public calcMarginRatio = (inputs: {
	// 	markets: PerpetualsMarket[];
	// 	indexPrices: number[];
	// 	collateralPrice: number;
	// }): number => {
	// 	const totalFunding = this.calcUnrealizedFundingsForAccount({
	// 		...inputs,
	// 	});

	// 	let collateral = IFixedUtils.numberFromIFixed(this.account.collateral);

	// 	collateral -= totalFunding;

	// 	let cappedMargin;
	// 	if (totalPnL < 0) {
	// 		cappedMargin = collateral * inputs.collateralPrice + totalPnL;
	// 	} else {
	// 		cappedMargin = collateral * inputs.collateralPrice;
	// 	}

	// 	if (cappedMargin >= totalMinMargin) {
	// 		return (cappedMargin - totalMinMargin) / inputs.collateralPrice;
	// 	} else return 0;
	// };

	public calcUnrealizedFundingsForAccount = (inputs: {
		markets: PerpetualsMarket[];
	}): number => {
		let totalFunding = 0;

		inputs.markets.forEach((market) => {
			totalFunding += this.calcUnrealizedFundingsForPosition({
				market,
			});
		});

		return totalFunding;
	};

	public calcUnrealizedFundingsForPosition = (inputs: {
		market: PerpetualsMarket;
	}): number => {
		const marketId = inputs.market.marketId;

		const position = this.positionForMarketId({ marketId });
		const baseAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const isLong = Math.sign(baseAmount);

		if (isLong > 0) {
			const fundingShort = IFixedUtils.numberFromIFixed(
				position.cumFundingRateShort
			);
			const marketFundingShort = IFixedUtils.numberFromIFixed(
				inputs.market.marketState.cumFundingRateShort
			);
			return -baseAmount * (marketFundingShort - fundingShort);
		} else {
			const fundingLong = IFixedUtils.numberFromIFixed(
				position.cumFundingRateLong
			);
			const marketFundingLong = IFixedUtils.numberFromIFixed(
				inputs.market.marketState.cumFundingRateLong
			);
			return -baseAmount * (marketFundingLong - fundingLong);
		}
	};

	public calcPnLAndMarginForAccount = (inputs: {
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): {
		totalPnL: number;
		totalMinInitialMargin: number;
		totalMinMaintenanceMargin: number;
	} => {
		const zipped = Helpers.zip(inputs.markets, inputs.indexPrices);
		let totalPnL = 0;
		let totalMinInitialMargin = 0;
		let totalMinMaintenanceMargin = 0;

		zipped.forEach(([market, indexPrice]) => {
			const { pnl, minInitialMargin, minMaintenanceMargin } =
				this.calcPnLAndMarginForPosition({
					market,
					indexPrice,
				});

			totalPnL += pnl;
			totalMinInitialMargin += minInitialMargin;
			totalMinMaintenanceMargin += minMaintenanceMargin;
		});
		return {
			totalPnL,
			totalMinInitialMargin,
			totalMinMaintenanceMargin,
		};
	};

	public calcPnLAndMarginForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
	}): {
		pnl: number;
		minInitialMargin: number;
		minMaintenanceMargin: number;
	} => {
		const marketId = inputs.market.marketId;
		const position = this.positionForMarketId({ marketId });
		const marginRatioInitial = IFixedUtils.numberFromIFixed(
			inputs.market.marketParams.marginRatioInitial
		);
		const marginRatioMaintenance = IFixedUtils.numberFromIFixed(
			inputs.market.marketParams.marginRatioMaintenance
		);
		const baseAssetAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const quoteAssetAmount = IFixedUtils.numberFromIFixed(
			position.quoteAssetNotionalAmount
		);
		const bidsQuantity = IFixedUtils.numberFromIFixed(
			position.bidsQuantity
		);
		const asksQuantity = IFixedUtils.numberFromIFixed(
			position.asksQuantity
		);
		const pnl = baseAssetAmount * inputs.indexPrice - quoteAssetAmount;

		const netAbs = Math.max(
			Math.abs(baseAssetAmount + bidsQuantity),
			Math.abs(baseAssetAmount - asksQuantity)
		);

		const minInitialMargin =
			netAbs * marginRatioInitial * inputs.indexPrice;
		const minMaintenanceMargin =
			netAbs * marginRatioMaintenance * inputs.indexPrice;

		return { pnl, minInitialMargin, minMaintenanceMargin };
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public accountMarketIds(): PerpetualsMarketId[] {
		let res: PerpetualsMarketId[] = [];
		this.account.positions.forEach((position) => {
			res.push(position.marketId);
		});

		return res;
	}

	public positionForMarketId(inputs: {
		marketId: PerpetualsMarketId;
	}): PerpetualsPosition {
		try {
			return this.account.positions.find(
				(pos) => pos.marketId === inputs.marketId
			)!;
		} catch (e) {
			throw new Error("no position found for market");
		}
	}
}
