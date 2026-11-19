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
 * Status of the allowlist qualify step for one unlock.
 *
 * Wire values match the service `QualifyStatus` enum (`snake_case`). This is
 * independent of `AchievementsMintStatus`. Older `/me` payloads may omit it.
 */
export type AchievementsQualifyStatus =
	| "pending"
	| "skipped"
	| "dry_run"
	| "qualified"
	| "qualify_failed";

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
	 *
	 * The service serializes this from a u64 JSON number. Current catalog
	 * values are below `Number.MAX_SAFE_INTEGER`. Switch to bigint or a
	 * decimal string only if a threshold can exceed the safe integer range.
	 */
	xpReward: number;
	/**
	 * Reward points granted when the achievement unlocks.
	 *
	 * The service serializes this from a u64 JSON number. Current catalog
	 * values are below `Number.MAX_SAFE_INTEGER`. Switch to bigint or a
	 * decimal string only if a threshold can exceed the safe integer range.
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
	 *
	 * The service serializes this from a u64 JSON number. Current catalog
	 * values are below `Number.MAX_SAFE_INTEGER`. Switch to bigint or a
	 * decimal string only if a threshold can exceed the safe integer range.
	 */
	thresholdUsd?: number;
	/**
	 * Optional count threshold. Absent when this definition is not count-based.
	 *
	 * The service serializes this from a u64 JSON number. Current catalog
	 * values are below `Number.MAX_SAFE_INTEGER`. Switch to bigint or a
	 * decimal string only if a threshold can exceed the safe integer range.
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
	 *
	 * The service serializes this from a u64 JSON number. Current catalog
	 * values are below `Number.MAX_SAFE_INTEGER`. Switch to bigint or a
	 * decimal string only if a threshold can exceed the safe integer range.
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
	 * Allowlist qualify outcome for this unlock.
	 *
	 * Absent on older `/me` payloads.
	 */
	qualifyStatus?: AchievementsQualifyStatus;
	/**
	 * Transaction digest of the qualify step, when one exists.
	 */
	qualifyDigest?: TransactionDigest;
	/**
	 * XP recorded for this unlock.
	 *
	 * The service serializes this from a u64 JSON number. Current catalog
	 * values are below `Number.MAX_SAFE_INTEGER`. Switch to bigint or a
	 * decimal string only if a threshold can exceed the safe integer range.
	 */
	xpAwarded: number;
	/**
	 * Reward points recorded for this unlock.
	 *
	 * The service serializes this from a u64 JSON number. Current catalog
	 * values are below `Number.MAX_SAFE_INTEGER`. Switch to bigint or a
	 * decimal string only if a threshold can exceed the safe integer range.
	 */
	pointsAwarded: number;
	/**
	 * Holder-relative percent from the service
	 * (`unlock_count / max(1, level_nft_holders) * 100`). The value may be
	 * fractional and may exceed 100 when unlocks outnumber holders.
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
 * af-fe accepts only a personal-message signature over the fixed string
 * `Aftermath Terms and Conditions` (see `UserData.termsAndConditionsMessage`).
 * That is the same session credential used by rewards and user data. `bytes`
 * must be that message's UTF-8 bytes, base64-encoded, with a matching
 * `signature` for `walletAddress`.
 *
 * This is the existing session credential. The signed text has no expiry,
 * action, or resource. Redesign of the credential is out of scope for this
 * stub.
 */
export interface ApiAchievementsGetMeBody {
	/**
	 * Sui wallet address to load achievements for. The signature must be from
	 * this wallet.
	 */
	walletAddress: SuiAddress;
	/**
	 * Base64-encoded UTF-8 bytes of the fixed personal message
	 * `Aftermath Terms and Conditions`. af-fe accepts only that message (the
	 * same session credential as rewards and user data) and requires a
	 * matching `signature` for `walletAddress`.
	 */
	bytes: string;
	/**
	 * The signature over `bytes` from `walletAddress`.
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

/**
 * Request body for `POST /api/achievements/claim`.
 *
 * af-fe accepts only a personal-message signature over the fixed string
 * `Aftermath Terms and Conditions` (see `UserData.termsAndConditionsMessage`).
 * That is the same session credential used by rewards, user data, and
 * `getMe`. `bytes` must be that message's UTF-8 bytes, base64-encoded, with
 * a matching `signature` for `walletAddress`.
 *
 * This request asks for an unsigned claim intent. It does not mint, sign, or
 * submit a transaction.
 */
export interface ApiAchievementsClaimBody {
	/**
	 * Sui wallet address claiming the achievement. The signature must be from
	 * this wallet.
	 */
	walletAddress: SuiAddress;
	/**
	 * Base64-encoded UTF-8 bytes of the fixed personal message
	 * `Aftermath Terms and Conditions`. af-fe accepts only that message (the
	 * same session credential as rewards, user data, and `getMe`) and requires
	 * a matching `signature` for `walletAddress`.
	 */
	bytes: string;
	/**
	 * The signature over `bytes` from `walletAddress`.
	 */
	signature: string;
	/**
	 * Catalog id of the unlocked achievement to claim.
	 */
	achievementId: string;
	/**
	 * On-chain progress object, when the wallet already has one. Omit or pass
	 * `null` when it does not.
	 */
	progressObjectId?: ObjectId | null;
}

/**
 * Unsigned user-pays claim payload.
 *
 * Field names match `ClaimIntentView` (`camelCase`) from the achievements
 * service. The caller builds, signs, and pays for the transaction. JSON
 * `null` on `progressObjectId` is decoded as `undefined` (field omitted).
 */
export interface AchievementsClaimIntentView {
	/**
	 * Move function name. Claim assist uses `claim_achievement`.
	 */
	function: string;
	/**
	 * Achievements package id the caller should invoke.
	 */
	packageId: string;
	/**
	 * On-chain achievements registry object id.
	 */
	registryId: string;
	/**
	 * Claim allowlist object id the function reads.
	 */
	claimAllowlistId: string;
	/**
	 * Catalog id of the achievement to claim.
	 */
	achievementId: string;
	/**
	 * On-chain progress object id, when the wallet already has one.
	 */
	progressObjectId?: ObjectId;
	/**
	 * Whether the caller must transfer the returned progress object to the
	 * sender in the same transaction.
	 */
	transferProgress: boolean;
}

/**
 * Response from `POST /api/achievements/claim`.
 *
 * Field names match `ClaimAssistResponse` (`camelCase`) from the achievements
 * service. `intent` is unsigned. The caller signs and pays gas.
 */
export interface ApiAchievementsClaimResponse {
	/**
	 * Wallet address the intent is for.
	 */
	walletAddress: SuiAddress;
	/**
	 * Catalog id of the achievement to claim.
	 */
	achievementId: string;
	/**
	 * Unsigned Move call the caller signs and pays for.
	 */
	intent: AchievementsClaimIntentView;
	/**
	 * Service notes for the caller, including how to finish the transaction.
	 */
	notes: string;
}
