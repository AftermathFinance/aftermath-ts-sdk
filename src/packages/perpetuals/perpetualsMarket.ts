import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	CoinType,
	PerpetualsMarketId,
	PerpetualsMarketParams,
	PerpetualsMarketState,
	PerpetualsOrderPrice,
	PerpetualsOrderbook,
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
		super(network, `perpetuals/markets/${marketId}/${collateralCoinType}`);
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

		const priceFixed = FixedUtils.directUncast(price);
		// convert f18 to b9 (assuming the former is positive)
		const price9 = priceFixed / FixedUtils.fixedOneB9;

		const denominator = FixedUtils.fixedOneB9 / this.orderbook.lotSize;
		if (denominator <= BigInt(0)) return BigInt(0);

		return price9 / this.orderbook.tickSize / denominator;
	};

	public lotSize = () => {
		return PerpetualsMarket.lotOrTickSizeToNumber(this.orderbook.lotSize);
	};

	public tickSize = () => {
		return PerpetualsMarket.lotOrTickSizeToNumber(this.orderbook.tickSize);
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private static lotOrTickSizeToNumber(lotOrTickSize: bigint): number {
		return Number(lotOrTickSize) / FixedUtils.fixedOneN9;
	}
}
