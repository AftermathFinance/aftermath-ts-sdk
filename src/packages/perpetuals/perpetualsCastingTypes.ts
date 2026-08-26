import type { EventOnChain } from "../../general/types/castingTypes";
import type {
	BigIntAsString,
	Byte,
	IFixedAsString,
	ObjectId,
	PerpetualsAccountId,
	SuiAddress,
} from "../../types";

// =========================================================================
//  Events
// =========================================================================

// =========================================================================
//  Collateral
// =========================================================================


/** Raw on-chain fields for a clearing-house version update event. */
export type UpdatedMarketVersionEventOnChain = EventOnChain<{
	/** Clearing-house object ID, serialized in the event payload. */
	ch_id: ObjectId;
	/** New on-chain version as a bigint-style decimal string. */
	version: BigIntAsString;
}>;

/** Raw on-chain fields for an account collateral-withdrawal event. */
export type WithdrewCollateralEventOnChain = EventOnChain<{
	/** Perpetuals account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	/** Withdrawn collateral in the coin's smallest unit. */
	collateral: BigIntAsString;
}>;

/** Raw on-chain fields for an account collateral-deposit event. */
export type DepositedCollateralEventOnChain = EventOnChain<{
	/** Perpetuals account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	/** Deposited collateral in the coin's smallest unit. */
	collateral: BigIntAsString;
}>;

/** Raw on-chain fields for allocating account collateral to a market. */
export type AllocatedCollateralEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Perpetuals account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	/** Allocated collateral in the coin's smallest unit. */
	collateral: BigIntAsString;
}>;

/** Raw on-chain fields for deallocating market collateral. */
export type DeallocatedCollateralEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Perpetuals account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
	// subaccount_id: ObjectId | null;
	/** Deallocated collateral in the coin's smallest unit. */
	collateral: BigIntAsString;
}>;

/** Raw on-chain fields for settling funding on an account and market. */
export type SettledFundingEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Perpetuals account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
	/** Signed USD collateral change in 18-decimal IFixed scale. */
	collateral_change_usd: IFixedAsString;
	/** Cumulative long funding rate in 18-decimal IFixed scale. */
	mkt_funding_rate_long: IFixedAsString;
	/** Cumulative short funding rate in 18-decimal IFixed scale. */
	mkt_funding_rate_short: IFixedAsString;
}>;

// =========================================================================
//  Liquidation
// =========================================================================

/** Raw on-chain fields for a liquidation event. */
export type LiquidatedEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Account ID of the liquidated account. */
	liqee_account_id: BigIntAsString;
	/** Account ID of the liquidator. */
	liqor_account_id: BigIntAsString;
	/** `true` when the liquidated position is long. */
	is_liqee_long: boolean;
	/** Liquidated base amount in 18-decimal IFixed scale. */
	base_liquidated: IFixedAsString;
	/** Liquidated quote amount in 18-decimal IFixed scale. */
	quote_liquidated: IFixedAsString;
	/** Liquidated account PnL in 18-decimal IFixed scale. */
	liqee_pnl: IFixedAsString;
	/** Liquidation fee in 18-decimal IFixed scale. */
	liquidation_fees: IFixedAsString;
	/** Forced order-cancellation fees in 18-decimal IFixed scale. */
	force_cancel_fees: IFixedAsString;
	/** Insurance-fund fee in 18-decimal IFixed scale. */
	insurance_fund_fees: IFixedAsString;
	/** Bad debt amount in 18-decimal IFixed scale. */
	bad_debt: IFixedAsString;
}>;

/** Raw on-chain fields for the liquidator-side liquidation event. */
export type PerformedLiquidationEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Account ID of the liquidated account. */
	liqee_account_id: BigIntAsString;
	/** Account ID of the liquidator. */
	liqor_account_id: BigIntAsString;
	/** `true` when the liquidated position is long. */
	is_liqee_long: boolean;
	/** Liquidated base amount in 18-decimal IFixed scale. */
	base_liquidated: IFixedAsString;
	/** Liquidated quote amount in 18-decimal IFixed scale. */
	quote_liquidated: IFixedAsString;
	/** Liquidator PnL in 18-decimal IFixed scale. */
	liqor_pnl: IFixedAsString;
	/** Liquidator fee in 18-decimal IFixed scale. */
	liqor_fees: IFixedAsString;
}>;

