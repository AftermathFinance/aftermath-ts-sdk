import { Caller } from "../../general/utils/caller";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	MarketParams,
	MarketState,
	Orderbook,
	SuiNetwork,
	Timestamp,
	Url,
} from "../../types";

export class PerpetualsMarket extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public orderbook: Orderbook | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly marketId: bigint,
		public readonly marketParams: MarketParams,
		public marketState?: MarketState,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `perpetuals/markets/${marketId}`);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async refreshMarketState(): Promise<MarketState> {
		const marketState = await this.fetchApi<MarketState>("market-state");
		this.updateMarketState({ marketState });
		return marketState;
	}

	public updateMarketState(inputs: { marketState: MarketState }) {
		this.marketState = inputs.marketState;
	}

	public async refreshOrderbook(): Promise<Orderbook> {
		const orderbook = await this.fetchApi<Orderbook>("orderbook");
		this.updateOrderbook({ orderbook });
		return orderbook;
	}

	public updateOrderbook(inputs: { orderbook: Orderbook }) {
		this.orderbook = inputs.orderbook;
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public timeUntilNextFundingMs = (): Timestamp => {
		return this.nextFundingTimeMs() - Date.now();
	};

	public nextFundingTimeMs = (): Timestamp => {
		if (!this.marketState) throw new Error("No market state");

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
	estimatedFundingRate = (inputs: { indexPrice: number }): number => {
		if (!this.marketState) throw new Error("No market state");
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
}
