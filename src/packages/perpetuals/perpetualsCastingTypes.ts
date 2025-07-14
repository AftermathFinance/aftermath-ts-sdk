import { EventOnChain } from "../../general/types/castingTypes";
import {
	AnyObjectType,
	BigIntAsString,
	Byte,
	CoinSymbol,
	IdAsStringBytes,
	IFixedAsBytes,
	IFixedAsString,
	IFixedAsStringBytes,
	ObjectId,
	PerpetualsAccountId,
	PerpetualsMarketId,
	PerpetualsOrderId,
	PerpetualsOrderIdAsString,
	SuiAddress,
} from "../../types";

// =========================================================================
//  Events
// =========================================================================

// =========================================================================
//  Collateral
// =========================================================================

export type UpdatedMarketVersionEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	version: BigIntAsString;
}>;

export type WithdrewCollateralEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	collateral: BigIntAsString;
}>;

export type DepositedCollateralEventOnChain = EventOnChain<{
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	collateral: BigIntAsString;
}>;

export type AllocatedCollateralEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	collateral: BigIntAsString;
}>;

export type DeallocatedCollateralEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	collateral: BigIntAsString;
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
	base_liquidated: IFixedAsString;
	quote_liquidated: IFixedAsString;
	liqee_pnl: IFixedAsString;
	liquidation_fees: IFixedAsString;
	force_cancel_fees: IFixedAsString;
	insurance_fund_fees: IFixedAsString;
	bad_debt: IFixedAsString;
}>;

export type PerformedLiquidationEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	liqee_account_id: BigIntAsString;
	liqor_account_id: BigIntAsString;
	is_liqee_long: boolean;
	base_liquidated: IFixedAsString;
	quote_liquidated: IFixedAsString;
	liqor_pnl: IFixedAsString;
	liqor_fees: IFixedAsString;
}>;

// =========================================================================
//  Account
// =========================================================================

export type CreatedAccountEventOnChain = EventOnChain<{
	user: SuiAddress;
	account_id: BigIntAsString;
}>;

export type CreatedSubAccountEventOnChain = EventOnChain<{
	users: SuiAddress[];
	account_id: PerpetualsAccountId;
	subaccount_id: ObjectId;
}>;

export type SetSubAccountUsersEventOnChain = EventOnChain<{
	users: SuiAddress[];
	account_id: PerpetualsAccountId;
	subaccount_id: ObjectId;
}>;

export type SetPositionInitialMarginRatioEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	initial_margin_ratio: IFixedAsString;
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

export type FilledMakerOrdersEventOnChain = EventOnChain<{
	events: {
		ch_id: ObjectId;
		maker_account_id: BigIntAsString;
		taker_account_id: BigIntAsString;
		fees: IFixedAsString;
		filled_size: BigIntAsString;
		order_id: BigIntAsString;
		pnl: IFixedAsString;
		remaining_size: BigIntAsString;
		canceled_size: BigIntAsString;
	}[];
}>;

export type FilledTakerOrderEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	taker_account_id: BigIntAsString;
	taker_pnl: IFixedAsString;
	taker_fees: IFixedAsString;
	base_asset_delta_ask: IFixedAsString;
	quote_asset_delta_ask: IFixedAsString;
	base_asset_delta_bid: IFixedAsString;
	quote_asset_delta_bid: IFixedAsString;
}>;

export type PostedOrderEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	order_id: BigIntAsString;
	order_size: BigIntAsString;
	reduce_only: boolean;
	expiration_timestamp_ms: BigIntAsString | null;
}>;

export type ReducedOrderEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	size_change: BigIntAsString;
	order_id: BigIntAsString;
}>;

// =========================================================================
//  Stop Orders
// =========================================================================

export type CreatedStopOrderTicketEventOnChain = EventOnChain<{
	ticket_id: ObjectId;
	account_id: BigIntAsString;
	subaccount_id: BigIntAsString | null;
	executors: SuiAddress[];
	gas: BigIntAsString;
	stop_order_type: BigIntAsString;
	encrypted_details: Byte[]; // vector<u8>
}>;

export type ExecutedStopOrderTicketEventOnChain = EventOnChain<{
	ticket_id: ObjectId;
	account_id: BigIntAsString;
	executor: SuiAddress;
}>;

export type DeletedStopOrderTicketEventOnChain = EventOnChain<{
	ticket_id: ObjectId;
	account_id: BigIntAsString;
	subaccount_id: ObjectId | null;
	executor: SuiAddress;
}>;

export type EditedStopOrderTicketDetailsEventOnChain = EventOnChain<{
	ticket_id: ObjectId;
	account_id: BigIntAsString;
	subaccount_id: ObjectId | null;
	stop_order_type: BigIntAsString;
	encrypted_details: Byte[]; // vector<u8>
}>;

export type EditedStopOrderTicketExecutorEventOnChain = EventOnChain<{
	ticket_id: ObjectId;
	account_id: BigIntAsString;
	subaccount_id: ObjectId | null;
	executors: SuiAddress[];
}>;

// export type AddedStopOrderTicketCollateralEventOnChain = EventOnChain<{
// 	ticket_id: ObjectId;
// 	account_id: BigIntAsString;
// 	subaccount_id: ObjectId | null;
// 	collateral_to_allocate: BigIntAsString;
// }>;

// export type RemovedStopOrderTicketCollateralEventOnChain = EventOnChain<{
// 	ticket_id: ObjectId;
// 	account_id: BigIntAsString;
// 	subaccount_id: ObjectId | null;
// 	collateral_to_remove: BigIntAsString;
// }>;

// export type TransferredDeallocatedCollateralEventOnChain = EventOnChain<{
// 	ch_id: ObjectId;
// 	/// Can be the `Account` or `SubAccount` object id
// 	obj_id: ObjectId;
// 	account_id: BigIntAsString;
// 	collateral: BigIntAsString;
// }>;

// export type ReceivedCollateralEventOnChain = EventOnChain<{
// 	/// Can be the `Account` or `SubAccount` object id
// 	obj_id: ObjectId;
// 	account_id: BigIntAsString;
// 	collateral: BigIntAsString;
// }>;

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

// =========================================================================
//  Funding
// =========================================================================

export type UpdatedFundingEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	cum_funding_rate_long: IFixedAsString;
	cum_funding_rate_short: IFixedAsString;
	funding_last_upd_ms: BigIntAsString;
}>;
