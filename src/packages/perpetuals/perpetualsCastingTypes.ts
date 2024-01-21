import { EventOnChain } from "../../general/types/castingTypes";
import {
	BigIntAsString,
	IFixedAsString,
	ObjectId,
	SuiAddress,
} from "../../types";

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
}>;

export type AllocatedCollateralEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	collateral: BigIntAsString;
	position_collateral_after: IFixedAsString;
}>;

export type DeallocatedCollateralEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	collateral: BigIntAsString;
	position_collateral_after: IFixedAsString;
}>;

export type SettledFundingEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	collateral_change_usd: IFixedAsString;
	mkt_funding_rate_long: IFixedAsString;
	mkt_funding_rate_short: IFixedAsString;
}>;

// =========================================================================
//  Liquidation
// =========================================================================

export type LiquidatedEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	liqee_account_id: BigIntAsString;
	liqor_account_id: BigIntAsString;
	is_liqee_long: boolean;
	size_liquidated: BigIntAsString;
	mark_price: IFixedAsString;
	liqee_collateral_change_usd: IFixedAsString;
	liqee_base_amount: IFixedAsString;
	liqee_quote_amount: IFixedAsString;
	bad_debt: IFixedAsString;
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
	ch_id: ObjectId;
	account_id: BigIntAsString;
	size: BigIntAsString;
	order_id: BigIntAsString;
}>;

export type PostedOrderEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	posted_base_ask: BigIntAsString;
	posted_base_bid: BigIntAsString;
	pending_asks: IFixedAsString;
	pending_bids: IFixedAsString;
}>;

export type FilledMakerOrderEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	maker_account_id: BigIntAsString;
	maker_collateral: IFixedAsString;
	collateral_change_usd: IFixedAsString;
	order_id: BigIntAsString;
	maker_size: BigIntAsString;
	dropped: boolean;
	maker_base_amount: IFixedAsString;
	maker_quote_amount: IFixedAsString;
	maker_pending_asks_quantity: IFixedAsString;
	maker_pending_bids_quantity: IFixedAsString;
}>;

export type FilledTakerOrderEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	taker_account_id: BigIntAsString;
	taker_collateral: IFixedAsString;
	collateral_change_usd: IFixedAsString;
	base_asset_delta_ask: IFixedAsString;
	quote_asset_delta_ask: IFixedAsString;
	base_asset_delta_bid: IFixedAsString;
	quote_asset_delta_bid: IFixedAsString;
	taker_base_amount: IFixedAsString;
	taker_quote_amount: IFixedAsString;
}>;

export type PostedOrderReceiptEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	order_id: BigIntAsString;
	order_size: BigIntAsString;
}>;

// =========================================================================
//  Twap
// =========================================================================

export type UpdatedPremiumTwapEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	index_price: IFixedAsString;
	book_price: IFixedAsString;
	premium_twap: IFixedAsString;
	premium_twap_last_upd_ms: BigIntAsString;
}>;

export type UpdatedSpreadTwapEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	book_price: IFixedAsString;
	index_price: IFixedAsString;
	spread_twap: IFixedAsString;
	spread_twap_last_upd_ms: BigIntAsString;
}>;
