import { EventOnChain } from "../../general/types/castingTypes";
import { BigIntAsString, SuiAddress } from "../../types";

// =========================================================================
//  Constants
// =========================================================================

export const AskOnChain = true;
export const BidOnChain = false;

// =========================================================================
//  Events
// =========================================================================

// =========================================================================
//  Collateral
// =========================================================================

export type WithdrewCollateralEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	collateral: BigIntAsString;
}>;

export type DepositedCollateralEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	collateral: BigIntAsString;
	vault: SuiAddress;
}>;

export type SettledFundingEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	collateral: BigIntAsString;
	market_ids: BigIntAsString[];
	pos_funding_rates_long: BigIntAsString[];
	pos_funding_rates_short: BigIntAsString[];
}>;

// =========================================================================
//  Liquidation
// =========================================================================

export type LiquidatedEventOnChain = EventOnChain<{
	liqee_account_id: BigIntAsString;
	liqee_collateral: BigIntAsString;
	liqor_account_id: BigIntAsString;
	liqor_collateral: BigIntAsString;
}>;

export type AcquiredLiqeeEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	market_id: BigIntAsString;
	base_asset_amount: BigIntAsString;
	quote_asset_notional_amount: BigIntAsString;
	size_to_acquire: BigIntAsString;
	mark_price: BigIntAsString;
}>;

// =========================================================================
//  Account
// =========================================================================

export type CreatedAccountEventOnChain = EventOnChain<{
	user: SuiAddress;
	account_id: BigIntAsString;
}>;

// =========================================================================
//  Order
// =========================================================================

export type CanceledOrderEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	market_id: BigIntAsString;
	side: boolean;
	size: BigIntAsString;
	order_id: BigIntAsString;
	asks_quantity: BigIntAsString;
	bids_quantity: BigIntAsString;
}>;

export type PostedOrderEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	market_id: BigIntAsString;
	order_id: BigIntAsString;
	side: boolean;
	size: BigIntAsString;
	asks_quantity: BigIntAsString;
	bids_quantity: BigIntAsString;
}>;

export type FilledMakerOrderEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	collateral: BigIntAsString;
	market_id: BigIntAsString;
	order_id: BigIntAsString;
	side: boolean;
	size: BigIntAsString;
	dropped: boolean;
	base_asset_amount: BigIntAsString;
	quote_asset_notional_amount: BigIntAsString;
	asks_quantity: BigIntAsString;
	bids_quantity: BigIntAsString;
}>;

export type FilledTakerOrderEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	collateral: BigIntAsString;
	market_id: BigIntAsString;
	base_asset_amount: BigIntAsString;
	quote_asset_notional_amount: BigIntAsString;
	side: boolean;
	base_asset_delta: BigIntAsString;
	quote_asset_delta: BigIntAsString;
}>;
