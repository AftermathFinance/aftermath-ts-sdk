import { Timestamp } from "../../../types";
import { numberFromIFixed } from "../../utilities/ifixed";
import { MarketParams, MarketState } from "../perpetualsTypes";

export const timeUntilNextFundingMs = (mktState: MarketState, mktParams: MarketParams): Timestamp => {
    return nextFundingTimeMs(mktState, mktParams) - Date.now()
}

export const nextFundingTimeMs = (mktState: MarketState, mktParams: MarketParams): Timestamp => {
    const fundingFrequencyMs = Number(mktParams.fundingFrequencyMs);
    const lastFundingIntervalNumber = Math.floor(mktState.fundingLastUpdMs / fundingFrequencyMs)
    return (lastFundingIntervalNumber + 1) * fundingFrequencyMs
}

// The funding rate as the difference between book and index TWAPs relative to the index price,
// scaled by the funding period adjustment:
// (bookTwap - indexTwap) / indexPrice * (fundingFrequency / fundingPeriod)
//
// To get the rate as a percentage, multiply the output by 100.
export const estimatedFundingRate = (inputs: {
    mktState: MarketState;
    mktParams: MarketParams;
    indexPrice: number;
}): number => {
    const { mktState, mktParams, indexPrice } = inputs;
    const premiumTwap = numberFromIFixed(mktState.premiumTwap);
    const relativePremium = premiumTwap / indexPrice;
    const periodAdjustment = Number(mktParams.fundingFrequencyMs) / Number(mktParams.fundingPeriodMs);
    return relativePremium * periodAdjustment;
}