// =========================================================================
//  Account
// =========================================================================


/** Raw on-chain fields for creating a perpetuals account. */
export type CreatedAccountEventOnChain = EventOnChain<{
	/** User address that created the account. */
	user: SuiAddress;
	/** New account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
}>;

/** Raw on-chain fields for creating a subaccount. */
export type CreatedSubAccountEventOnChain = EventOnChain<{
	/** Addresses authorized for the subaccount. */
	users: SuiAddress[];
	/** Parent account ID. */
	account_id: PerpetualsAccountId;
	/** Created subaccount object ID. */
	subaccount_id: ObjectId;
}>;

/** Raw on-chain fields for changing subaccount users. */
export type SetSubAccountUsersEventOnChain = EventOnChain<{
	/** Addresses authorized for the subaccount after the change. */
	users: SuiAddress[];
	/** Parent account ID. */
	account_id: PerpetualsAccountId;
	/** Subaccount object ID. */
	subaccount_id: ObjectId;
}>;

/** Raw on-chain fields for setting a position's initial margin ratio. */
export type SetPositionInitialMarginRatioEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Perpetuals account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
	/** Initial margin ratio in 18-decimal IFixed scale. */
	initial_margin_ratio: IFixedAsString;
}>;

// =========================================================================
//  Order
// =========================================================================

/** Raw on-chain fields for canceling an order. */
export type CanceledOrderEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Perpetuals account ID as a bigint-style decimal string. */
	account_id: BigIntAsString;
	/** Canceled size in the order's raw integer scale. */
	size: BigIntAsString;
	/** Encoded order ID as a bigint-style decimal string. */
	order_id: BigIntAsString;
}>;

/** Raw on-chain fields for an aggregate maker-fill event. */
export type FilledMakerOrdersEventOnChain = EventOnChain<{
	/** Maker fills included in this aggregate event. */
	events: {
		/** Clearing-house object ID for the market. */
		ch_id: ObjectId;
		/** Maker account ID. */
		maker_account_id: BigIntAsString;
		/** Taker account ID. */
		taker_account_id: BigIntAsString;
		/** Maker fee in 18-decimal IFixed scale. */
		fees: IFixedAsString;
		/** Filled size in the order's raw integer scale. */
		filled_size: BigIntAsString;
		/** Encoded maker order ID. */
		order_id: BigIntAsString;
		/** Maker PnL in 18-decimal IFixed scale. */
		pnl: IFixedAsString;
		/** Remaining order size in the order's raw integer scale. */
		remaining_size: BigIntAsString;
		/** Canceled remainder in the order's raw integer scale. */
		canceled_size: BigIntAsString;
	}[];
}>;

/** Raw on-chain fields for a taker fill. */
export type FilledTakerOrderEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Taker account ID. */
	taker_account_id: BigIntAsString;
	/** Taker PnL in 18-decimal IFixed scale. */
	taker_pnl: IFixedAsString;
	/** Taker fee in 18-decimal IFixed scale. */
	taker_fees: IFixedAsString;
	/** Ask-side base delta in 18-decimal IFixed scale. */
	base_asset_delta_ask: IFixedAsString;
	/** Ask-side quote delta in 18-decimal IFixed scale. */
	quote_asset_delta_ask: IFixedAsString;
	/** Bid-side base delta in 18-decimal IFixed scale. */
	base_asset_delta_bid: IFixedAsString;
	/** Bid-side quote delta in 18-decimal IFixed scale. */
	quote_asset_delta_bid: IFixedAsString;
}>;

/** Raw on-chain fields for posting an order. */
export type PostedOrderEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Perpetuals account ID. */
	account_id: BigIntAsString;
	/** Encoded order ID. */
	order_id: BigIntAsString;
	/** Posted order size in the order's raw integer scale. */
	order_size: BigIntAsString;
	/** Whether the order can only reduce an existing position. */
	reduce_only: boolean;
	/** Optional expiration timestamp in Unix milliseconds. */
	expiration_timestamp_ms: BigIntAsString | null;
}>;

/** Raw on-chain fields for reducing an existing order. */
export type ReducedOrderEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Perpetuals account ID. */
	account_id: BigIntAsString;
	/** Reduced size in the order's raw integer scale. */
	size_change: BigIntAsString;
	/** Encoded order ID. */
	order_id: BigIntAsString;
}>;

