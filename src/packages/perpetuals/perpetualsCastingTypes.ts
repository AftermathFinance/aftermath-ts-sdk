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
	position_collateral: IFixedAsString;
	account_collateral: IFixedAsString;
	vault_balance: BigIntAsString;
}>;

export type DeallocatedCollateralEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	position_collateral: IFixedAsString;
	account_collateral: IFixedAsString;
}>;

export type SettledFundingEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	collateral: IFixedAsString;
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
	index_price: BigIntAsString;
	book_price: BigIntAsString;
	premium_twap: BigIntAsString;
	premium_twap_last_upd_ms: BigIntAsString;
}>;

export type UpdatedSpreadTwapEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	book_price: BigIntAsString;
	index_price: BigIntAsString;
	spread_twap: BigIntAsString;
	spread_twap_last_upd_ms: BigIntAsString;
}>;
