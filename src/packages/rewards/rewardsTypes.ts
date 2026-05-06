import type { Transaction } from "@mysten/sui/transactions";
import type {
	Balance,
	CoinType,
	ObjectId,
	SerializedTransaction,
	SuiAddress,
	Timestamp,
	TransactionDigest,
} from "../../types";

// =========================================================================
//  API - Points
// =========================================================================

/**
 * Request body for fetching a user's total accumulated reward points.
 * Uses a pre-signed message (bytes + signature) for authentication.
 */
export interface ApiRewardsGetPointsBody {
	/**
	 * Sui wallet address to query total points for.
	 */
	walletAddress: SuiAddress;
	/**
	 * The message bytes (base64 encoded) that the user previously signed.
	 * Can be reused from other signed messages (e.g., Terms and Conditions).
	 */
	bytes: string;
	/**
	 * The signature corresponding to the signed message bytes.
	 */
	signature: string;
}

/**
 * Response containing the user's total accumulated reward points.
 */
export interface ApiRewardsGetPointsResponse {
	/**
	 * Total accumulated points for this wallet across all epochs and domains.
	 */
	totalPoints: number;
}

// =========================================================================
//  API - History
// =========================================================================

/**
 * Request body for fetching a user's rewards history.
 * Uses a pre-signed message (bytes + signature) for authentication.
 */
export interface ApiRewardsGetHistoryBody {
	/**
	 * The user's Sui wallet address (e.g., "0x<address>").
	 */
	walletAddress: SuiAddress;
	/**
	 * The message bytes (base64 encoded) that the user previously signed.
	 * Can be reused from other signed messages (e.g., Terms and Conditions).
	 */
	bytes: string;
	/**
	 * The signature corresponding to the signed message bytes.
	 */
	signature: string;
	/**
	 * Optional domain filter (e.g., "referrals", "perpetuals").
	 * If omitted, returns all domains.
	 */
	domain?: string;
	/**
	 * Maximum number of entries to return. Default: 20, max: 100.
	 */
	limit?: number;
	/**
	 * Cursor for fetching next page.
	 */
	cursor?: number;
}

/**
 * Response containing the user's rewards history.
 */
export interface ApiRewardsGetHistoryResponse {
	/**
	 * Array of historical reward entries.
	 */
	history: RewardsHistoryEntry[];
	/**
	 * Pagination info.
	 */
	pagination: RewardsPaginationInfo;
}

/**
 * Event type for a rewards history entry.
 */
export type RewardsHistoryEventType = "deposit" | "withdraw" | "points";

/**
 * A single historical reward entry.
 */
export interface RewardsHistoryEntry {
	/**
	 * Vault ID where the event occurred.
	 */
	vaultId: ObjectId;
	/**
	 * Fully-qualified Coin type (e.g., "0x2::sui::SUI"), or "points" for point entries.
	 */
	coinType: "points" | (CoinType & {});
	/**
	 * Reward amount in base units.
	 */
	amount: Balance;
	/**
	 * Domain identifier (e.g., "referrals", "perpetuals").
	 */
	domain: string;
	/**
	 * Epoch start timestamp in milliseconds.
	 */
	epochStartTimestampMs: Timestamp;
	/**
	 * Epoch end timestamp in milliseconds.
	 */
	epochEndTimestampMs: Timestamp;
	/**
	 * Transaction digest for this event, if available.
	 */
	txDigest?: TransactionDigest;
	/**
	 * Event type: "deposit", "withdraw", or "points".
	 */
	eventType: RewardsHistoryEventType;
}

/**
 * Pagination information for paginated reward queries.
 */
export interface RewardsPaginationInfo {
	/**
	 * True if more results exist beyond the returned set.
	 */
	hasMore: boolean;
	/**
	 * Cursor for fetching the next page. Undefined if no more results.
	 */
	nextCursor?: number;
}

// =========================================================================
//  API - Claimable
// =========================================================================

/**
 * Request body for fetching a user's claimable rewards.
 */
export interface ApiRewardsGetClaimableBody {
	/**
	 * Sui wallet address to query claimable rewards for.
	 */
	walletAddress: SuiAddress;
}

/**
 * Response containing the user's claimable rewards.
 */
export interface ApiRewardsGetClaimableResponse {
	/**
	 * Array of claimable reward entries, one per coin type.
	 * Empty array if no rewards are claimable.
	 */
	rewards: RewardsClaimableReward[];
}

/**
 * A single claimable reward entry.
 */
export interface RewardsClaimableReward {
	/**
	 * Full Sui coin type (e.g., "0x2::sui::SUI").
	 */
	coinType: CoinType;
	/**
	 * Claimable amount in base units.
	 */
	amount: Balance;
}

// =========================================================================
//  API - Claim
// =========================================================================

/**
 * Request body for claiming rewards for a user's wallet address.
 */
export interface ApiRewardsClaimRequestTxBody {
	/**
	 * The user's Sui wallet address.
	 */
	walletAddress: SuiAddress;
	/**
	 * Optional list of coin types to claim.
	 * If omitted, claims all available rewards.
	 */
	coinTypes?: CoinType[];
	/**
	 * Optional recipient address for the claimed rewards.
	 * Defaults to walletAddress if not provided.
	 */
	recipientAddress?: SuiAddress;
	/**
	 * Optional serialized (base64) Sui `TransactionKind` to extend.
	 */
	txKind?: SerializedTransaction;
}

export interface ApiRewardsClaimRequestTxResponse {
	txKind: SerializedTransaction;
}
