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
	Percentage,
	ObjectVersion,
	ApiPerpetualsAccountOrderDatasBody,
	ApiDataWithCursorBody,
	Timestamp,
	PerpetualsAccountCollateralChangesWithCursor,
	PerpetualsAccountOrderEventsWithCursor,
	ApiPerpetualsSetPositionLeverageBody,
	PerpetualsAccountId,
	ApiPerpetualsAccountCollateralHistoryBody,
	ApiPerpetualsAccountOrderHistoryBody,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { Perpetuals } from "./perpetuals";
import { Coin } from "..";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Transaction } from "@mysten/sui/transactions";

export class PerpetualsAccount extends Caller {
	// =========================================================================
	//  Private Constants
	// =========================================================================

	private static readonly constants = {
		closePositionMarginOfError: 0.1, // 10%
	};

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
				accountObjectId: this.accountCap.objectId,
				accountObjectVersion: this.accountCap.objectVersion,
				accountObjectDigest: this.accountCap.objectDigest,
				hasPosition: this.positionForMarketId(inputs) !== undefined,
			}
		);
	}

	public async getPlaceLimitOrderTx(inputs: SdkPerpetualsLimitOrderInputs) {
		return this.fetchApiTransaction<ApiPerpetualsLimitOrderBody>(
			"transactions/limit-order",
			{
				...inputs,
				accountObjectId: this.accountCap.objectId,
				accountObjectVersion: this.accountCap.objectVersion,
				accountObjectDigest: this.accountCap.objectDigest,
				hasPosition: this.positionForMarketId(inputs) !== undefined,
			}
		);
	}

	public async getPlaceSLTPOrder(
		inputs: SdkPerpetualsSLTPOrderInputs
	): Promise<Transaction> {
		return this.fetchApiTransaction<ApiPerpetualsSLTPOrderBody>(
			"transactions/sltp-order",
			{
				...inputs,
				accountObjectId: this.accountCap.objectId,
				accountObjectVersion: this.accountCap.objectVersion,
				accountObjectDigest: this.accountCap.objectDigest,
			}
		);
	}

	public async getCancelOrderTx(inputs: {
		walletAddress: SuiAddress;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		basePriceFeedId: ObjectId;
		collateralPriceFeedId: ObjectId;
		side: PerpetualsOrderSide;
		orderId: PerpetualsOrderId;
		collateral: Balance;
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
			marketInitialSharedVersion: ObjectVersion;
			basePriceFeedId: ObjectId;
			collateralPriceFeedId: ObjectId;
			side: PerpetualsOrderSide;
			orderId: PerpetualsOrderId;
			collateral: Balance;
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
		size: bigint;
		walletAddress: SuiAddress;
		market: PerpetualsMarket;
		orderDatas: PerpetualsOrderData[];
		indexPrice: number;
		collateralPrice: number;
	}) {
		return this.getPlaceMarketOrderTx(this.closePositionTxInputs(inputs));
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async setPositionLeverage(
		inputs: ApiPerpetualsSetPositionLeverageBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiPerpetualsSetPositionLeverageBody>(
			`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/set-position-leverage`,
			inputs
		);
	}

	// public async getAllPositionLeverages(): Promise<
	// 	{
	// 		marketId: PerpetualsMarketId;
	// 		leverage: number;
	// 	}[]
	// > {
	// 	return this.fetchApi(
	// 		`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/position-leverages`
	// 	);
	// }

	public async getPositionLeverages(inputs: {
		marketIds: PerpetualsMarketId[];
	}): Promise<number[]> {
		return this.fetchApi(
			`${this.accountCap.collateralCoinType}/accounts/${
				this.accountCap.accountId
			}/position-leverages/${JSON.stringify(inputs.marketIds)}`
		);
	}

	public setPositionLeverageMessageToSign(inputs: {
		marketId: PerpetualsMarketId;
		leverage: number;
	}): {
		account_id: number;
		market_id: PerpetualsMarketId;
		leverage: number;
	} {
		return {
			account_id: Number(this.accountCap.accountId),
			market_id: inputs.marketId,
			leverage: inputs.leverage,
		};
	}

	public async getOrderPreview(
		inputs: Omit<
			ApiPerpetualsPreviewOrderBody,
			"accountId" | "collateralCoinType" | "accountCapId"
		>,
		abortSignal?: AbortSignal
	): Promise<
		| {
				error: string;
		  }
		| {
				positionAfterOrder: PerpetualsPosition;
				priceSlippage: number;
				percentSlippage: Percentage;
				filledSize: number;
				filledSizeUsd: number;
				postedSize: number;
				postedSizeUsd: number;
				collateralChange: Balance;
				executionPrice: number;
		  }
	> {
		const response = await this.fetchApi<
			ApiPerpetualsPreviewOrderResponse,
			ApiPerpetualsPreviewOrderBody
		>(
			"preview-order",
			{
				...inputs,
				accountId: this.accountCap.accountId,
				collateralCoinType: this.accountCap.collateralCoinType,
			},
			abortSignal
		);

		if ("error" in response) return response;

		const { collateralChange, ...remainingResponse } = response;
		return {
			...remainingResponse,
			collateralChange: Coin.normalizeBalance(
				collateralChange,
				this.collateralDecimals()
			),
		};
	}

	public async getOrderDatas(): Promise<PerpetualsOrderData[]> {
		const orderDatas = this.account.positions.reduce(
			(acc, position) => [
				...acc,
				...position.pendingOrders.map((order) => ({
					orderId: order.orderId,
					currentSize: order.size,
				})),
			],
			[] as {
				orderId: PerpetualsOrderId;
				currentSize: bigint;
			}[]
		);
		if (orderDatas.length <= 0) return [];

		return this.fetchApi<
			PerpetualsOrderData[],
			ApiPerpetualsAccountOrderDatasBody
		>(
			`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/order-datas`,
			{
				orderDatas,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getCollateralHistory(
		inputs: ApiDataWithCursorBody<Timestamp>
	) {
		return this.fetchApi<
			PerpetualsAccountCollateralChangesWithCursor,
			ApiPerpetualsAccountCollateralHistoryBody
		>(
			`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/collateral-history`,
			{
				...inputs,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	public async getOrderHistory(inputs: ApiDataWithCursorBody<Timestamp>) {
		return this.fetchApi<
			PerpetualsAccountOrderEventsWithCursor,
			ApiPerpetualsAccountOrderHistoryBody
		>(
			`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/order-history`,
			{
				...inputs,
				accountCapId: this.accountCap.objectId,
			}
		);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public calcFreeCollateralForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			this.emptyPosition({ marketId });

		const funding = this.calcUnrealizedFundingsForPosition(inputs);
		const { pnl, minInitialMargin } =
			this.calcPnLAndMarginForPosition(inputs);

		let collateralUsd =
			IFixedUtils.numberFromIFixed(position.collateral) *
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
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			this.emptyPosition({ marketId });

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

	public calcUnrealizedFundings = (inputs: {
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
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			this.emptyPosition({ marketId });

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
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			this.emptyPosition({ marketId });

		const marginRatioInitial = 1 / position.leverage;
		// const marginRatioInitial = inputs.market.initialMarginRatio();
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
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			this.emptyPosition({ marketId });

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

	public calcFreeMarginUsdForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			this.emptyPosition({ marketId });

		const totalFunding = this.calcUnrealizedFundingsForPosition(inputs);

		const { pnl, minInitialMargin } =
			this.calcPnLAndMarginForPosition(inputs);

		let collateralUsd =
			IFixedUtils.numberFromIFixed(position.collateral) *
			inputs.collateralPrice;

		const margin = collateralUsd + totalFunding + pnl;

		if (margin >= minInitialMargin) {
			return margin - minInitialMargin;
		} else return 0;
	};

	public calcAccountState = (inputs: {
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): {
		accountEquity: number;
		totalPnL: number;
		totalFunding: number;
		totalCollateralAllocated: number;
	} => {
		const zipped = Helpers.zip(inputs.markets, inputs.indexPrices);
		let accountEquity = 0;
		let totalPnL = 0;
		let totalFunding = 0;
		let totalCollateralAllocated = 0;

		zipped.forEach(([market, indexPrice]) => {
			const marketId = market.marketId;
			const position =
				this.positionForMarketId({ marketId }) ??
				this.emptyPosition({ marketId });

			const funding = this.calcUnrealizedFundingsForPosition({
				market,
				position,
			});

			const { pnl } = this.calcPnLAndMarginForPosition({
				market,
				indexPrice,
				position,
			});

			let collateralUsd =
				IFixedUtils.numberFromIFixed(position.collateral) *
				inputs.collateralPrice;

			totalPnL += pnl;
			totalFunding += funding;
			totalCollateralAllocated += collateralUsd;
			accountEquity += collateralUsd + funding + pnl;
		});
		return {
			accountEquity,
			totalPnL,
			totalFunding,
			totalCollateralAllocated,
		};
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

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

	public collateralDecimals(): CoinDecimal {
		return this.accountCap.collateralDecimals;
	}

	public collateralBalance(): Balance {
		return Coin.normalizeBalance(
			this.collateral(),
			this.collateralDecimals()
		);
	}

	public closePositionTxInputs = (inputs: {
		size: bigint;
		walletAddress: SuiAddress;
		market: PerpetualsMarket;
		orderDatas: PerpetualsOrderData[];
		indexPrice: number;
		collateralPrice: number;
	}): SdkPerpetualsMarketOrderInputs => {
		const { size, market, walletAddress, orderDatas, collateralPrice } =
			inputs;

		const marketId = market.marketId;
		const position =
			this.positionForMarketId({ marketId }) ??
			this.emptyPosition({ marketId });

		// TODO: move conversion to helper function, since used often
		const ordersCollateral = Coin.normalizeBalance(
			Helpers.sum(
				orderDatas
					.filter(
						(orderData) => orderData.marketId === market.marketId
					)
					.map(
						(orderData) =>
							market.calcCollateralUsedForOrder({
								...inputs,
								orderData,
								leverage: position.leverage,
							}).collateral
					)
			),
			this.collateralDecimals()
		);

		const fullPositionCollateralChange =
			Helpers.maxBigInt(
				BigInt(
					Math.floor(
						Number(
							Coin.normalizeBalance(
								this.calcFreeMarginUsdForPosition(inputs) *
									collateralPrice,
								this.collateralDecimals()
							) - ordersCollateral
						) *
							(1 -
								PerpetualsAccount.constants
									.closePositionMarginOfError)
					)
				),
				BigInt(0)
			) * BigInt(-1);
		const positionSize = BigInt(
			Math.round(
				Math.abs(
					Casting.IFixed.numberFromIFixed(position.baseAssetAmount) /
						market.lotSize()
				)
			)
		);
		const collateralChange = BigInt(
			Math.round(
				Number(fullPositionCollateralChange) *
					(Number(size) / Number(positionSize))
			)
		);

		const positionSide = Perpetuals.positionSide(position);
		return {
			size,
			marketId,
			walletAddress,
			collateralChange,
			side:
				positionSide === PerpetualsOrderSide.Bid
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			hasPosition: this.positionForMarketId({ marketId }) !== undefined,
		};
	};

	public emptyPosition = (inputs: {
		marketId: PerpetualsMarketId;
	}): PerpetualsPosition => {
		const { marketId } = inputs;
		return {
			marketId,
			collateralCoinType: this.accountCap.collateralCoinType,
			collateral: BigInt(0),
			baseAssetAmount: BigInt(0),
			quoteAssetNotionalAmount: BigInt(0),
			cumFundingRateLong: BigInt(0),
			cumFundingRateShort: BigInt(0),
			asksQuantity: BigInt(0),
			bidsQuantity: BigInt(0),
			pendingOrders: [],
			makerFee: BigInt(1000000000000000000), // 100%
			takerFee: BigInt(1000000000000000000), // 100%
			leverage: 1,
		};
	};
}
