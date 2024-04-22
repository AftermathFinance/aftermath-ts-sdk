import { EventOnChain } from "../../general/types/castingTypes";
import {
	AnyObjectType,
	BigIntAsString,
	IFixedAsString,
	ObjectId,
	PerpetualsMarketId,
	SuiAddress,
} from "../../types";

// =========================================================================
//  Objects
// =========================================================================

/// Used to dynamically load market objects as needed.
/// Used to dynamically load traders' position objects as needed.
export interface PerpetualsClearingHouseFieldsOnChain {
	market_params: {
		type: AnyObjectType;
		fields: PerpetualsMarketParamsFieldsOnChain;
	};
	market_state: {
		type: AnyObjectType;
		fields: PerpetualsMarketStateFieldsOnChain;
	};
}

/// Static attributes of a perpetuals market.
export interface PerpetualsMarketParamsFieldsOnChain {
	/// Minimum margin ratio for opening a new position.
	margin_ratio_initial: IFixedAsString;
	/// Margin ratio below which full liquidations can occur.
	margin_ratio_maintenance: IFixedAsString;
	/// Identifier to query the index price of the base asset from the oracle.
	base_asset_symbol: string;
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
	maker_fee: IFixedAsString;
	/// Proportion of volume charged as fees from takers after processing
	/// fill events.
	taker_fee: IFixedAsString;
	/// Proportion of volume charged as fees from liquidatees
	liquidation_fee: IFixedAsString;
	/// Proportion of volume charged as fees from liquidatees after forced cancelling
	/// of pending orders during liquidation.
	force_cancel_fee: IFixedAsString;
	/// Proportion of volume charged as fees from liquidatees to deposit into insurance fund
	insurance_fund_fee: IFixedAsString;
	/// Minimum USD value an order is required to be worth to be placed
	min_order_usd_value: IFixedAsString;
	/// Number of base units exchanged per lot
	lot_size: BigIntAsString;
	/// Number of quote units exchanged per tick
	tick_size: BigIntAsString;
	/// Number of lots in a position that a liquidator may buy in excess of what would be
	/// strictly required to bring the liqee's account back to IMR.
	liquidation_tolerance: BigIntAsString;
	/// Maximum number of pending orders that a position can have.
	max_pending_orders: BigIntAsString;
	/// Timestamp tolerance for oracle prices
	oracle_tolerance: BigIntAsString;
}

/// The state of a perpetuals market.
export interface PerpetualsMarketStateFieldsOnChain {
	/// The latest cumulative funding premium in this market for longs. Must be updated
	/// periodically.
	cum_funding_rate_long: IFixedAsString;
	/// The latest cumulative funding premium in this market for shorts. Must be updated
	/// periodically.
	cum_funding_rate_short: IFixedAsString;
	/// The timestamp (millisec) of the latest cumulative funding premium update
	/// (both longs and shorts).
	funding_last_upd_ms: BigIntAsString;
	/// The last calculated funding premium TWAP (used for funding settlement).
	premium_twap: IFixedAsString;
	/// The timestamp (millisec) of the last update of `premium_twap`.
	premium_twap_last_upd_ms: BigIntAsString;
	/// The last calculated spread TWAP (used for liquidations).
	/// Spread is (book - index).
	spread_twap: IFixedAsString;
	/// The timestamp (millisec) of `spread_twap` last update.
	spread_twap_last_upd_ms: BigIntAsString;
	/// Open interest (in base tokens) as a fixed-point number. Counts the
	/// total size of contracts as the sum of all long positions.
	open_interest: IFixedAsString;
	/// Total amount of fees accrued by this market (in T's units)
	/// Only admin can withdraw these fees.
	fees_accrued: IFixedAsString;
}

export type PerpetualsAccountPositionsIndexerResponse = [
	PerpetualsMarketId,
	{
		position: {
			/// Amount of allocated tokens (e.g., USD stables) backing this account's position.
			collateral: number[];
			/// The perpetual contract size, controlling the amount of exposure to
			/// the underlying asset. Positive implies long position and negative,
			/// short. Represented as a signed fixed-point number.
			base_asset_amount: number[];
			/// The entry value for this position, including leverage. Represented
			/// as a signed fixed-point number.
			quote_asset_notional_amount: number[];
			/// Last long cumulative funding rate used to update this position. The
			/// market's latest long cumulative funding rate minus this gives the funding
			/// rate this position must pay. This rate multiplied by this position's
			/// value (base asset amount * market price) gives the total funding
			/// owed, which is deducted from the trader account's margin. This debt
			/// is accounted for in margin ratio calculations, which may lead to
			/// liquidation. Represented as a signed fixed-point number.
			cum_funding_rate_long: number[];
			/// Last short cumulative funding rate used to update this position. The
			/// market's latest short cumulative funding rate minus this gives the funding
			/// rate this position must pay. This rate multiplied by this position's
			/// value (base asset amount * market price) gives the total funding
			/// owed, which is deducted from the trader account's margin. This debt
			/// is accounted for in margin ratio calculations, which may lead to
			/// liquidation. Represented as a signed fixed-point number.
			cum_funding_rate_short: number[];
			/// Base asset amount resting in ask orders in the orderbook.
			/// Represented as a signed fixed-point number.
			asks_quantity: number[];
			/// Base asset amount resting in bid orders in the orderbook.
			/// Represented as a signed fixed-point number.
			bids_quantity: number[];
			/// Number of pending orders in this position.
			pending_orders: number;
			/// Custom maker fee for this position, set at default value of 100%
			maker_fee: number[];
			/// Custom taker fee for this position, set at default value of 100%
			taker_fee: number[];
		};
		pending_orders: {
			bids: Record<
				string, // PerpetualsOrderId
				number // size
			>;
			asks: Record<
				string, // PerpetualsOrderId
				number // size
			>;
		};
	}
][];

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
