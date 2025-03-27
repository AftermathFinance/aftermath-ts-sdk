import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Timestamp,
	TransactionDigest,
} from "../../general/types/generalTypes";

// =========================================================================
//  Common Types
// =========================================================================

/**
 * Describes an optional integrator fee structure for advanced usage,
 * allowing a portion of limit orders to be allocated to a third party.
 */
export interface LimitOrdersIntegratorFeeData {
	/**
	 * The integrator fee percentage in basis points (bps), e.g., 100 => 1%.
	 */
	feeBps: number;
	/**
	 * The recipient address for fee collection.
	 */
	feeRecipient: SuiAddress;
}

// =========================================================================
//  Initialize Order Transaction
// =========================================================================

/**
 * Defines the body required to create a new limit order transaction. This includes
 * coin types, amounts, expiry settings, and optional integrator fees.
 */
export interface ApiLimitOrdersCreateOrderTransactionBody {
	/**
	 * The user address creating the limit order.
	 */
	walletAddress: SuiAddress;
	/**
	 * The coin type to be allocated/sold in the order.
	 */
	allocateCoinType: CoinType;
	/**
	 * The total amount of the allocateCoin to be reserved for this order.
	 */
	allocateCoinAmount: Balance;
	/**
	 * The coin type to be purchased when price conditions are met.
	 */
	buyCoinType: CoinType;
	/**
	 * Optionally specify a custom recipient of the purchased coin, defaulting to `walletAddress`.
	 */
	customRecipient?: SuiAddress;
	/**
	 * The duration (in ms) after which the limit order expires and becomes invalid.
	 * If `0`, there's effectively no set expiry.
	 */
	expiryDurationMs: number;
	/**
	 * Indicates whether the transaction is sponsored, potentially reducing user gas fees.
	 */
	isSponsoredTx?: boolean;
	/**
	 * Optional integrator fee details for advanced usage.
	 */
	integratorFee?: LimitOrdersIntegratorFeeData;
	/**
	 * The "take-profit" exchange rate from `buyCoinType` to `allocateCoinType`.
	 * For example, if `outputToInputExchangeRate` is 0.5, it means 1 buyCoin can be sold for 0.5 allocateCoin.
	 */
	outputToInputExchangeRate: number;
	/**
	 * Optional "stop-loss" exchange rate. If the market moves such that the trade
	 * would invert beyond this rate, the order might close early or fail, depending on logic.
	 */
	outputToInputStopLossExchangeRate?: number;
}

/**
 * Additional body for sub-orders if using a multi-tier approach (ladders).
 */
export interface ApiLimitOrdersSubOrdersBody {
	/**
	 * The order price (e.g., an exchange rate or threshold).
	 */
	orderPrice: Balance;
	/**
	 * The number of partial orders to create at this price level.
	 */
	ordersAmount: number;
}

// =========================================================================
//  Initialize Ladders Order Transaction
// =========================================================================

/**
 * Defines a single "ladder" rung, specifying how much to trade at a certain price.
 */
export interface ApiLimitLaddersOrdersBody {
	/**
	 * The specific price (exchange rate) for this rung.
	 */
	price: Balance;
	/**
	 * The total quantity/amount to trade if the price is reached.
	 */
	quantity: Balance;
}

// =========================================================================
// Cancel Order Transaction
// =========================================================================

/**
 * Body required to cancel an existing limit order, typically including the
 * user's signature of a JSON message referencing order IDs.
 */
export interface ApiLimitOrdersCancelOrderTransactionBody {
	/**
	 * The Sui address of the user who owns the order(s).
	 */
	walletAddress: SuiAddress;
	/**
	 * The signed bytes of the cancellation message.
	 */
	bytes: string;
	/**
	 * The signature over those bytes, verifying user intent.
	 */
	signature: string;
}

// =========================================================================
//  Limit Order Fetch
// =========================================================================

/**
 * Enumerates all possible statuses for a limit order on Aftermath.
 */
export type LimitOrdersOrderStatus =
	| "Active"
	| "Canceled"
	| "Failed"
	| "Filled"
	| "Expired"
	| "StopLossTriggered";

/**
 * Represents the on-chain data structure for a single limit order, including
 * allocated coin amounts, buy coin details, creation/finalization times, etc.
 */
export interface LimitOrderObject {
	/**
	 * The on-chain object ID referencing this limit order.
	 */
	objectId: ObjectId;
	/**
	 * The coin & amount allocated for potential trading.
	 */
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	/**
	 * The coin & amount to be acquired if/when the order conditions are met.
	 */
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	/**
	 * Tracks how much of the allocated coin has actually been used (sold).
	 */
	currentAmountSold: Balance;
	/**
	 * Tracks how much of the buy coin has actually been purchased.
	 */
	currentAmountBought: Balance;
	/**
	 * The address that will receive the bought coin, often the same as `walletAddress`.
	 */
	recipient: SuiAddress;
	/**
	 * Contains timestamps and transaction references for order creation.
	 */
	created: {
		timestamp: Timestamp;
		txnDigest: TransactionDigest;
	};
	/**
	 * If the order has finished, indicates when and via which transaction it concluded.
	 */
	finished?: {
		timestamp: Timestamp;
		txnDigest: TransactionDigest;
	};
	/**
	 * The UNIX timestamp (ms) after which the order is considered expired.
	 */
	expiryTimestamp: Timestamp;
	/**
	 * The current status of the order (Active, Canceled, etc.).
	 */
	status: LimitOrdersOrderStatus;
	/**
	 * If the order ended or failed with an error, this might contain a reason or message.
	 */
	error?: string;
	/**
	 * Optional integrator fee data for advanced usage.
	 */
	integratorFee?: LimitOrdersIntegratorFeeData;
	/**
	 * Optional stop-loss exchange rate; if triggered, the order might end or convert differently.
	 */
	outputToInputStopLossExchangeRate?: number;
}

// =========================================================================
//  Owned Limit Orders
// =========================================================================

/**
 * Body for fetching past (completed, canceled, expired, etc.) limit orders of a user.
 */
export interface ApiLimitOrdersPastOrdersOwnedBody {
	/**
	 * The Sui address of the user.
	 */
	walletAddress: SuiAddress;
}

/**
 * Body for fetching active limit orders of a user, requiring user signature data for identification.
 */
export interface ApiLimitOrdersActiveOrdersOwnedBody {
	/**
	 * The Sui address of the user.
	 */
	walletAddress: SuiAddress;
	/**
	 * Signed bytes of a message verifying user identity.
	 */
	bytes: string;
	/**
	 * Signature over the `bytes`.
	 */
	signature: string;
}
