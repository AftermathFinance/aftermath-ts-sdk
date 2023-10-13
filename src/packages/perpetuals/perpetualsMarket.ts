import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	ApiIndexerEventsBody,
	ApiPerpetualsOrderbookStateBody,
	ApiPerpetualsPositionOrderDatasBody,
	CoinType,
	FilledMakerOrderEvent,
	FilledTakerOrderEvent,
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

	public getPositionOrderDatas(inputs: { position: PerpetualsPosition }) {
		const { position } = inputs;
		return this.fetchApi<
			PerpetualsOrderData[],
			ApiPerpetualsPositionOrderDatasBody
		>("position-order-datas", {
			positionAsksId: position.asks.objectId,
			positionBidsId: position.bids.objectId,
		});
	}

	public getOrderbookState(inputs: { indexPrice: number }) {
		const { indexPrice } = inputs;
		return this.fetchApi<
			PerpetualsOrderbookState,
			ApiPerpetualsOrderbookStateBody
		>("orderbook-state", {
			lotSize: this.lotSize(),
			tickSize: this.tickSize(),
			indexPrice,
		});
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async getFilledOrderEvents(inputs: ApiIndexerEventsBody) {
		return this.fetchApiIndexerEvents<
			FilledMakerOrderEvent | FilledTakerOrderEvent
		>(`events/filled-order`, inputs);
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
}
