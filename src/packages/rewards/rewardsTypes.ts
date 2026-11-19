import type {
	Balance,
	BigIntAsString,
	CoinType,
	ObjectId,
	Percentage,
	SerializedTransaction,
	SuiAddress,
	Timestamp,
	TransactionDigest,
} from "../../types";
import type { PerpetualsAccountId } from "../perpetuals/perpetualsTypes";

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
	 * Sui wallet address to query history for.
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
//  API - Fee Rate
// =========================================================================

/**
 * Request body for fetching a wallet's volume and effective perpetuals fee
 * rates in the running rewards epoch.
 */
export interface ApiRewardsGetFeeRateBody {
	/**
	 * Sui wallet address to query fee rates for.
	 */
	walletAddress: SuiAddress;
}

/**
 * A wallet's traded volume and effective fee rates in the running rewards
 * epoch.
 *
 * Fee tiers are decided per epoch from the volume a wallet trades in that
 * epoch, so both volumes and rates move as the epoch goes on and start over
 * when the next one begins. A wallet that has not traded this epoch gets zero
 * volumes and the base rates; the same answer is returned while the running
 * epoch's volumes are not loaded yet.
 */
export interface ApiRewardsGetFeeRateResponse {
	/**
	 * The running epoch the figures cover, numbered from zero.
	 */
	epoch: number;
	/**
	 * Maker volume so far this epoch in USD, summed over all of the wallet's
	 * perpetuals accounts and markets.
	 */
	makerVolume: number;
	/**
	 * Taker volume so far this epoch in USD, summed over all of the wallet's
	 * perpetuals accounts and markets.
	 */
	takerVolume: number;
	/**
	 * Effective maker fee rate as a fraction of notional (`0.0001` is 1 bp):
	 * the maker fee tier reached by `makerVolume`, less the rebate tier reached
	 * by the wallet's share of all maker volume. Negative when the rebate
	 * exceeds the fee.
	 */
	makerFeeRate: number;
	/**
	 * Effective taker fee rate as a fraction of notional (`0.0001` is 1 bp):
	 * the taker fee tier reached by `takerVolume`, or the wallet's fixed rate
	 * when one is configured for it.
	 */
	takerFeeRate: number;
	/**
	 * The wallet's share of all maker volume this epoch (`0.005` is 0.5%),
	 * which picks its maker rebate tier. Zero when nobody has made yet.
	 */
	makerVolumeShare: number;
	/**
	 * True when `takerFeeRate` is a fixed rate configured for the wallet rather
	 * than the tier reached by `takerVolume`.
	 */
	takerFeeOverride: boolean;
}

// =========================================================================
//  API - Fee Schedule
// =========================================================================

/**
 * A volume tier: the rate applies once the wallet's volume this epoch reaches
 * `minVolume`.
 */
export interface RewardsFeeTier {
	/**
	 * Wallet volume this epoch in USD at which the tier starts (inclusive).
	 */
	minVolume: number;
	/**
	 * Fee rate as a fraction of notional (`0.0001` is 1 bp). Maker rates may be
	 * negative.
	 */
	feeRate: number;
}

/**
 * A maker rebate tier: the rebate applies once the wallet's share of all maker
 * volume this epoch reaches `minVolumeShare`.
 */
export interface RewardsMakerRebateTier {
	/**
	 * Share of all maker volume this epoch (`0.005` is 0.5%) at which the tier
	 * starts (inclusive).
	 */
	minVolumeShare: number;
	/**
	 * Rate subtracted from the maker fee, as a fraction of notional.
	 */
	rebateRate: number;
}

/**
 * The running epoch's perpetuals fee schedule, the same for every wallet.
 */
