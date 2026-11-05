import type { ObjectId, SuiAddress } from "../../general/types/generalTypes";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig } from "../../types";
import type { ApiSponsorableTransactionResponse } from "../gasPools/gasPoolsTypes";
import type {
	ApiOneClickTradingGrantBody,
	ApiOneClickTradingGrantPreviewBody,
	ApiOneClickTradingRevokeBody,
	ApiOneClickTradingWalletsBody,
	OneClickTradingGrantPreview,
	OneClickTradingGrants,
	OneClickTradingRevokedWallet,
	OneClickTradingRevokePreview,
	OneClickTradingWallet,
	OneClickTradingWalletsResponse,
} from "./oneClickTradingTypes";

interface WireGrants {
	accountIds: (string | bigint)[];
	vaultIds: ObjectId[];
}

interface WireWallet {
	address: SuiAddress;
	grants: WireGrants;
}

interface WireRevokedWallet extends WireWallet {
	deauthorize: boolean;
}

type WireGrantPreview = Omit<OneClickTradingGrantPreview, "revoked"> & {
	revoked: WireRevokedWallet[];
};

const toGrants = (grants: WireGrants): OneClickTradingGrants => ({
	accountIds: grants.accountIds.map((id) => BigInt(id)),
	vaultIds: grants.vaultIds,
});

const toWallet = (wallet: WireWallet): OneClickTradingWallet => ({
	address: wallet.address,
	grants: toGrants(wallet.grants),
});

const toRevokedWallet = (
	wallet: WireRevokedWallet
): OneClickTradingRevokedWallet => ({
	...toWallet(wallet),
	deauthorize: wallet.deauthorize,
});

/**
 * The `OneClickTrading` class manages the wallets that trade perpetuals on a
 * primary wallet's behalf. One call grants a browser-held wallet an assistant
 * cap on every account and vault the primary owns and whitelists it on the
 * primary's gas pool, creating the pool when needed.
 *
 * @example
 * ```typescript
 * const oneClickTrading = afSdk.OneClickTrading();
 *
 * const preview = await oneClickTrading.getGrantPreview({
 *   walletAddress: "0x...",
 *   ephemeralAddress: "0x...",
 * });
 *
 * if (!preview.blocker) {
 *   const { tx } = await oneClickTrading.getGrantTx({
 *     walletAddress: "0x...",
 *     ephemeralAddress: "0x...",
 *   });
 * }
 * ```
 */
export class OneClickTrading extends Caller {
	/**
	 * Creates a one-click-trading facade.
	 *
	 * @param config - Optional caller configuration, such as the network and access token.
	 */
	constructor(config?: CallerConfig) {
		super(config, "v1/perpetuals/one-click-trading");
	}

	// =========================================================================
	//  Reads
	// =========================================================================

	/**
	 * Lists the wallets that trade on a primary wallet's behalf.
	 *
	 * @param inputs.walletAddress - Primary wallet.
	 * @returns Delegated wallets with the accounts and vaults each one reaches.
	 */
	public async getWallets(
		inputs: ApiOneClickTradingWalletsBody
	): Promise<OneClickTradingWalletsResponse> {
		const response = await this.fetchApi<
			{ wallets: WireWallet[] },
			ApiOneClickTradingWalletsBody
		>("wallets", inputs);
		return { wallets: response.wallets.map(toWallet) };
	}

	/**
	 * Describes what enabling one-click trading for a wallet would do, including
	 * the reason it cannot be built, if any.
	 *
	 * @param inputs.walletAddress - Primary wallet.
	 * @param inputs.ephemeralAddress - Browser-held wallet to enable.
	 * @param inputs.revoke - Wallets to strip first, freeing slots.
	 * @returns `OneClickTradingGrantPreview`.
	 */
	public async getGrantPreview(
		inputs: ApiOneClickTradingGrantPreviewBody
	): Promise<OneClickTradingGrantPreview> {
		const response = await this.fetchApi<
			WireGrantPreview,
			ApiOneClickTradingGrantPreviewBody
		>("previews/grant", inputs);
		return { ...response, revoked: response.revoked.map(toRevokedWallet) };
	}

	/**
	 * Describes what withdrawing one-click trading from the named wallets would do.
	 *
	 * @param inputs.walletAddress - Primary wallet.
	 * @param inputs.addresses - Wallets to strip.
	 * @returns One entry per requested address, in the order given.
	 */
	public async getRevokePreview(
		inputs: ApiOneClickTradingRevokeBody
	): Promise<OneClickTradingRevokePreview> {
		const response = await this.fetchApi<
			{ wallets: WireRevokedWallet[] },
			ApiOneClickTradingRevokeBody
		>("previews/revoke", inputs);
		return { wallets: response.wallets.map(toRevokedWallet) };
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds a transaction enabling a wallet to trade on the primary's behalf:
	 * it strips the wallets in `revoke`, grants the ephemeral wallet an
	 * assistant cap on every account and vault, and whitelists it on the gas
	 * pool, creating the pool when needed.
	 *
	 * With `swap`, `bytes`, and `signature`, the service funds the gas pool from
	 * the swap and sponsors the transaction; `tx` is then a whole sponsor-signed
	 * transaction to submit with `sponsorSignature`. Otherwise `tx` is a
	 * transaction kind the wallet pays gas for.
	 *
	 * @param inputs.walletAddress - Primary wallet, and the signer.
	 * @param inputs.ephemeralAddress - Browser-held wallet to enable.
	 * @param inputs.revoke - Wallets to strip first. Must not contain `ephemeralAddress`.
	 * @param inputs.amount - Optional SUI, in MIST, deposited into the gas pool.
	 * @param inputs.swap - Optional coin routed into SUI for the gas pool.
	 * @param inputs.bytes - Base64 of the signed `Aftermath Terms and Conditions` message.
	 * @param inputs.signature - Signature over `bytes`.
	 * @returns `tx` plus `sponsorSignature` and `digest` when sponsored.
	 */
	public getGrantTx(inputs: ApiOneClickTradingGrantBody) {
		return this.fetchApiTxObject<
			ApiOneClickTradingGrantBody,
			ApiSponsorableTransactionResponse
		>("transactions/grant", inputs);
	}

	/**
	 * Builds a transaction disabling one-click trading on the named wallets: it
	 * removes their assistant caps from every account and vault and takes them
	 * off the gas pool whitelist.
	 *
	 * @param inputs.walletAddress - Primary wallet, and the signer.
	 * @param inputs.addresses - Wallets to strip.
	 * @returns `tx` as a transaction kind.
	 */
	public getRevokeTx(inputs: ApiOneClickTradingRevokeBody) {
		return this.fetchApiTxObject<
			ApiOneClickTradingRevokeBody,
			ApiSponsorableTransactionResponse
		>("transactions/revoke", inputs);
	}
}
