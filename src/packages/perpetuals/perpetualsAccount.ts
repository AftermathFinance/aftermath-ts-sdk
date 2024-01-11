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
	ApiIndexerEventsBody,
	DepositedCollateralEvent,
	PostedOrderEvent,
	CanceledOrderEvent,
	WithdrewCollateralEvent,
	CollateralEvent,
	PerpetualsOrderEvent,
	ApiPerpetualsTransferCollateralBody,
	ObjectId,
	ApiPerpetualsCancelOrdersBody,
	PerpetualsOrderData,
	CoinDecimal,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { Perpetuals } from "./perpetuals";
import { Coin } from "..";
import { FixedUtils } from "../../general/utils/fixedUtils";

export class PerpetualsAccount extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly account: PerpetualsAccountObject,
		public readonly accountCap: PerpetualsAccountCap,
		public readonly network?: SuiNetwork
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
		isSponsoredTx?: boolean;
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

	public async getTransferCollateralTx(inputs: {
		walletAddress: SuiAddress;
		amount: Balance;
		toAccountCapId: ObjectId;
	}) {
		return this.fetchApiTransaction<ApiPerpetualsTransferCollateralBody>(
			"transactions/transfer-collateral",
			{
				...inputs,
				collateralCoinType: this.accountCap.collateralCoinType,
				fromAccountCapId: this.accountCap.objectId,
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

	public async getCancelOrdersTx(inputs: {
		walletAddress: SuiAddress;
		orderDatas: {
			marketId: PerpetualsMarketId;
			side: PerpetualsOrderSide;
			orderId: PerpetualsOrderId;
		}[];
	}) {
		return this.fetchApiTransaction<ApiPerpetualsCancelOrdersBody>(
			"transactions/cancel-orders",
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
		lotSize: number;
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
		>,
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<
			ApiPerpetualsPreviewOrderResponse,
			ApiPerpetualsPreviewOrderBody
		>(
			"preview-order",
			{
				...inputs,
				accountId: this.accountCap.accountId,
				collateralCoinType: this.accountCap.collateralCoinType,
				accountCapId: this.accountCap.objectId,
			},
			abortSignal
		);
	}

	public getOrderDatas() {
		return this.fetchApi<PerpetualsOrderData[]>(
			`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/order-datas`
		);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async getCollateralEvents(inputs: ApiIndexerEventsBody) {
		return this.fetchApiIndexerEvents<CollateralEvent>(
			`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/events/collateral`,
			inputs
		);
	}

	public async getOrderEvents(inputs: ApiIndexerEventsBody) {
		return this.fetchApiIndexerEvents<PerpetualsOrderEvent>(
			`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/events/order`,
			inputs
		);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public calcFreeCollateral = (inputs: {
		position: PerpetualsPosition;
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
	}): number => {
		const funding = this.calcUnrealizedFundingsForPosition(inputs);
		const { pnl, minInitialMargin } =
			this.calcPnLAndMarginForPosition(inputs);
		let collateralUsd =
			IFixedUtils.numberFromIFixed(inputs.position.collateral) *
			inputs.collateralPrice;
		collateralUsd += funding;
		let cappedMargin;
		if (pnl < 0) {
			cappedMargin = collateralUsd + pnl;
		} else {
			cappedMargin = collateralUsd;
		}
		if (cappedMargin >= minInitialMargin) {
			return (cappedMargin - minInitialMargin) / inputs.collateralPrice;
		} else return 0;
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
		const { market, indexPrice, collateralPrice } = inputs;
		const marketId = market.marketId;
		const position =
			inputs.position ?? this.positionForMarketId({ marketId });

		if (!position) throw new Error("no position found for market");

		const funding = this.calcUnrealizedFundingsForPosition({
			market,
			position,
		});
		const collateralUsd =
			IFixedUtils.numberFromIFixed(position?.collateral) *
				collateralPrice +
			funding;

		const { pnl, netAbsBaseValue } = this.calcPnLAndMarginForPosition({
			market,
			indexPrice,
			position,
		});

		const marginRatio =
			netAbsBaseValue === 0 ? 0 : (collateralUsd + pnl) / netAbsBaseValue;
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
		if (!position) throw new Error("no position found for market");

		const baseAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const isLong = Math.sign(baseAmount);

		if (isLong < 0) {
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
		if (!position) throw new Error("no position found for market");

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
		collateralPrice: number;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ?? this.positionForMarketId({ marketId });
		if (!position) throw new Error("no position found for market");

		const funding = this.calcUnrealizedFundingsForPosition(inputs);

		const collateralUsd =
			IFixedUtils.numberFromIFixed(position?.collateral) *
				inputs.collateralPrice +
			funding;

		const baseAssetAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const quoteAssetAmount = IFixedUtils.numberFromIFixed(
			position.quoteAssetNotionalAmount
		);
		const MMR = IFixedUtils.numberFromIFixed(
			inputs.market.marketParams.marginRatioMaintenance
		);
		const numerator = collateralUsd - quoteAssetAmount;

		const price = (() => {
			if (baseAssetAmount > 0) {
				return numerator / ((1 - MMR) * -baseAssetAmount);
			} else {
				return numerator / ((1 + MMR) * -baseAssetAmount);
			}
		})();
		return price < 0 ? 0 : price;
	};

	public calcFreeMarginUsd = (inputs: {
		position: PerpetualsPosition;
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
	}): number => {
		const totalFunding = this.calcUnrealizedFundingsForPosition(inputs);

		const { pnl, minInitialMargin } =
			this.calcPnLAndMarginForPosition(inputs);

		let collateralUsd =
			IFixedUtils.numberFromIFixed(inputs.position.collateral) *
			inputs.collateralPrice;

		const margin = collateralUsd + totalFunding + pnl;

		if (margin >= minInitialMargin) {
			return margin - minInitialMargin;
		} else return 0;
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
	}): PerpetualsPosition | undefined {
		try {
			return this.account.positions.find(
				(pos) => pos.marketId === inputs.marketId
			)!;
		} catch (e) {
			return undefined;
		}
	}

	public collateral(): number {
		return Casting.IFixed.numberFromIFixed(this.accountCap.collateral);
	}

	public closePositionTxInputs = (inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
		lotSize: number;
	}): SdkPerpetualsMarketOrderInputs => {
		const marketId = inputs.marketId;
		const position = this.positionForMarketId({ marketId });
		if (!position) throw new Error("no position found for market");

		const side = Perpetuals.positionSide(position);
		return {
			...inputs,
			side:
				side === PerpetualsOrderSide.Bid
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			size: BigInt(
				Math.round(
					Casting.IFixed.numberFromIFixed(
						Casting.IFixed.abs(position.baseAssetAmount)
					) / inputs.lotSize
				)
			),
		};
	};
}
