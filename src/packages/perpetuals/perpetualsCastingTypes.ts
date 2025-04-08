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
	PerpetualsMarketId,
	PerpetualsOrderId,
	PerpetualsOrderIdAsString,
	SuiAddress,
} from "../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface PerpetualsMarketDataIndexerResponse {
	pkg_id: IdAsStringBytes;
	initial_shared_version: BigIntAsString;
	object: {
		id: {
			id: IdAsStringBytes;
		};
		version: BigIntAsString;
		market_params: PerpetualsMarketParamsFieldsIndexerReponse;
		market_state: PerpetualsMarketStateFieldsIndexerReponse;
	};
}

export interface PerpetualsOrderbookIndexerResponse {
	asks: Record<
		PerpetualsOrderIdAsString,
		{
			account_id: BigIntAsString;
			size: BigIntAsString;
		}
	>;
	bids: Record<
		PerpetualsOrderIdAsString,
		{
			account_id: BigIntAsString;
			size: BigIntAsString;
		}
	>;
	asks_size: BigIntAsString;
	bids_size: BigIntAsString;
}

/// Static attributes of a perpetuals market.
export interface PerpetualsMarketParamsFieldsIndexerReponse {
	/// Minimum margin ratio for opening a new position.
	margin_ratio_initial: IFixedAsStringBytes;
	/// Margin ratio below which full liquidations can occur.
	margin_ratio_maintenance: IFixedAsStringBytes;
	/// Identifier to query the index price of the base asset from the oracle.
	base_pfs_id: IdAsStringBytes;
	collateral_pfs_id: IdAsStringBytes;
	/// The time span between each funding rate update.
	funding_frequency_ms: BigIntAsString;
	/// Period of time over which funding (the difference between book and
	/// index prices) gets paid.
	///
	/// Setting the funding period too long may cause the perpetual to start
	/// trading at a very dislocated price to the index because there's less
	/// of an incentive for basis arbitrageurs to push the prices back in
	/// line since they would have to carry the basis risk for a longer
	/// period of time.
	///
	/// Setting the funding period too short may cause nobody to trade the
	/// perpetual because there's too punitive of a price to pay in the case
	/// the funding rate flips sign.
	funding_period_ms: BigIntAsString;
	/// The time span between each funding TWAP (both index price and orderbook price) update.
	premium_twap_frequency_ms: BigIntAsString;
	/// The reference time span used for weighting the TWAP (both index price and orderbook price)
	/// updates for funding rates estimation
	premium_twap_period_ms: BigIntAsString;
	/// The time span between each spread TWAP updates (used for liquidations).
	spread_twap_frequency_ms: BigIntAsString;
	/// The reference time span used for weighting the TWAP updates for spread.
	spread_twap_period_ms: BigIntAsString;
	/// Proportion of volume charged as fees from makers upon processing
	/// fill events.
	maker_fee: IFixedAsStringBytes;
	/// Proportion of volume charged as fees from takers after processing
	/// fill events.
	taker_fee: IFixedAsStringBytes;
	/// Proportion of volume charged as fees from liquidatees
	liquidation_fee: IFixedAsStringBytes;
	/// Proportion of volume charged as fees from liquidatees after forced cancelling
	/// of pending orders during liquidation.
	force_cancel_fee: IFixedAsStringBytes;
	/// Proportion of volume charged as fees from liquidatees to deposit into insurance fund
	insurance_fund_fee: IFixedAsStringBytes;
	/// Minimum USD value an order is required to be worth to be placed
	min_order_usd_value: IFixedAsStringBytes;
	/// Number of base units exchanged per lot
	lot_size: BigIntAsString;
	/// Number of quote units exchanged per tick
	tick_size: BigIntAsString;
	/// Number of lots in a position that a liquidator may buy in excess of what would be
	/// strictly required to bring the liqee's account back to IMR.
	liquidation_tolerance: BigIntAsString;
	/// Maximum number of pending orders that a position can have.
	max_pending_orders: BigIntAsString;
	/// Timestamp tolerance for base oracle price
	base_oracle_tolerance: BigIntAsString;
	/// Timestamp tolerance for collateral oracle price
	collateral_oracle_tolerance: BigIntAsString;
}

/// The state of a perpetuals market.
export interface PerpetualsMarketStateFieldsIndexerReponse {
	/// The latest cumulative funding premium in this market for longs. Must be updated
	/// periodically.
	cum_funding_rate_long: IFixedAsStringBytes;
	/// The latest cumulative funding premium in this market for shorts. Must be updated
	/// periodically.
	cum_funding_rate_short: IFixedAsStringBytes;
	/// The timestamp (millisec) of the latest cumulative funding premium update
	/// (both longs and shorts).
	funding_last_upd_ms: BigIntAsString;
	/// The last calculated funding premium TWAP (used for funding settlement).
	premium_twap: IFixedAsStringBytes;
	/// The timestamp (millisec) of the last update of `premium_twap`.
	premium_twap_last_upd_ms: BigIntAsString;
	/// The last calculated spread TWAP (used for liquidations).
	/// Spread is (book - index).
	spread_twap: IFixedAsStringBytes;
	/// The timestamp (millisec) of `spread_twap` last update.
	spread_twap_last_upd_ms: BigIntAsString;
	/// Open interest (in base tokens) as a fixed-point number. Counts the
	/// total size of contracts as the sum of all long positions.
	open_interest: IFixedAsStringBytes;
	/// Total amount of fees accrued by this market (in T's units)
	/// Only admin can withdraw these fees.
	fees_accrued: IFixedAsStringBytes;
}

