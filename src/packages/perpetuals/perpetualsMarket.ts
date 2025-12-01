import { AftermathApi, Casting, Coin, Helpers, PerpetualsAccount } from "../..";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	ApiIndexerEventsBody,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	CoinType,
	FilledMakerOrdersEvent,
	FilledTakerOrderEvent,
	ObjectId,
	PerpetualsMarketCandleDataPoint,
	PerpetualsMarketId,
	PerpetualsMarketParams,
	PerpetualsMarketState,
	PerpetualsOrderData,
	PerpetualsOrderId,
	PerpetualsOrderPrice,
	PerpetualsOrderSide,
	PerpetualsOrderbook,
	PerpetualsPosition,
	SuiNetwork,
	Timestamp,
	Url,
	PerpetualsMarketData,
	Balance,
	PerpetualsFilledOrderData,
	ApiPerpetualsMaxOrderSizeBody,
	ApiPerpetualsMarkets24hrStatsResponse,
	ApiDataWithCursorBody,
	PerpetualsTradeHistoryWithCursor,
	CallerConfig,
	Percentage,
	ApiPerpetualsPreviewPlaceOrderResponse,
	PerpetualsMarket24hrStats,
	ApiPerpetualsPreviewPlaceLimitOrderBody,
	SdkPerpetualsPlaceLimitOrderPreviewInputs,
	ApiPerpetualsPreviewPlaceMarketOrderBody,
	SdkPerpetualsPlaceMarketOrderPreviewInputs,
	PerpetualsAccountId,
} from "../../types";
import { Perpetuals } from "./perpetuals";
import { PerpetualsOrderUtils } from "./utils";

