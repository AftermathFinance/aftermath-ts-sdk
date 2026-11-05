import type { ObjectId, SuiAddress } from "../../general/types/generalTypes";
import type { ApiGasPoolSwapFunding } from "../gasPools/gasPoolsTypes";
import type { PerpetualsAccountId } from "../perpetuals/perpetualsTypes";

// =========================================================================
//  Grants
// =========================================================================

/**
 * Entities a delegated wallet holds assistant caps for.
 */
export interface OneClickTradingGrants {
	/** Perpetuals account IDs. */
	accountIds: PerpetualsAccountId[];
	/** Vault object IDs. */
	vaultIds: ObjectId[];
}

/**
 * A wallet that trades on the primary wallet's behalf, with what it can reach.
 */
export interface OneClickTradingWallet {
	/** Delegated wallet address. */
	address: SuiAddress;
	/** Entities the wallet holds assistant caps for. */
	grants: OneClickTradingGrants;
}

/**
 * A delegated wallet that a grant or revoke would strip.
 */
export interface OneClickTradingRevokedWallet extends OneClickTradingWallet {
	/** `true` when the wallet sits in the gas pool whitelist and would be removed from it. */
	deauthorize: boolean;
}

// =========================================================================
//  Wallets
// =========================================================================

/**
 * Inputs for listing the wallets that trade on a primary wallet's behalf.
 */
export interface ApiOneClickTradingWalletsBody {
	/** Primary wallet whose delegated wallets to list. */
	walletAddress: SuiAddress;
}

/**
 * Wallets enabled for one-click trading on a primary wallet.
 */
export interface OneClickTradingWalletsResponse {
	/** Delegated wallets and their grants. */
	wallets: OneClickTradingWallet[];
}

// =========================================================================
//  Grant
// =========================================================================

/**
 * Why a one-click-trading grant cannot be built.
 *
 * - `oct_already_enabled`: the wallet already holds every cap.
 * - `oct_no_entities`: the primary wallet has no account or vault to grant.
 * - `oct_limit_reached`: an entity has no free assistant slot.
 * - `oct_whitelist_full`: the gas pool whitelist has no free place.
 */
export type OneClickTradingGrantBlocker =
	| "oct_already_enabled"
	| "oct_no_entities"
	| "oct_limit_reached"
	| "oct_whitelist_full";

/**
 * Inputs for previewing a one-click-trading grant.
 */
export interface ApiOneClickTradingGrantPreviewBody {
	/** Primary wallet: it owns the accounts, vaults, and gas pool, and signs. */
	walletAddress: SuiAddress;
	/** Browser-held wallet that would trade on the primary's behalf. */
	ephemeralAddress: SuiAddress;
	/** Wallets the grant would strip first, freeing assistant slots and whitelist places. */
	revoke?: SuiAddress[];
}

/**
 * An entity that a grant would give an assistant cap on.
 */
export interface OneClickTradingGrantedEntity {
	/** Where the entity lives. */
	domain: "account" | "vault";
	/** Account ID or vault object ID. */
	entityId: string;
	/** Assistants on the entity once the transaction lands. */
	assistantCount: number;
	/** On-chain assistant ceiling for the entity. */
	maxAssistants: number;
}

/**
 * What a grant would do to the primary wallet's gas pool.
 */
export interface OneClickTradingGasPoolEffect {
	/** `true` when the pool does not exist yet and would be created. */
	created: boolean;
	/** `true` when the wallet is not whitelisted yet and would be authorized. */
	authorize: boolean;
	/** Whitelisted addresses once the transaction lands. */
	whitelistedAddressCount: number;
	/** On-chain whitelist ceiling. */
	maxWhitelistedAddresses: number;
}

/**
 * What enabling one-click trading for a wallet would do.
 */
export interface OneClickTradingGrantPreview {
	/** Why the grant cannot be built, or `undefined` when it can. */
	blocker?: OneClickTradingGrantBlocker;
	/** Entities that would receive an assistant cap. Empty when the wallet already holds every cap. */
	granted: OneClickTradingGrantedEntity[];
	/** Wallets that would be stripped first, one per address in `revoke`. */
	revoked: OneClickTradingRevokedWallet[];
	/** What the grant would do to the gas pool. */
	gasPool: OneClickTradingGasPoolEffect;
}

/**
 * Inputs for building a one-click-trading grant.
 *
 * With `swap` (plus `bytes` and `signature`) the service routes the coin into
 * SUI for the gas pool and sponsors the transaction, so the wallet needs no SUI.
 */
export interface ApiOneClickTradingGrantBody
	extends ApiOneClickTradingGrantPreviewBody {
	/** Optional SUI amount, in MIST, deposited into the gas pool from the wallet. */
	amount?: bigint;
	/** Optional coin routed into SUI to fund the gas pool. */
	swap?: ApiGasPoolSwapFunding;
	/** Base64 of the personal message `Aftermath Terms and Conditions` signed by `walletAddress`. */
	bytes?: string;
	/** `walletAddress`'s signature over `bytes`. */
	signature?: string;
}

// =========================================================================
//  Revoke
// =========================================================================

/**
 * Inputs for previewing or building a one-click-trading revoke.
 */
export interface ApiOneClickTradingRevokeBody {
	/** Primary wallet: it owns the entities and the gas pool, and signs. */
	walletAddress: SuiAddress;
	/** Wallets to strip. The service never picks them. */
	addresses: SuiAddress[];
}

/**
 * What withdrawing one-click trading from the named wallets would do.
 */
export interface OneClickTradingRevokePreview {
	/** One entry per requested address, in the order given. */
	wallets: OneClickTradingRevokedWallet[];
}