export interface PerpetualsPositionIndexerResponse {
	position: {
		/// Amount of allocated tokens (e.g., USD stables) backing this account's position.
		collateral: IFixedAsStringBytes;
		/// The perpetual contract size, controlling the amount of exposure to
		/// the underlying asset. Positive implies long position and negative,
		/// short. Represented as a signed fixed-point number.
		base_asset_amount: IFixedAsStringBytes;
		/// The entry value for this position, including leverage. Represented
		/// as a signed fixed-point number.
		quote_asset_notional_amount: IFixedAsStringBytes;
		/// Last long cumulative funding rate used to update this position. The
		/// market's latest long cumulative funding rate minus this gives the funding
		/// rate this position must pay. This rate multiplied by this position's
		/// value (base asset amount * market price) gives the total funding
		/// owed, which is deducted from the trader account's margin. This debt
		/// is accounted for in margin ratio calculations, which may lead to
		/// liquidation. Represented as a signed fixed-point number.
		cum_funding_rate_long: IFixedAsStringBytes;
		/// Last short cumulative funding rate used to update this position. The
		/// market's latest short cumulative funding rate minus this gives the funding
		/// rate this position must pay. This rate multiplied by this position's
		/// value (base asset amount * market price) gives the total funding
		/// owed, which is deducted from the trader account's margin. This debt
		/// is accounted for in margin ratio calculations, which may lead to
		/// liquidation. Represented as a signed fixed-point number.
		cum_funding_rate_short: IFixedAsStringBytes;
		/// Base asset amount resting in ask orders in the orderbook.
		/// Represented as a signed fixed-point number.
		asks_quantity: IFixedAsStringBytes;
		/// Base asset amount resting in bid orders in the orderbook.
		/// Represented as a signed fixed-point number.
		bids_quantity: IFixedAsStringBytes;
		/// Number of pending orders in this position.
		pending_orders: BigIntAsString;
		/// Custom maker fee for this position, set at default value of 100%
		maker_fee: IFixedAsStringBytes;
		/// Custom taker fee for this position, set at default value of 100%
		taker_fee: IFixedAsStringBytes;
	};
	pending_orders: {
		bids: Record<
			string, // PerpetualsOrderId
			BigIntAsString // size
		>;
		asks: Record<
			string, // PerpetualsOrderId
			BigIntAsString // size
		>;
	};
}

export type PerpetualsAccountPositionsIndexerResponse = [
	IdAsStringBytes, // PerpetualsMarketId
	PerpetualsPositionIndexerResponse,
	IFixedAsStringBytes // leverage
][];

export type PerpetualsPreviewOrderIndexerResponse =
	| {
			position: PerpetualsPositionIndexerResponse;
			price_slippage: IFixedAsStringBytes;
			percent_slippage: IFixedAsStringBytes;
			execution_price: IFixedAsStringBytes;
			size_filled: IFixedAsStringBytes;
			collateral_change: IFixedAsStringBytes;
			position_found: boolean;
			size_posted?: IFixedAsStringBytes;
	  }
	| {
			error: string;
	  };

export type PerpetualsPreviewCancelOrdersIndexerResponse =
	| {
			positions: PerpetualsPositionIndexerResponse[];
			collaterals_change: IFixedAsStringBytes[];
	  }
	| {
			error: string;
	  };

export type PerpetualsPreviewReduceOrderIndexerResponse =
	| {
			position: PerpetualsPositionIndexerResponse;
			collateral_change: IFixedAsStringBytes;
	  }
	| {
			error: string;
	  };

export type PerpetualsPreviewSetLeverageIndexerResponse =
	| {
			position: PerpetualsPositionIndexerResponse;
			collateral_change: IFixedAsStringBytes;
	  }
	| {
			error: string;
	  };

export type PerpetualsMarketsIndexerResponse = Record<
	PerpetualsMarketId,
	[
		PerpetualsMarketDataIndexerResponse,
		CoinSymbol,
		// index price
		IFixedAsStringBytes,
		// collateral price
		IFixedAsStringBytes
	]
>;

export type PerpetualsMarketIndexerResponse = {
	ch: [PerpetualsMarketDataIndexerResponse, CoinSymbol];
	orderbook: PerpetualsOrderbookIndexerResponse;
	index_price: IFixedAsStringBytes;
	collateral_price: IFixedAsStringBytes;
};

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

export type PostedOrderReceiptEventOnChain = EventOnChain<{
	ch_id: ObjectId;
	account_id: BigIntAsString;
	order_id: BigIntAsString;
	order_size: BigIntAsString;
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

// export type CreatedStopOrderTicketEventOnChain = EventOnChain<{
// 	ticket_id: ID,
// 	account_id: u64,
// 	recipient: address,
// 	encrypted_details: vector<u8>
// }>;

// export type DeletedStopOrderTicketEventOnChain = EventOnChain<{
// 	ticket_id: ID;
// 	account_id: u64;
// 	executed: bool;
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
