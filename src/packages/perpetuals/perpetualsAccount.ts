import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCancelOrderBody,
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsLimitOrderBody,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsPreviewOrderBody,
	ApiPerpetualsPreviewOrderResponse,
	ApiPerpetualsSLTPOrderBody,
	ApiPerpetualsWithdrawCollateralBody,
	Balance,
	PerpetualsAccountCap,
	PerpetualsAccountObject,
	PerpetualsMarketId,
	PerpetualsOrderId,
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsPosition,
	SdkPerpetualsLimitOrderInputs,
	SdkPerpetualsMarketOrderInputs,
	SdkPerpetualsSLTPOrderInputs,
	SuiNetwork,
	Url,
	SuiAddress,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { Perpetuals } from "./perpetuals";

export class PerpetualsAccount extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly account: PerpetualsAccountObject,
		public readonly accountCap: PerpetualsAccountCap,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, "perpetuals");
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
				collateralCoinType: this.accountCap.collateralCoinType,
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
				collateralCoinType: this.accountCap.collateralCoinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	// =========================================================================
	//  Order Txs
	// =========================================================================

	public async getPlaceMarketOrderTx(inputs: SdkPerpetualsMarketOrderInputs) {
		return this.fetchApiTransaction<ApiPerpetualsMarketOrderBody>(
			"transactions/market-order",
			{
				...inputs,
				collateralCoinType: this.accountCap.collateralCoinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getPlaceLimitOrderTx(inputs: SdkPerpetualsLimitOrderInputs) {
		return this.fetchApiTransaction<ApiPerpetualsLimitOrderBody>(
			"transactions/limit-order",
			{
				...inputs,
				collateralCoinType: this.accountCap.collateralCoinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getPlaceSLTPOrder(inputs: SdkPerpetualsSLTPOrderInputs) {
		return this.fetchApiTransaction<ApiPerpetualsSLTPOrderBody>(
			"transactions/sltp-order",
			{
				...inputs,
				collateralCoinType: this.accountCap.collateralCoinType,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getCancelOrderTx(inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		orderId: PerpetualsOrderId;
	}) {
		return this.fetchApiTransaction<ApiPerpetualsCancelOrderBody>(
			"transactions/cancel-order",
			{
				...inputs,
				collateralCoinType: this.accountCap.collateralCoinType,
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
		return this.getPlaceMarketOrderTx(this.closePositionTxInputs(inputs));
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getOrderPreview(
		inputs: Omit<
			ApiPerpetualsPreviewOrderBody,
			"accountId" | "collateralCoinType" | "accountCapId"
		>
	) {
		return this.fetchApi<
			ApiPerpetualsPreviewOrderResponse,
			ApiPerpetualsPreviewOrderBody
		>("preview-order", {
			...inputs,
			accountId: this.accountCap.accountId,
			collateralCoinType: this.accountCap.collateralCoinType,
			accountCapId: this.accountCap.objectId,
		});
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public calcFreeCollateral = (inputs: {
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): number => {
		const totalFunding = this.calcUnrealizedFundingsForAccount(inputs);

		const { totalPnL, totalMinInitialMargin } =
			this.calcPnLAndMarginForAccount(inputs);

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

	public calcMarginRatioAndLeverageForAccount = (inputs: {
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): {
		totalMarginRatio: number;
		totalLeverage: number;
	} => {
		const totalFunding = this.calcUnrealizedFundingsForAccount(inputs);
		const collateral = this.collateral() - totalFunding;

		const { totalPnL, totalNetAbsBaseValue } =
			this.calcPnLAndMarginForAccount(inputs);

		// If totalNetAbsBaseValue is 0 (no positions opened), MR would be +inf,
		// which can be displayed as N/A.
		// If also the collateral is 0 (no positions and nothing deposited yet),
		// then MR would be NaN, which can be displayed as N/A as well.
		const totalMarginRatio =
			totalNetAbsBaseValue === 0
				? 0
				: (collateral * inputs.collateralPrice + totalPnL) /
				  totalNetAbsBaseValue;
		const totalLeverage = totalMarginRatio === 0 ? 0 : 1 / totalMarginRatio;

		return {
			totalMarginRatio,
			totalLeverage,
		};
	};

	public calcMarginRatioAndLeverageForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): {
		marginRatio: number;
		leverage: number;
	} => {
		const { market, indexPrice } = inputs;

		const marketId = market.marketId;
		const position =
			inputs.position ?? this.positionForMarketId({ marketId });

		const funding = this.calcUnrealizedFundingsForPosition({
			market,
			position,
		});
		const collateral = this.collateral() - funding;

		const { pnl, netAbsBaseValue } = this.calcPnLAndMarginForPosition({
			market,
			indexPrice,
			position,
		});

		const marginRatio =
			netAbsBaseValue === 0
				? 0
				: (collateral * inputs.collateralPrice + pnl) / netAbsBaseValue;
		const leverage = marginRatio === 0 ? 0 : 1 / marginRatio;

		return {
			marginRatio,
			leverage,
		};
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
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;

		const position =
			inputs.position ?? this.positionForMarketId({ marketId });

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
		position?: PerpetualsPosition;
	}): {
		pnl: number;
		minInitialMargin: number;
		minMaintenanceMargin: number;
		netAbsBaseValue: number;
	} => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ?? this.positionForMarketId({ marketId });

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
		position?: PerpetualsPosition;
		indexPrice: number;
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ?? this.positionForMarketId({ marketId });

		const totalFunding = this.calcUnrealizedFundingsForAccount(inputs);

		const collateral_usd =
			(this.collateral() - totalFunding) * inputs.collateralPrice;

		const { totalPnL, totalMinMaintenanceMargin } =
			this.calcPnLAndMarginForAccount(inputs);

		const { pnl, minMaintenanceMargin } = this.calcPnLAndMarginForPosition({
			market: inputs.market,
			indexPrice: inputs.indexPrice,
			position,
		});

		const baseAssetAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const quoteAssetAmount = IFixedUtils.numberFromIFixed(
			position.quoteAssetNotionalAmount
		);
		const MMR = IFixedUtils.numberFromIFixed(
			inputs.market.marketParams.marginRatioMaintenance
		);
		const numerator =
			collateral_usd -
			(totalMinMaintenanceMargin - minMaintenanceMargin) +
			(totalPnL - pnl) -
			quoteAssetAmount;

		const price = (() => {
			if (baseAssetAmount > 0) {
				return numerator / (MMR * baseAssetAmount - baseAssetAmount);
			} else {
				return numerator / -(MMR * baseAssetAmount + baseAssetAmount);
			}
		})();
		return price < 0 ? 0 : price;
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

	public collateral(): number {
		return Casting.IFixed.numberFromIFixed(this.account.collateral);
	}

	public closePositionTxInputs = (inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
	}): SdkPerpetualsMarketOrderInputs => {
		const marketId = inputs.marketId;
		const position = this.positionForMarketId({ marketId });
		const side = Perpetuals.positionSide({ position });
		return {
			...inputs,
			side,
			size: position.baseAssetAmount,
		};
	};
}
