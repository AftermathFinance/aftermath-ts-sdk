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

	public async getClosePositionTx(inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
	}) {
		const marketId = inputs.marketId;
		const position = this.positionForMarketId({ marketId });
		const baseAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const isLong = Math.sign(baseAmount);

		if (isLong > 0) {
			return this.getPlaceMarketOrderTx({
				...inputs,
				side: true, // TODO: read some global constant for ASK=true and BID=false?
				size: position.baseAssetAmount,
			});
		} else {
			return this.getPlaceMarketOrderTx({
				...inputs,
				side: false, // TODO: read some global constant for ASK=true and BID=false?
				size: position.baseAssetAmount,
			});
		}
	}

	public async getPlaceOrderWithSLTP(inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
		side: boolean;
		size: bigint;
		price: bigint;
		orderType: bigint;
		slPrice: bigint;
		tpPrice: bigint;
	}) {
		let tx;
		tx = await this.getPlaceLimitOrderTx({
			...inputs,
		});

		// TODO: we can improve these checks to trigger SL and TP
		// If ASK and SL price is above target price, then place SL order too
		if (inputs.side && inputs.slPrice > inputs.price) {
			tx = await this.getPlaceLimitOrderTx({
				...inputs,
				side: !inputs.side,
				price: inputs.slPrice,
				orderType: BigInt(2), // TODO: constant for POST_ONLY order?
			});
		}

		// If BID and SL price is above target price, then place SL order too
		if (!inputs.side && inputs.tpPrice > inputs.price) {
			tx = await this.getPlaceLimitOrderTx({
				...inputs,
				side: !inputs.side,
				price: inputs.tpPrice,
				orderType: BigInt(2), // TODO: constant for POST_ONLY order?
			});
		}

		return tx;
	}

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

	calcMarginRatio = (inputs: {
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): number => {
		const totalFunding = this.calcUnrealizedFundingsForAccount({
			...inputs,
		});

		let collateral = IFixedUtils.numberFromIFixed(this.account.collateral);

		collateral -= totalFunding;
		const { totalPnL, totalNetAbsBaseValue } =
			this.calcPnLAndMarginForAccount({
				...inputs,
			});

		// If totalNetAbsBaseValue is 0 (no positions opened), MR would be +inf,
		// which can be displayed as N/A.
		// If also the collateral is 0 (no positions and nothing deposited yet),
		// then MR would be NaN, which can be displayed as N/A as well.
		return (
			(collateral * inputs.collateralPrice + totalPnL) /
			totalNetAbsBaseValue
		);
	};

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

		if (!position) return 0;

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
		totalNetAbsBaseValue: number;
	} => {
		const zipped = Helpers.zip(inputs.markets, inputs.indexPrices);
		let totalPnL = 0;
		let totalMinInitialMargin = 0;
		let totalMinMaintenanceMargin = 0;
		let totalNetAbsBaseValue = 0;

		zipped.forEach(([market, indexPrice]) => {
			const {
				pnl,
				minInitialMargin,
				minMaintenanceMargin,
				netAbsBaseValue,
			} = this.calcPnLAndMarginForPosition({
				market,
				indexPrice,
			});

			totalPnL += pnl;
			totalMinInitialMargin += minInitialMargin;
			totalMinMaintenanceMargin += minMaintenanceMargin;
			totalNetAbsBaseValue += netAbsBaseValue;
		});
		return {
			totalPnL,
			totalMinInitialMargin,
			totalMinMaintenanceMargin,
			totalNetAbsBaseValue,
		};
	};

	public calcPnLAndMarginForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
	}): {
		pnl: number;
		minInitialMargin: number;
		minMaintenanceMargin: number;
		netAbsBaseValue: number;
	} => {
		const marketId = inputs.market.marketId;
		const position = this.positionForMarketId({ marketId });

		if (!position)
			return {
				pnl: 0,
				minInitialMargin: 0,
				minMaintenanceMargin: 0,
				netAbsBaseValue: 0,
			};

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

		const netAbsBaseValue = netAbs * inputs.indexPrice;
		const minInitialMargin = netAbsBaseValue * marginRatioInitial;
		const minMaintenanceMargin = netAbsBaseValue * marginRatioMaintenance;

		return { pnl, minInitialMargin, minMaintenanceMargin, netAbsBaseValue };
	};

	public calcLiquidationPriceForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): number => {
		const marketId = inputs.market.marketId;
		const position = this.positionForMarketId({ marketId });

		if (!position) return 0;

		const totalFunding = this.calcUnrealizedFundingsForAccount({
			...inputs,
		});

		const collateral =
			IFixedUtils.numberFromIFixed(this.account.collateral) -
			totalFunding;

		const {
			totalPnL,
			totalMinInitialMargin,
			totalMinMaintenanceMargin,
			totalNetAbsBaseValue,
		} = this.calcPnLAndMarginForAccount({
			...inputs,
		});

		const { pnl, minInitialMargin, minMaintenanceMargin, netAbsBaseValue } =
			this.calcPnLAndMarginForPosition({
				market: inputs.market,
				indexPrice: inputs.indexPrice,
			});

		const baseAssetAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const MMR = IFixedUtils.numberFromIFixed(
			inputs.market.marketParams.marginRatioMaintenance
		);
		const accountValue = collateral * inputs.collateralPrice + totalPnL;
		if (baseAssetAmount > 0) {
			return (
				inputs.indexPrice -
				(accountValue - minMaintenanceMargin) /
					((1 - MMR) * (netAbsBaseValue / inputs.indexPrice))
			);
		} else {
			return (
				inputs.indexPrice +
				(accountValue - minMaintenanceMargin) /
					((1 - MMR) * (netAbsBaseValue / inputs.indexPrice))
			);
		}
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
