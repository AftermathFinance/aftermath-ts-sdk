import { Casting } from "../..";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	ApiIndexerEventsBody,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsOrderbookStateBody,
	ApiPerpetualsPositionOrderDatasBody,
	CoinType,
	FilledMakerOrderEvent,
	FilledTakerOrderEvent,
	ObjectId,
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
} from "../../types";
import { Perpetuals } from "./perpetuals";
import { PerpetualsOrderUtils } from "./utils";

export class PerpetualsMarket extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly marketId: PerpetualsMarketId,
		public readonly collateralCoinType: CoinType,
		public readonly marketParams: PerpetualsMarketParams,
		public readonly marketState: PerpetualsMarketState,
		public readonly orderbook: PerpetualsOrderbook,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `perpetuals/${collateralCoinType}/markets/${marketId}`);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public getOrderbookPrice() {
		return this.fetchApi<number>("orderbook-price");
	}

	public get24hrVolume() {
		return this.fetchApi<number>("24hr-volume");
	}

	public getPositionOrderDatas(inputs: ApiPerpetualsPositionOrderDatasBody) {
		return this.fetchApi<
			PerpetualsOrderData[],
			ApiPerpetualsPositionOrderDatasBody
		>("position-order-datas", inputs);
	}

	public getOrderbookState(inputs: {
		orderbookPrice: number;
		priceBucketSize: number;
		priceBuckets: number;
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
		position: PerpetualsPosition | undefined;
		totalMinInitialMargin: number;
		indexPrice: number;
		side: PerpetualsOrderSide;
		freeMarginUsd: number;
		price?: PerpetualsOrderPrice;
	}): Promise<number> => {
		const { side, price, indexPrice } = inputs;

		const optimisticSizeUsd = this.calcOptimisticMaxOrderSizeUsd(inputs);
		// (in lots)
		const size = BigInt(
			Math.ceil(optimisticSizeUsd / indexPrice / this.lotSize())
		);
		const executionPrice = await this.getExecutionPrice({
			size,
			side,
			price,
		});
		return this.calcPessimisticMaxOrderSizeUsd({
			...inputs,
			executionPrice,
		});
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public async getFilledOrderEvents(inputs: ApiIndexerEventsBody) {
		return this.fetchApiIndexerEvents<FilledMakerOrderEvent>(
			`events/filled-order`,
			inputs
		);
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
		const lotSize = this.orderbook.lotSize;
		const tickSize = this.orderbook.tickSize;
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
		const lotSize = this.orderbook.lotSize;
		const tickSize = this.orderbook.tickSize;
		return Perpetuals.orderPriceToPrice({
			orderPrice,
			lotSize,
			tickSize,
		});
	};

	public lotSize = () => {
		return Perpetuals.lotOrTickSizeToNumber(this.orderbook.lotSize);
	};

	public tickSize = () => {
		return Perpetuals.lotOrTickSizeToNumber(this.orderbook.tickSize);
	};

	public calcOptimisticMaxOrderSizeUsd = (inputs: {
		position: PerpetualsPosition | undefined;
		freeMarginUsd: number;
		indexPrice: number;
		side: PerpetualsOrderSide;
	}): number => {
		const { position, freeMarginUsd, indexPrice, side } = inputs;

		const imr = Casting.IFixed.numberFromIFixed(
			this.marketParams.marginRatioInitial
		);

		const currentSize = position?.baseAssetAmount ?? BigInt(0);
		const isReversing = position
			? side ^ Perpetuals.positionSide({ position })
			: false;

		let maxSize = freeMarginUsd / (indexPrice * imr);
		if (isReversing && position) {
			maxSize +=
				Perpetuals.positionSide({ position }) ===
				PerpetualsOrderSide.Bid
					? Math.max(
							Math.abs(
								Number(currentSize + position.bidsQuantity) -
									Math.abs(
										Number(
											currentSize - position.asksQuantity
										)
									)
							),
							0
					  )
					: Math.max(
							Math.abs(
								Number(currentSize - position.asksQuantity)
							) -
								Math.abs(
									Number(currentSize + position.bidsQuantity)
								),
							0
					  );
		}

		return maxSize * indexPrice;
	};

	public calcPessimisticMaxOrderSizeUsd = async (inputs: {
		position: PerpetualsPosition | undefined;
		freeMarginUsd: number;
		totalMinInitialMargin: number;
		indexPrice: number;
		side: PerpetualsOrderSide;
		executionPrice: number;
	}): Promise<number> => {
		const {
			indexPrice,
			side,
			position,
			executionPrice,
			freeMarginUsd,
			totalMinInitialMargin,
		} = inputs;

		const marginRatioInitial = Casting.IFixed.numberFromIFixed(
			this.marketParams.marginRatioInitial
		);
		const takerFee = Casting.IFixed.numberFromIFixed(
			this.marketParams.takerFee
		);

		const currentSize = position?.baseAssetAmount ?? BigInt(0);
		const isReversing = position
			? side ^ Perpetuals.positionSide({ position })
			: false;

		const slippage =
			(side === PerpetualsOrderSide.Bid
				? executionPrice - indexPrice
				: indexPrice - executionPrice) / indexPrice;

		let maxSize: number;
		if (isReversing) {
			// Size that can be placed to close the position
			maxSize = Math.abs(Number(currentSize));
			const { marginDelta, reqDelta } = this.simulateClosePosition({
				position,
				indexPrice,
				executionPrice,
			});
			const margin = freeMarginUsd + marginDelta;
			const imr = totalMinInitialMargin + reqDelta;
			// Size that adds margin requirement
			maxSize +=
				(margin - imr) /
				(indexPrice * marginRatioInitial +
					executionPrice * takerFee +
					slippage * indexPrice);
		} else {
			maxSize =
				(freeMarginUsd - totalMinInitialMargin) /
				(indexPrice * marginRatioInitial +
					executionPrice * takerFee +
					slippage * indexPrice);
		}

		return maxSize * indexPrice;
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public orderPrice(inputs: { orderData: PerpetualsOrderData }): number {
		const { orderData } = inputs;
		const orderPrice = PerpetualsOrderUtils.price(
			orderData.orderId,
			orderData.side
		);
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

	private getExecutionPrice(inputs: {
		side: PerpetualsOrderSide;
		size: bigint;
		price?: PerpetualsOrderPrice;
	}) {
		return this.fetchApi<number, ApiPerpetualsExecutionPriceBody>(
			"execution-price",
			{
				...inputs,
				lotSize: this.lotSize(),
				tickSize: this.tickSize(),
			}
		);
	}

	private simulateClosePosition(inputs: {
		position: PerpetualsPosition | undefined;
		indexPrice: number;
		executionPrice: number;
	}): {
		marginDelta: number;
		reqDelta: number;
	} {
		const { position, indexPrice, executionPrice } = inputs;
		if (!position) return { marginDelta: 0, reqDelta: 0 };

		const imr = Casting.IFixed.numberFromIFixed(
			this.marketParams.marginRatioInitial
		);
		const takerFee = Casting.IFixed.numberFromIFixed(
			this.marketParams.takerFee
		);

		const size = Number(position.baseAssetAmount);
		const netSizeBefore = Math.max(
			Math.abs(Number(size + Number(position.bidsQuantity))),
			Math.abs(Number(size - Number(position.asksQuantity)))
		);
		const netSizeAfter = Math.max(
			Number(position.bidsQuantity),
			Number(position.asksQuantity)
		);
		const entryPrice = Perpetuals.calcEntryPrice({ position });
		const uPnl = size * (indexPrice - entryPrice);
		const rPnl = size * (executionPrice - entryPrice);
		// pessimistically don't consider positive pnl since the order may not actually be
		// matched at the sell price
		const fees = Math.abs(size) * executionPrice * takerFee;
		const marginDelta = rPnl - uPnl - fees;
		const reqDelta = (netSizeAfter - netSizeBefore) * indexPrice * imr;
		return { marginDelta, reqDelta };
	}
}
