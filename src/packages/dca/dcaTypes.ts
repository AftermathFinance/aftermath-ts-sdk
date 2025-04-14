import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Timestamp,
	Event,
	TransactionDigest,
	SerializedTransaction,
	BigIntAsString,
} from "../../general/types/generalTypes";

// =========================================================================
//  Common Types
// =========================================================================

/**
 * Describes an optional integrator fee configuration for advanced usage,
 * allowing a portion of DCA trades to be collected by a third party.
 */
export interface DcaIntegratorFeeData {
	/**
	 * The fee in basis points (bps). e.g., 100 => 1%.
	 */
	feeBps: number;
	/**
	 * The Sui address that will receive the fee portion.
	 */
	feeRecipient: SuiAddress;
}

/**
 * Optional DCA order strategy parameters, typically bounding min & max
 * acceptable prices for the trades.
 */
export interface DcaOrderStrategyData {
	/**
	 * The minimum acceptable spot price for the trade, as a bigint scaled by 1e9 or 1e18 depending on usage.
	 */
	minPrice: Balance;
	/**
	 * The maximum acceptable spot price for the trade, similarly scaled.
	 */
	maxPrice: Balance;
}

// =========================================================================
//  Initialize Order Transaction
// =========================================================================

/**
 * The inputs required to create a new DCA order. This includes all relevant
 * coin types, amounts, frequency, trade count, etc.
 */
export interface ApiDcaTransactionForCreateOrderBody {
	/**
	 * The user's address that owns & initiates the DCA order.
	 */
	walletAddress: SuiAddress;
	/**
	 * The coin type from which funds will be allocated (sold).
	 */
	allocateCoinType: CoinType;
	/**
	 * The total amount of the allocate coin to be used across trades.
	 */
	allocateCoinAmount: Balance;
	/**
	 * The coin type that will be purchased periodically.
	 */
	buyCoinType: CoinType;
	/**
	 * The frequency (in ms) at which trades occur, e.g. every hour => 3600000.
	 */
	frequencyMs: Timestamp;
	/**
	 * The total number of trades to execute before concluding the DCA plan.
	 */
	tradesAmount: number;
	/**
	 * An optional bounding strategy specifying min & max acceptable prices.
	 */
	strategy?: DcaOrderStrategyData;
	/**
	 * If `true`, indicates a partially or fully sponsored transaction, removing gas burden from the user.
	 */
	isSponsoredTx?: boolean;
	/**
	 * A delay (in ms) before the first trade executes. If `0`, it starts immediately.
	 */
	delayTimeMs: Timestamp;
	/**
	 * The maximum allowable slippage (in basis points) for each trade, e.g. 100 => 1%.
	 */
	maxAllowableSlippageBps: number;
	/**
	 * The per-trade amount of `allocateCoinType` to be used, e.g. each trade uses 2 SUI if this is `2e9`.
	 */
	coinPerTradeAmount: Balance;
	/**
	 * An optional alternate address to receive the purchased coin. Defaults to `walletAddress` if undefined.
	 */
	customRecipient?: SuiAddress;
	/**
	 * Optional integrator fee data. If provided, a portion of each trade is allocated to the integrator.
	 */
	integratorFee?: DcaIntegratorFeeData;
}

// =========================================================================
// Close Order Transaction
// =========================================================================

/**
 * The request body for closing a DCA order, typically requiring a signature
 * over a JSON message specifying which orders to cancel.
 */
export interface ApiDcaTransactionForCloseOrderBody {
	/**
	 * The user's address initiating the close/cancel action.
	 */
	walletAddress: SuiAddress;
	/**
	 * The signed bytes of the cancellation message.
	 */
	bytes: string;
	/**
	 * The user's signature corresponding to `bytes`.
	 */
	signature: string;
}

// =========================================================================
// Manual Close Order Transaction
// =========================================================================

/**
 * Represents parameters for a manual order close workflow. Typically not
 * used in the standard approach.
 */
export type ApiDcaManualCloseOrderBody = {
	walletAddress: SuiAddress;
	buyCoinType: CoinType;
	allocateCoinType: CoinType;
	orderId: SuiAddress;
};

// =========================================================================
//  DCA Order Fetch
// =========================================================================

/**
 * Enumerates reasons that a DCA trade might fail, e.g., the price was out of bounds
 * or the user lacked enough gas.
 */
export type DcaFailedTradeReason =
	| "INTERNAL"
	| "STRATEGY"
	| "GAS_CAP"
	| "UNKNOWN_USER"
	| "SLIPPAGE";

/**
 * Represents data for a successful trade that occurred in a DCA sequence,
 * including the amounts of allocated/buy coins, the final transaction info, etc.
 */
export interface DcaOrderTradeObject {
	/**
	 * The coin & amount that was spent in this trade (e.g., SUI).
	 */
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	/**
	 * The coin & amount that was purchased (e.g., USDC).
	 */
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	/**
	 * The final transaction digest for this trade. (Deprecated field `tnxDigest` also present.)
	 */
	txnDigest: TransactionDigest;
	/** @deprecated use `txnDigest` instead */
	tnxDigest: TransactionDigest;