export class PerpetualsMarket extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public readonly marketId: PerpetualsMarketId;
	public readonly indexPrice: number;
	public readonly collateralPrice: number;
	public readonly collateralCoinType: CoinType;
	public readonly marketParams: PerpetualsMarketParams;
	public readonly marketState: PerpetualsMarketState;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public marketData: PerpetualsMarketData,
		config?: CallerConfig
		// public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals");
		this.marketId = marketData.objectId;
		this.indexPrice = marketData.indexPrice;
		this.collateralPrice = marketData.collateralPrice;
		this.collateralCoinType = marketData.collateralCoinType;
		this.marketParams = marketData.marketParams;
		this.marketState = marketData.marketState;
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	// NOTE: should this be entirely removed since data already in orderbook function ?
	public getOrderbookMidPrice() {
		return this.fetchApi<
			{
				midPrice: number | undefined;
			},
			{
				marketId: PerpetualsMarketId;
			}
		>("market/orderbook-price", {
			marketId: this.marketId,
		});
	}

	public async get24hrStats(): Promise<PerpetualsMarket24hrStats> {
		const stats = await new Perpetuals(this.config).getMarkets24hrStats({
			marketIds: [this.marketId],
		});
		return stats[0];
	}

	public async getOrderbook() {
		// TODO: create own endpoint for just orderbook

		// return this.fetchApi<PerpetualsOrderbook>("market/orderbook");

		const marketDatas = await this.fetchApi<
			{
				market: PerpetualsMarketData;
				orderbook: PerpetualsOrderbook;
			}[],
			{
				marketIds: PerpetualsMarketId[];
				withOrderbook: boolean | undefined;
			}
		>("markets", {
			marketIds: [this.marketId],
			withOrderbook: true,
		});
		return marketDatas[0].orderbook;
	}

	// TODO: move/add to account ?
	public getMaxOrderSize = async (inputs: {
		accountId: PerpetualsAccountId;
		side: PerpetualsOrderSide;
		leverage?: number;
		price?: number;
	}) => {
		const { side, price, accountId, leverage } = inputs;
		return this.fetchApi<
			{
				maxOrderSize: bigint;
			},
			ApiPerpetualsMaxOrderSizeBody
		>("account/max-order-size", {
			side,
			price,
			leverage,
			accountId,
			marketId: this.marketId,
		});
	};

	public async getPlaceMarketOrderPreview(
		inputs: SdkPerpetualsPlaceMarketOrderPreviewInputs,
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
				collateralChange: number;
				executionPrice: number;
		  }
	> {
		return this.fetchApi<
			ApiPerpetualsPreviewPlaceOrderResponse,
			ApiPerpetualsPreviewPlaceMarketOrderBody
		>(
			"account/previews/place-market-order",
			{
				...inputs,
				accountId: undefined,
			},
			abortSignal
		);
	}

	public async getPlaceLimitOrderPreview(
		inputs: SdkPerpetualsPlaceLimitOrderPreviewInputs,
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
				collateralChange: number;
				executionPrice: number;
		  }
	> {
		return this.fetchApi<
			ApiPerpetualsPreviewPlaceOrderResponse,
			ApiPerpetualsPreviewPlaceLimitOrderBody
		>(
			"account/previews/place-limit-order",
			{
				...inputs,
				accountId: undefined,
			},
			abortSignal
		);
	}

	// =========================================================================
	//  Trade History
	// =========================================================================

	public async getTradeHistory(inputs: ApiDataWithCursorBody<Timestamp>) {
		return this.fetchApi<
			PerpetualsTradeHistoryWithCursor,
			ApiDataWithCursorBody<Timestamp> & {
				marketId: PerpetualsMarketId;
			}
		>("market/trade-history", {
			...inputs,
			marketId: this.marketId,
		});
	}

	// =========================================================================
	//  Prices
	// =========================================================================

	public async getPrices(): Promise<{
		basePrice: number;
		collateralPrice: number;
	}> {
		return (
			await new Perpetuals(
				this.config
				// this.Provider
			).getPrices({
				marketIds: [this.marketId],
			})
		)[0];
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public timeUntilNextFundingMs = (): Timestamp => {
		return this.nextFundingTimeMs() - Date.now();
	};

	public nextFundingTimeMs = (): Timestamp => {
		return this.marketData.nextFundingTimestampMs >
			BigInt(Number.MAX_SAFE_INTEGER)
			? Number.MAX_SAFE_INTEGER
			: Number(this.marketData.nextFundingTimestampMs);
	};

	// The funding rate as the difference between book and index TWAPs relative to the index price,
	// scaled by the funding period adjustment:
	// (bookTwap - indexTwap) / indexPrice * (fundingFrequency / fundingPeriod)
	public estimatedFundingRate = (): Percentage => {
		return this.marketData.estimatedFundingRate;
	};

	public calcCollateralUsedForOrder = (inputs: {
		leverage: number;
		orderData: PerpetualsOrderData;
		indexPrice: number;
		collateralPrice: number;
	}): {
		collateral: number;
		collateralUsd: number;
	} => {
		const { leverage, orderData, indexPrice, collateralPrice } = inputs;

		const imr = 1 / (leverage || 1);
		// const imr = this.initialMarginRatio();

		const collateralUsd =
			// NOTE: is this safe ?
			(Number(orderData.initialSize - orderData.filledSize) /
				Casting.Fixed.fixedOneN9) *
			indexPrice *
			imr;
		const collateral = collateralUsd / collateralPrice;

		return {
			collateralUsd,
			collateral,
		};
	};

	// =========================================================================
	//  Value Conversions
	// =========================================================================

	public lotSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.lotSize);
	}

	public tickSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.tickSize);
	}

	public maxLeverage() {
		return 1 / this.marketParams.marginRatioInitial;
	}

	public initialMarginRatio() {
		return this.marketParams.marginRatioInitial;
	}

	public maintenanceMarginRatio() {
		return this.marketParams.marginRatioMaintenance;
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	public roundToValidPrice = (inputs: {
		price: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const ticks = inputs.price / this.tickSize();
		return (
			(inputs.floor
				? Math.floor(ticks)
				: inputs.ceil
				? Math.ceil(ticks)
				: Math.round(ticks)) * this.tickSize()
		);
	};

	public roundToValidPriceBigInt = (inputs: {
		price: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const scaledPrice = Number(inputs.price * Casting.Fixed.fixedOneN9);
		// TODO: make sure this calc is safe
		return (
			(BigInt(
				inputs.floor
					? Math.floor(scaledPrice)
					: inputs.ceil
					? Math.ceil(scaledPrice)
					: Math.round(scaledPrice)
			) /
				this.marketParams.tickSize) *
			this.marketParams.tickSize
		);
	};

	public roundToValidSize = (inputs: {
		size: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const lots = inputs.size / this.lotSize();
		return (
			(inputs.floor
				? Math.floor(lots)
				: inputs.ceil
				? Math.ceil(lots)
				: Math.round(lots)) * this.lotSize()
		);
	};

	public roundToValidSizeBigInt = (inputs: {
		size: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const scaledSize = Number(inputs.size * Casting.Fixed.fixedOneN9);
		// TODO: make sure this calc is safe
		return (
			(BigInt(
				inputs.floor
					? Math.floor(scaledSize)
					: inputs.ceil
					? Math.ceil(scaledSize)
					: Math.round(scaledSize)
			) /
				this.marketParams.lotSize) *
			this.marketParams.lotSize
		);
	};

	public emptyPosition = (): PerpetualsPosition => {
		return {
			marketId: this.marketId,
			// collateralCoinType: this.marketData.collateralCoinType,
			collateral: 0,
			collateralUsd: 0,
			baseAssetAmount: 0,
			quoteAssetNotionalAmount: 0,
			cumFundingRateLong: this.marketData.marketState.cumFundingRateLong,
			cumFundingRateShort:
				this.marketData.marketState.cumFundingRateShort,
			asksQuantity: 0,
			bidsQuantity: 0,
			pendingOrders: [],
			makerFee: 1, // 100%
			takerFee: 1, // 100%
			leverage: 1,
			entryPrice: 0,
			freeCollateral: 0,
			freeMarginUsd: 0,
			liquidationPrice: 0,
			marginRatio: 1,
			unrealizedFundingsUsd: 0,
			unrealizedPnlUsd: 0,
		};
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	// private getExecutionPrice(inputs: {
	// 	side: PerpetualsOrderSide;
	// 	size: bigint;
	// 	collateral: Balance;
	// 	price?: PerpetualsOrderPrice;
	// }) {
	// 	return this.fetchApi<
	// 		ApiPerpetualsExecutionPriceResponse,
	// 		ApiPerpetualsExecutionPriceBody
	// 	>("execution-price", {
	// 		...inputs,
	// 		lotSize: this.lotSize(),
	// 		basePriceFeedId: this.marketParams.basePriceFeedId,
	// 		collateralPriceFeedId: this.marketParams.collateralPriceFeedId,
	// 	});
	// }

	// private simulateClosePosition(inputs: {
	// 	position: PerpetualsPosition;
	// 	indexPrice: number;
	// 	executionPrice: number;
	// 	size: number;
	// 	percentFilled: number;
	// }): {
	// 	marginDelta: number;
	// 	reqDelta: number;
	// 	sizeFilled: number;
	// 	sizePosted: number;
	// } {
	// 	const { position, indexPrice, executionPrice, size, percentFilled } =
	// 		inputs;

	// 	const imr = 1 / position.leverage;
	// 	// const imr = this.initialMarginRatio();
	// 	const takerFee = (
	// 		this.marketParams.takerFee
	// 	);

	// 	const positionSizeNum = (
	// 		position.baseAssetAmount
	// 	);
	// 	const positionBidsNum = (
	// 		position.bidsQuantity
	// 	);
	// 	const positionAsksNum = (
	// 		position.asksQuantity
	// 	);
	// 	const netSizeBefore = Math.max(
	// 		Math.abs(positionSizeNum + positionBidsNum),
	// 		Math.abs(positionSizeNum - positionAsksNum)
	// 	);

	// 	let sizeFilled = size * percentFilled;
	// 	let sizePosted = size * (1 - percentFilled);

	// 	let positionSizeFilledNum: number;
	// 	let positionSizePosted: number;
	// 	const positionSizeAbs = Math.abs(positionSizeNum);
	// 	if (sizeFilled >= positionSizeAbs) {
	// 		positionSizeFilledNum = positionSizeAbs;
	// 		positionSizePosted = 0;
	// 		sizeFilled = sizeFilled - positionSizeAbs;
	// 	} else {
	// 		positionSizeFilledNum = sizeFilled;
	// 		positionSizePosted = positionSizeAbs - sizeFilled;
	// 		sizeFilled = 0;
	// 		sizePosted = sizePosted - positionSizePosted;
	// 	}

	// 	const netSizeAfter = Math.max(
	// 		Math.abs(
	// 			positionSizeAbs -
	// 				positionSizeFilledNum +
	// 				positionBidsNum -
	// 				positionSizePosted
	// 		),
	// 		Math.abs(
	// 			positionSizeAbs -
	// 				positionSizeFilledNum +
	// 				positionAsksNum -
	// 				positionSizePosted
	// 		)
	// 	);
	// 	const entryPrice = Perpetuals.calcEntryPrice(position);
	// 	const uPnl = positionSizeFilledNum * (indexPrice - entryPrice);
	// 	const rPnl = positionSizeFilledNum * (executionPrice - entryPrice);
	// 	// pessimistically don't consider positive pnl since the order may not actually be
	// 	// matched at the sell price
	// 	const fees =
	// 		Math.abs(positionSizeFilledNum) * executionPrice * takerFee;
	// 	const marginDelta = rPnl - uPnl - fees;
	// 	const reqDelta = (netSizeAfter - netSizeBefore) * indexPrice * imr;

	// 	return { marginDelta, reqDelta, sizeFilled, sizePosted };
	// }
}