// =========================================================================
//  Stop Orders
// =========================================================================

/** Raw on-chain fields for creating a stop-order ticket. */
export type CreatedStopOrderTicketEventOnChain = EventOnChain<{
	/** Stop-order ticket object ID. */
	ticket_id: ObjectId;
	/** Perpetuals account ID. */
	account_id: BigIntAsString;
	/** Optional subaccount ID. */
	subaccount_id: BigIntAsString | null;
	/** Wallets authorized to execute the ticket. */
	executors: SuiAddress[];
	/** Gas reserved for ticket execution in the coin's smallest unit. */
	gas: BigIntAsString;
	/** Stop-order type as a numeric protocol value. */
	stop_order_type: BigIntAsString;
	/** Encrypted stop-order details as raw bytes. */
	encrypted_details: Byte[]; // vector<u8>
}>;

/** Raw on-chain fields for executing a stop-order ticket. */
export type ExecutedStopOrderTicketEventOnChain = EventOnChain<{
	/** Stop-order ticket object ID. */
	ticket_id: ObjectId;
	/** Perpetuals account ID. */
	account_id: BigIntAsString;
	/** Wallet that executed the ticket. */
	executor: SuiAddress;
}>;

/** Raw on-chain fields for deleting a stop-order ticket. */
export type DeletedStopOrderTicketEventOnChain = EventOnChain<{
	/** Stop-order ticket object ID. */
	ticket_id: ObjectId;
	/** Perpetuals account ID. */
	account_id: BigIntAsString;
	/** Optional subaccount ID. */
	subaccount_id: ObjectId | null;
	/** Wallet that deleted the ticket. */
	executor: SuiAddress;
}>;

/** Raw on-chain fields for editing a stop-order ticket's details. */
export type EditedStopOrderTicketDetailsEventOnChain = EventOnChain<{
	/** Stop-order ticket object ID. */
	ticket_id: ObjectId;
	/** Perpetuals account ID. */
	account_id: BigIntAsString;
	/** Optional subaccount ID. */
	subaccount_id: ObjectId | null;
	/** Stop-order type as a numeric protocol value. */
	stop_order_type: BigIntAsString;
	/** Replacement encrypted stop-order details. */
	encrypted_details: Byte[]; // vector<u8>
}>;

/** Raw on-chain fields for editing stop-order ticket executors. */
export type EditedStopOrderTicketExecutorEventOnChain = EventOnChain<{
	/** Stop-order ticket object ID. */
	ticket_id: ObjectId;
	/** Perpetuals account ID. */
	account_id: BigIntAsString;
	/** Optional subaccount ID. */
	subaccount_id: ObjectId | null;
	/** Replacement list of wallets authorized to execute the ticket. */
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

/** Raw on-chain fields for a premium TWAP update. */
export type UpdatedPremiumTwapEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Index price in 18-decimal IFixed scale. */
	index_price: IFixedAsString;
	/** Book price in 18-decimal IFixed scale. */
	book_price: IFixedAsString;
	/** Premium TWAP in 18-decimal IFixed scale. */
	premium_twap: IFixedAsString;
	/** Premium TWAP update timestamp in Unix milliseconds. */
	premium_twap_last_upd_ms: BigIntAsString;
}>;

/** Raw on-chain fields for a spread TWAP update. */
export type UpdatedSpreadTwapEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Book price in 18-decimal IFixed scale. */
	book_price: IFixedAsString;
	/** Index price in 18-decimal IFixed scale. */
	index_price: IFixedAsString;
	/** Spread TWAP in 18-decimal IFixed scale. */
	spread_twap: IFixedAsString;
	/** Spread TWAP update timestamp in Unix milliseconds. */
	spread_twap_last_upd_ms: BigIntAsString;
}>;

// =========================================================================
//  Funding
// =========================================================================

/** Raw on-chain fields for a cumulative funding-rate update. */
export type UpdatedFundingEventOnChain = EventOnChain<{
	/** Clearing-house object ID for the market. */
	ch_id: ObjectId;
	/** Cumulative long funding rate in 18-decimal IFixed scale. */
	cum_funding_rate_long: IFixedAsString;
	/** Cumulative short funding rate in 18-decimal IFixed scale. */
	cum_funding_rate_short: IFixedAsString;
	/** Funding update timestamp in Unix milliseconds. */
	funding_last_upd_ms: BigIntAsString;
}>;