export interface ApiRewardsGetFeeScheduleResponse {
	/**
	 * The running epoch, numbered from zero like `getFeeRate`.
	 */
	epoch: number;
	/**
	 * When the running epoch started.
	 */
	epochStartTimestampMs: Timestamp;
	/**
	 * When the epoch ends and wallet volumes, so tiers, start over.
	 */
	epochEndTimestampMs: Timestamp;
	/**
	 * Taker tiers in ascending `minVolume`, reached by taker volume.
	 */
	takerFeeTiers: RewardsFeeTier[];
	/**
	 * Maker tiers in ascending `minVolume`, reached by maker volume.
	 */
	makerFeeTiers: RewardsFeeTier[];
	/**
	 * Rebate tiers in ascending `minVolumeShare`, subtracted from the maker
	 * tier rate.
	 */
	makerRebateTiers: RewardsMakerRebateTier[];
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

/** Raw response from the reward-claim transaction endpoint. */
export interface ApiRewardsClaimRequestTxResponse {
	/** Base64-serialized full transaction bytes or `TransactionKind` bytes. */
	txKind: SerializedTransaction;
}

// =========================================================================
//  Distribution
// =========================================================================

/**
 * Request body for computing the rewards distribution across perpetuals
 * accounts.
 *
 * This corresponds to `POST /api/rewards/distribution`, which replaces the
 * removed `POST /api/perpetuals/rebates/rewards`.
 *
 * Given maker and taker reward pools and a list of accounts, computes
 * per-account reward allocations and fee-tier rebates. When `accountIds` is
 * omitted or empty, all eligible accounts are included.
 *
 * **Note:** All data returned is for the current epoch only.
 */
export interface ApiRewardsDistributionBody {
	/**
	 * Optional account filter. Omit or pass an empty array for all eligible
	 * accounts. `Caller` serializes each id to the API's `"123n"` wire format
	 * and parses the response back, so pass real bigints here.
	 */
	accountIds?: PerpetualsAccountId[];
	/** Total maker reward pool to distribute among eligible market makers. */
	totalMakerRewards: number;
	/** Total taker reward pool to distribute among eligible takers. */
	totalTakerRewards: number;
	/** Coefficients used to compute Q-scores and taker shares. */
	calculationVariables: RewardsDistributionCalculationVariables;
}

/**
 * Coefficients used when computing Q-scores and taker shares. Each is a
 * weighting exponent applied to a corresponding per-account metric.
 */
export interface RewardsDistributionCalculationVariables {
	/** Exponent applied to the raw Q-score component. */
	qScoreCoefficient: number;
	/** Exponent applied to the uptime component. */
	uptimeCoefficient: number;
	/** Exponent applied to the maker volume component. */
	mmVolumeCoefficient: number;
	/** Exponent applied to the taker volume component. */
	takerVolumeCoefficient: number;
	/** Exponent applied to the taker open-interest component. */
	takerOiCoefficient: number;
}

/** Maker reward and rebate breakdown for a single account. */
export interface RewardsDistributionMakerData {
	/** Normalized Q-score: raw cross-market sum averaged over snapshot count. */
	qScore: number;
	/** Final score: `qScore^coeff * uptime^coeff * volume^coeff`. */
	qScoreFinal: number;
	/** Share of total `qScoreFinal` across all eligible accounts. */
	qScoreFinalShare: Percentage;
	/** Cross-market uptime count (number of snapshots with qualifying orders). */
	uptime: number;
	/** Q-score-based rewards from the maker reward pool. */
	rewards: number;
	/** Cross-market maker volume in USD. */
	volume: number;
	/** Share of total maker volume across all eligible accounts. */
	volumeShare: Percentage;
	/** Volume-share tier rebate: `tierRate * volume`. */
	volumeRebate: number;
	/** Total maker fees paid across all markets. */
	feesPaid: number;
	/** Fee tier rebate: `max(0, feesPaid - discountedFees)`. */
	feeRebate: number;
}

/** Taker reward and rebate breakdown for a single account. */
export interface RewardsDistributionTakerData {
	/** Volume-share-based rewards from the taker reward pool. */
	rewards: number;
	/** Cross-market taker volume in USD. */
	volume: number;
	/** Share of total taker volume across all eligible accounts. */
	volumeShare: Percentage;
	/** Total taker fees paid across all markets. */
	feesPaid: number;
	/** Fee tier rebate: `max(0, feesPaid - discountedFees)`. */
	feeRebate: number;
}

/** Combined reward and rebate data for a single account. */
export interface RewardsDistributionAccountData {
	/** Account receiving this reward and rebate breakdown. */
	accountId: PerpetualsAccountId;
	/** Maker-side reward and rebate metrics. */
	maker: RewardsDistributionMakerData;
	/** Taker-side reward and rebate metrics. */
	taker: RewardsDistributionTakerData;
}

/** Response body for the rewards distribution calculation. */
export interface ApiRewardsDistributionResponse {
	/** Sum of all final quality scores across eligible makers. */
	totalQScoreFinal: number;
	/** Total estimated gas cost for order management across all accounts (decimal SUI). */
	totalEstimatedGasCost: number;
	/** Per-account reward and rebate breakdown. */
	rewards: RewardsDistributionAccountData[];
}