	/**
	 * The timestamp (in ms) when this trade was executed. (Deprecated field `tnxDate` also present.)
	 */
	txnTimestamp: Timestamp;
	/** @deprecated use `txnTimestamp` instead */
	tnxDate: Timestamp;

	/**
	 * The effective rate of the trade, if available, e.g. "0.95" or "1.10".
	 */
	rate: number | undefined;
}

/**
 * Represents a failed trade attempt in a DCA sequence, including time
 * of failure and the reason code.
 */
export interface DcaOrderFailedTradeObject {
	timestamp: number;
	reason: DcaFailedTradeReason | undefined;
}

/**
 * Summarizes the main details of a DCA order, including how much coin is allocated
 * and how many trades remain.
 */
export interface DcaOrderOverviewObject {
	/**
	 * The coin & amount the user allocated for the entire DCA cycle.
	 */
	allocatedCoin: {
		coin: CoinType;
		amount: Balance;
	};
	/**
	 * The coin & amount that is being purchased in each periodic trade.
	 */
	buyCoin: {
		coin: CoinType;
		amount: Balance;
	};
	/**
	 * The total amount of allocateCoin actually spent so far.
	 */
	totalSpent: Balance;
	/**
	 * The interval (in ms) between each trade, e.g., every hour => 3600000.
	 */
	intervalMs: Timestamp;
	/**
	 * The total number of trades that were planned.
	 */
	totalTrades: number;
	/**
	 * The number of remaining trades that have not yet executed.
	 */
	tradesRemaining: number;
	/**
	 * The maximum slippage (bps) allowed for each trade.
	 */
	maxSlippageBps: number;
	/**
	 * Optional bounding strategy with min/max acceptable prices.
	 */
	strategy?: DcaOrderStrategyData;
	/**
	 * The address to receive the purchased coin. Defaults to the DCA owner's address if unspecified.
	 */
	recipient: SuiAddress;
	/**
	 * Represents how far along the DCA has progressed, typically out of `totalTrades`.
	 */
	progress: number;
	/**
	 * Details about when & how the DCA was created. Contains timestamps and transaction references.
	 */
	created: {
		timestamp: Timestamp;
		/** @deprecated use `timestamp` instead */
		time: Timestamp;
		txnDigest: TransactionDigest;
		/** @deprecated use `txnDigest` instead */
		tnxDigest: TransactionDigest;
	};
	/**
	 * If the next trade is scheduled in the future, indicates when that trade will occur.
	 */
	nextTrade?: {
		timestamp: Timestamp;
		/** @deprecated use `timestamp` instead */
		time: Timestamp;
		txnDigest: TransactionDigest;
		/** @deprecated use `txnDigest` instead */
		tnxDigest: TransactionDigest;
	};
	/**
	 * If at least one trade has already executed, shows when & how the last one occurred.
	 */
	lastExecutedTrade?: {
		timestamp: Timestamp;
		/** @deprecated use `timestamp` instead */
		time: Timestamp;
		txnDigest: TransactionDigest;
		/** @deprecated use `txnDigest` instead */
		tnxDigest: TransactionDigest;
	};
	/**
	 * Optional integrator fee settings that might apply to each trade.
	 */
	integratorFee?: DcaIntegratorFeeData;
}

/**
 * Represents a single DCA order, including overview data, all successful trades, and all failed trades.
 */
export interface DcaOrderObject {
	/**
	 * The on-chain object ID representing this DCA order.
	 */
	objectId: ObjectId;
	/**
	 * Summary of the DCA (allocated amounts, trades remaining, etc.).
	 */
	overview: DcaOrderOverviewObject;
	/**
	 * An array of all completed trades.
	 */
	trades: DcaOrderTradeObject[];
	/**
	 * An array of attempted trades that failed, along with reasons/timestamps.
	 */
	failed: DcaOrderFailedTradeObject[];
}

/**
 * Represents a grouping of DCA orders, typically used in the older or combined approach.
 * Contains both `active` and `past` arrays.
 */
export interface DcaOrdersObject {
	/**
	 * Active DCA orders.
	 */
	active: DcaOrderObject[];
	/**
	 * Past (completed or canceled) DCA orders.
	 */
	past: DcaOrderObject[];
}

// =========================================================================
// User Fetch
// =========================================================================

/**
 * **Deprecated**. Body for creating a user public key in the old DCA system.
 * Use `ApiUserDataCreateUserBody` from `userData` package instead.
 */
export interface ApiDcaCreateUserBody {
	/**
	 * The Sui address of the user.
	 */
	walletAddress: SuiAddress;
	/**
	 * The message bytes that the user is signing (in hex or base64).
	 */
	bytes: string;
	/**
	 * The resulting signature from signing `bytes`.
	 */
	signature: string;
}

// =========================================================================
//  Owned DCAs
// =========================================================================

/**
 * **Deprecated**. Body for fetching the DCA orders owned by a specific user.
 * Use separate `getActiveDcaOrders` and `getPastDcaOrders` calls instead.
 */
export interface ApiDCAsOwnedBody {
	/**
	 * The user's Sui address whose DCA orders should be fetched.
	 */
	walletAddress: SuiAddress;
}
