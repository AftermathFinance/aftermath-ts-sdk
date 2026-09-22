import type {
	ObjectId,
	SuiAddress,
	Timestamp,
	TransactionDigest,
} from "../../types";

// =========================================================================
//  Data
// =========================================================================

/**
 * Rarity tier for an achievement definition.
 *
 * Wire values match the service `Tier` enum (`snake_case`).
 */
export type AchievementsTier = "common" | "uncommon" | "rare";

/**
 * Status of the reward-points credit for one unlock.
 *
 * Wire values match the service `PointsStatus` enum (`snake_case`).
 */
export type AchievementsPointsStatus =
	| "pending"
	| "skipped"
	| "credited"
	| "failed";

/**
 * Status of the on-chain mint for one unlock.
 *
 * Wire values match the service `MintStatus` enum (`snake_case`), including
 * `dry_run` and `mint_failed`.
 */
export type AchievementsMintStatus =
	| "pending"
	| "dry_run"
	| "minted"
	| "mint_failed"
	| "skipped";

/**
 * Public view of one achievement definition.
 *
 * Field names match `DefinitionView` (`camelCase`) from the achievements
 * service.
 */
export interface AchievementsDefinitionView {
	/**
	 * Stable identifier for the achievement.
	 */
	achievementId: string;
	/**
	 * Display name.
	 */
	name: string;
	/**
	 * Display description.
	 */
	description: string;
	/**
	 * Product this achievement belongs to (for example, `"spot"`).
	 */
	product: string;
	/**
	 * Rarity tier.
	 */
	tier: AchievementsTier;
	/**
	 * XP granted when the achievement unlocks.
	 */
	xpReward: number;
	/**
	 * Reward points granted when the achievement unlocks.
	 */
	pointsReward: number;
	/**
	 * Whether the definition is currently active.
	 */
	enabled: boolean;
	/**
	 * Image URL for the achievement.
	 */
	imageUrl: string;
	/**
	 * Trigger key the service uses to evaluate the achievement.
	 */
	trigger: string;
	/**
	 * Optional USD volume threshold. Absent when this definition is not
	 * volume-based.
	 */
	thresholdUsd?: number;
	/**
	 * Optional count threshold. Absent when this definition is not count-based.
	 */
	thresholdCount?: number;
	/**
	 * Whether unlocking this definition mints an NFT.
	 */
	mintOnUnlock: boolean;
}

/**
 * Cumulative XP progress for a wallet. Absent on `MeResponse` until the wallet
 * has progress stored.
 */
export interface AchievementsProgressView {
	/**
	 * Current level derived from cumulative XP.
	 */
	level: number;
	/**
	 * Cumulative XP.
	 */
	xp: number;
	/**
	 * Number of achievements unlocked.
	 */
	achievementCount: number;
	/**
	 * On-chain progress object id, when one has been created.
	 */
	progressObjectId?: ObjectId;
}

/**
 * One unlock row on the authenticated wallet response.
 *
 * Field names match `MeUnlock` (`camelCase`) from the achievements service.
 */
export interface AchievementsMeUnlock {
	/**
	 * Identifier of the unlocked achievement.
	 */
	achievementId: string;
	/**
	 * Unix timestamp, in milliseconds, when the achievement unlocked.
	 */
	unlockedAtMs: Timestamp;
	/**
	 * Reward-points credit status for this unlock.
	 */
	pointsStatus: AchievementsPointsStatus;
	/**
	 * Mint status for this unlock.
	 */
	mintStatus: AchievementsMintStatus;
	/**
	 * Transaction digest of the mint, when one exists.
	 */
	mintDigest?: TransactionDigest;
	/**
	 * XP recorded for this unlock.
	 */
	xpAwarded: number;
	/**
	 * Reward points recorded for this unlock.
	 */
	pointsAwarded: number;
	/**
	 * Reported rarity as a percentage of holders (`0`–`100`).
	 */
	rarityPercent: number;
}

// =========================================================================
//  API
// =========================================================================

/**
 * Response from `GET /api/achievements/definitions`.
 */
export interface ApiAchievementsGetDefinitionsResponse {
	/**
	 * Achievement definitions returned by the API.
	 */
	definitions: AchievementsDefinitionView[];
}

/**
 * Request body for `POST /api/achievements/me`.
 *
 * Uses a pre-signed message (`bytes` + `signature`) for authentication, the
 * same shape as other signed Aftermath reads.
 */
export interface ApiAchievementsGetMeBody {
	/**
	 * Sui wallet address to load achievements for.
	 */
	walletAddress: SuiAddress;
	/**
	 * The message bytes (base64 encoded) that the wallet previously signed.
	 */
	bytes: string;
	/**
	 * The signature corresponding to `bytes`.
	 */
	signature: string;
}

/**
 * Response from `POST /api/achievements/me`.
 *
 * Field names match `MeResponse` (`camelCase`) from the achievements service.
 */
export interface ApiAchievementsGetMeResponse {
	/**
	 * Wallet address the response describes.
	 */
	walletAddress: SuiAddress;
	/**
	 * Cumulative progress. Absent when the wallet has no stored progress.
	 */
	progress?: AchievementsProgressView;
	/**
	 * Unlocks for the wallet. Empty when none exist.
	 */
	unlocks: AchievementsMeUnlock[];
}
