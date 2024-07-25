import { Casting, Coin, Helpers, PerpetualsAccount } from "../..";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	ApiIndexerEventsBody,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	ApiPerpetualsOrderbookStateBody,
	CoinType,
	FilledMakerOrderEvent,
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
	PerpetualsOrderbookState,
	PerpetualsPosition,
	SuiNetwork,
	Timestamp,
	Url,
	PerpetualsMarketData,
	Balance,
	PerpetualsFilledOrderData,
	ApiPerpetualsMaxOrderSizeBody,
	ApiPerpetualsMarket24hrVolumeResponse,
	ApiDataWithCursorBody,
	PerpetualsTradeHistoryWithCursor,
} from "../../types";
import { Perpetuals } from "./perpetuals";
import { PerpetualsOrderUtils } from "./utils";

export class PerpetualsMarket extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public readonly marketId: PerpetualsMarketId;
	public readonly collateralCoinType: CoinType;
	public readonly marketParams: PerpetualsMarketParams;
	public readonly marketState: PerpetualsMarketState;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public marketData: PerpetualsMarketData,
		public readonly network?: SuiNetwork
	) {
		super(
			network,
			`perpetuals/${marketData.collateralCoinType}/markets/${marketData.objectId}`
		);
		this.marketId = marketData.objectId;
		this.collateralCoinType = marketData.collateralCoinType;
		this.marketParams = marketData.marketParams;
		this.marketState = marketData.marketState;
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public getOrderbookPrice() {
		return this.fetchApi<number>("orderbook-price");
	}

	public get24hrVolume(): Promise<ApiPerpetualsMarket24hrVolumeResponse> {
		return this.fetchApi<ApiPerpetualsMarket24hrVolumeResponse>(
			"24hr-volume"
		);
	}

	public getPrice24hrsAgo() {
		return this.fetchApi<number>("price-24hrs-ago");
	}

	public getOrderbookState(inputs: {
		orderbookPrice: number;
		priceBucketSize: number;
	}) {
		return this.fetchApi<
			PerpetualsOrderbookState,
			ApiPerpetualsOrderbookStateBody
		>("orderbook-state", {
			...inputs,
			lotSize: this.lotSize(),
			tickSize: this.tickSize(),
		});
	}

	public getMaxOrderSizeUsd = async (inputs: {
		account: PerpetualsAccount;
		indexPrice: number;
		side: PerpetualsOrderSide;
		leverage: number;
		price?: PerpetualsOrderPrice;
	}): Promise<number> => {
		const { side, price, account, indexPrice, leverage } = inputs;
		const maxSize: bigint = await this.fetchApi<
			bigint,
			ApiPerpetualsMaxOrderSizeBody
		>("max-order-size", {
			accountId: account.accountCap.accountId,
			collateral: account.collateralBalance(),
			side,
			price,
			leverage,
		});
		return Number(maxSize) * this.lotSize() * indexPrice;
	};

	// =========================================================================
	//  Trade History
	// =========================================================================

	public async getTradeHistory(inputs: ApiDataWithCursorBody<Timestamp>) {
		return this.fetchApi<
			PerpetualsTradeHistoryWithCursor,
			ApiDataWithCursorBody<Timestamp>
		>(`trade-history`, inputs);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public timeUntilNextFundingMs = (): Timestamp => {
		return this.nextFundingTimeMs() - Date.now();
	};

	public nextFundingTimeMs = (): Timestamp => {
		const fundingFrequencyMs = Number(this.marketParams.fundingFrequencyMs);
		const lastFundingIntervalNumber = Math.floor(
			this.marketState.fundingLastUpdMs / fundingFrequencyMs
		);
		return (lastFundingIntervalNumber + 1) * fundingFrequencyMs;
	};

	// The funding rate as the difference between book and index TWAPs relative to the index price,
	// scaled by the funding period adjustment:
	// (bookTwap - indexTwap) / indexPrice * (fundingFrequency / fundingPeriod)
	//
	// To get the rate as a percentage, multiply the output by 100.
	public estimatedFundingRate = (inputs: { indexPrice: number }): number => {
		const { indexPrice } = inputs;

		const premiumTwap = IFixedUtils.numberFromIFixed(
			this.marketState.premiumTwap
		);
		const relativePremium = premiumTwap / indexPrice;
		const periodAdjustment =
			Number(this.marketParams.fundingFrequencyMs) /
			Number(this.marketParams.fundingPeriodMs);
		return relativePremium * periodAdjustment;
	};

	public priceToOrderPrice = (inputs: {
		price: number;
	}): PerpetualsOrderPrice => {
		const { price } = inputs;
		const lotSize = this.marketParams.lotSize;
		const tickSize = this.marketParams.tickSize;
		return Perpetuals.priceToOrderPrice({
			price,
			lotSize,
			tickSize,
		});
	};

	public orderPriceToPrice = (inputs: {
		orderPrice: PerpetualsOrderPrice;
	}): number => {
		const { orderPrice } = inputs;
		const lotSize = this.marketParams.lotSize;
		const tickSize = this.marketParams.tickSize;
		return Perpetuals.orderPriceToPrice({
			orderPrice,
			lotSize,
			tickSize,
		});
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

		const imr = 1 / leverage;
		// const imr = this.initialMarginRatio();

		const collateralUsd =
			Number(orderData.initialSize - orderData.filledSize) *
			this.lotSize() *
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
		return (
			1 /
			Casting.IFixed.numberFromIFixed(
				this.marketParams.marginRatioInitial
			)
		);
	}

	public initialMarginRatio() {
		return Casting.IFixed.numberFromIFixed(
			this.marketParams.marginRatioInitial
		);
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	public orderPrice(inputs: { orderId: PerpetualsOrderId }): number {
		const { orderId } = inputs;
		const orderPrice = PerpetualsOrderUtils.price(orderId);
		return this.orderPriceToPrice({ orderPrice });
	}

	public roundToValidPrice = (inputs: { price: number }) => {
		return Math.round(inputs.price / this.tickSize()) * this.tickSize();
	};

	public roundToValidSize = (inputs: { size: number; floor?: boolean }) => {
		const lots = inputs.size / this.lotSize();
		return (
			(inputs.floor ? Math.floor(lots) : Math.round(lots)) *
			this.lotSize()
		);
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

	private simulateClosePosition(inputs: {
		position: PerpetualsPosition;
		indexPrice: number;
		executionPrice: number;
		size: number;
		percentFilled: number;
	}): {
		marginDelta: number;
		reqDelta: number;
		sizeFilled: number;
		sizePosted: number;
	} {
		const { position, indexPrice, executionPrice, size, percentFilled } =
			inputs;

		const imr = 1 / position.leverage;
		// const imr = this.initialMarginRatio();
		const takerFee = Casting.IFixed.numberFromIFixed(
			this.marketParams.takerFee
		);

		const positionSizeNum = Casting.IFixed.numberFromIFixed(
			position.baseAssetAmount
		);
		const positionBidsNum = Casting.IFixed.numberFromIFixed(
			position.bidsQuantity
		);
		const positionAsksNum = Casting.IFixed.numberFromIFixed(
			position.asksQuantity
		);
		const netSizeBefore = Math.max(
			Math.abs(positionSizeNum + positionBidsNum),
			Math.abs(positionSizeNum - positionAsksNum)
		);

		let sizeFilled = size * percentFilled;
		let sizePosted = size * (1 - percentFilled);

		let positionSizeFilledNum: number;
		let positionSizePosted: number;
		const positionSizeAbs = Math.abs(positionSizeNum);
		if (sizeFilled >= positionSizeAbs) {
			positionSizeFilledNum = positionSizeAbs;
			positionSizePosted = 0;
			sizeFilled = sizeFilled - positionSizeAbs;
		} else {
			positionSizeFilledNum = sizeFilled;
			positionSizePosted = positionSizeAbs - sizeFilled;
			sizeFilled = 0;
			sizePosted = sizePosted - positionSizePosted;
		}

		const netSizeAfter = Math.max(
			Math.abs(
				positionSizeAbs -
					positionSizeFilledNum +
					positionBidsNum -
					positionSizePosted
			),
			Math.abs(
				positionSizeAbs -
					positionSizeFilledNum +
					positionAsksNum -
					positionSizePosted
			)
		);
		const entryPrice = Perpetuals.calcEntryPrice(position);
		const uPnl = positionSizeFilledNum * (indexPrice - entryPrice);
		const rPnl = positionSizeFilledNum * (executionPrice - entryPrice);
		// pessimistically don't consider positive pnl since the order may not actually be
		// matched at the sell price
		const fees =
			Math.abs(positionSizeFilledNum) * executionPrice * takerFee;
		const marginDelta = rPnl - uPnl - fees;
		const reqDelta = (netSizeAfter - netSizeBefore) * indexPrice * imr;

		return { marginDelta, reqDelta, sizeFilled, sizePosted };
	}
}
