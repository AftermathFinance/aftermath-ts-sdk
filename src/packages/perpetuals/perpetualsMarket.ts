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

	// WARN: this may not work if the direction we're going is opposite of the
	// current position
	public getMaxOrderSizeUsd = async (inputs: {
		freeMarginUsd: number;
		indexPrice: number;
		side: PerpetualsOrderSide;
	}): Promise<number> => {
		const { freeMarginUsd, indexPrice, side } = inputs;

		const imr = Casting.IFixed.numberFromIFixed(
			this.marketParams.marginRatioInitial
		);
		const takerFee = Casting.IFixed.numberFromIFixed(
			this.marketParams.takerFee
		);

		// Compute the max size optimistically
		const optimisticSizeUsd = freeMarginUsd / (imr + takerFee);
		const baseSize = optimisticSizeUsd / indexPrice;
		const size = BigInt(Math.floor(baseSize / this.lotSize()));

		// Compute the execution size for an order of USD size computed above,
		// assuming it gets fully matched
		const executionPrice = await this.getExecutionPrice({
			size,
			side,
		});

		const slippage =
			(side === PerpetualsOrderSide.Bid
				? indexPrice - executionPrice
				: executionPrice - indexPrice) / indexPrice;
		const max_size =
			freeMarginUsd /
			(indexPrice * imr +
				executionPrice * takerFee +
				slippage * indexPrice);
		return Math.abs(max_size * indexPrice);
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
}
