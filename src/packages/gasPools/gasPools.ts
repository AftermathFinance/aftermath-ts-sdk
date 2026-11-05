import type { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type {
	ApiTransactionResponse,
	CallerConfig,
	SdkTransactionResponse,
} from "../../types";
import type {
	ApiGasPoolBody,
	ApiGasPoolCreateBody,
	ApiGasPoolCreateResponse,
	ApiGasPoolDepositBody,
	ApiGasPoolGrantBody,
	ApiGasPoolHistoryBody,
	ApiGasPoolHistoryResponse,
	ApiGasPoolResponse,
	ApiGasPoolRevokeBody,
	ApiGasPoolShareBody,
	ApiGasPoolSponsorBody,
	ApiGasPoolSponsorResponse,
	ApiGasPoolSwapFundedBody,
	ApiGasPoolWithdrawBody,
	ApiGasPoolWithdrawResponse,
	ApiSponsorableTransactionResponse,
} from "./gasPoolsTypes";

/**
 * Caller for the versioned `/api/v1/gas-pool` routes. It shares the owning
 * `GasPools` configuration object, so access-token changes apply to both.
 */
class GasPoolsV1Caller extends Caller {
	constructor(config: CallerConfig) {
		super(config, "v1/gas-pool");
	}

	/**
	 * Posts `body` to a v1 gas-pool route and decodes the response.
	 *
	 * @param url - Path below `/api/v1/gas-pool`.
	 * @param body - JSON request body.
	 * @returns The decoded response.
	 */
	request<Output, Body>(url: string, body: Body): Promise<Output> {
		return this.fetchApi<Output, Body>(url, body);
	}

	/**
	 * Posts `body` to a v1 gas-pool route that returns a transaction.
	 *
	 * @param url - Path below `/api/v1/gas-pool`.
	 * @param body - JSON request body.
	 * @returns The parsed transaction plus the remaining response fields.
	 */
	requestTx<Body extends object>(url: string, body: Body) {
		return this.fetchApiTxObject<Body, ApiSponsorableTransactionResponse>(
			url,
			body
		);
	}
}

/**
 * The `GasPools` class provides methods for interacting with shared gas pool
 * endpoints on the Aftermath platform. This includes querying pool details
 * and building transactions for creating, depositing into, withdrawing from,
 * sponsoring, granting access to, and revoking access from gas pools.
 *
 * @example
 * ```typescript
 * const gasPools = new GasPools({ network: "MAINNET" });
 *
 * // Get gas pool details
 * const pool = await gasPools.getPool({
 *   walletAddress: "0x..."
 * });
 *
 * // Build a deposit transaction
 * const { tx } = await gasPools.getDepositTx({
 *   walletAddress: "0x...",
 *   depositAmount: 100_000_000n
 * });
 * ```
 */
export class GasPools extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a gas-pool facade.
	 *
	 * @param config - Optional caller configuration, such as the network and access token.
	 * @param api - Optional provider used to serialize transactions supplied to gas-pool endpoints.
	 */
	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "gas-pool");
		this.v1 = new GasPoolsV1Caller(this.config);
	}

	private readonly v1: GasPoolsV1Caller;

	// =========================================================================
	//  Pool
	// =========================================================================

	/**
	 * Fetches the gas pool details for a given wallet address.
	 *
	 * @param inputs - `ApiGasPoolBody` containing the wallet address.
	 * @returns `ApiGasPoolResponse` containing pool ID, balance, reserved
	 * sponsorships, and whitelisted addresses.
	 */
	public getPool(inputs: ApiGasPoolBody): Promise<ApiGasPoolResponse> {
		return this.v1.request<ApiGasPoolResponse, ApiGasPoolBody>("pool", inputs);
	}

	/**
	 * Returns the part of a pool's balance that can still pay for gas: the
	 * balance minus sponsorships handed out and not yet covered, never below zero.
	 *
	 * @param pool - Balance and reserved amounts from {@link getPool}.
	 * @returns Spendable balance in MIST.
	 */
	public static spendableBalance(
		pool: Pick<ApiGasPoolResponse, "balance" | "reserved">
	): bigint {
		return pool.balance > pool.reserved ? pool.balance - pool.reserved : 0n;
	}

	/**
	 * Fetches a page of a gas pool's balance movements (deposits, withdrawals,
	 * sponsored gas, rebates, and reclaims), newest first.
	 *
	 * @param inputs.gasPoolId - Gas-pool object ID.
	 * @param inputs.cursor - Cursor from a previous page. Omit for the newest page.
	 * @param inputs.limit - Maximum entries to return (service default 50, max 200).
	 * @returns `ApiGasPoolHistoryResponse` with the entries and the next cursor.
	 */
	public getHistory(
		inputs: ApiGasPoolHistoryBody
	): Promise<ApiGasPoolHistoryResponse> {
		return this.v1.request<ApiGasPoolHistoryResponse, ApiGasPoolHistoryBody>(
			"history",
			inputs
		);
	}

	// =========================================================================
	//  Swap-funded Transactions
	// =========================================================================

	/**
	 * Builds a sponsored transaction that swaps a coin into SUI, creates the
	 * wallet's gas pool, and funds it. The sponsor is repaid from the same
	 * deposit, so the wallet needs no SUI. The wallet signs the returned `tx` as
	 * the sender and submits it with `sponsorSignature`.
	 *
	 * @param inputs.walletAddress - Wallet the pool is created for.
	 * @param inputs.swap - Coin and amount routed into SUI.
	 * @param inputs.bytes - Base64 of the signed `Aftermath Terms and Conditions` message.
	 * @param inputs.signature - Signature over `bytes`.
	 * @returns The sponsor-signed `tx` plus `sponsorSignature` and `digest`.
	 */
	public getSwapFundedCreateTx(inputs: ApiGasPoolSwapFundedBody) {
		return this.v1.requestTx("transactions/create", inputs);
	}

	/**
	 * Builds a sponsored transaction that swaps a coin into SUI and deposits it
	 * into the wallet's existing gas pool. The sponsor is repaid from the same
	 * deposit, so the wallet needs no SUI. The wallet signs the returned `tx` as
	 * the sender and submits it with `sponsorSignature`.
	 *
	 * @param inputs.walletAddress - Wallet whose gas pool receives the deposit.
	 * @param inputs.swap - Coin and amount routed into SUI.
	 * @param inputs.bytes - Base64 of the signed `Aftermath Terms and Conditions` message.
	 * @param inputs.signature - Signature over `bytes`.
	 * @returns The sponsor-signed `tx` plus `sponsorSignature` and `digest`.
	 */
	public getSwapFundedDepositTx(inputs: ApiGasPoolSwapFundedBody) {
		return this.v1.requestTx("transactions/deposit", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds a transaction to create a new gas pool for the given wallet.
	 *
	 * When `deferShare` is `true`, the response includes `gasPoolArg` and
	 * `sharePolicyArg` so you can compose additional commands (e.g. deposit,
	 * grant) before calling {@link getShareTx} to finalize.
	 *
	 * @param inputs.walletAddress - Wallet address to create the gas pool for.
	 * @param inputs.initialDepositAmount - Optional initial deposit amount in MIST.
	 * @param inputs.deferShare - When true, returns args without sharing yet.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns `tx` plus optional `gasPoolArg` and `sharePolicyArg` when deferred.
	 */
	public async getCreateTx(
		inputs: Omit<ApiGasPoolCreateBody, "txKind"> & { tx?: Transaction }
	) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiGasPoolCreateBody,
			ApiGasPoolCreateResponse
		>(
			"transactions/create",
			{
				...otherInputs,
				txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Builds a transaction to deposit into the gas pool.
	 *
	 * Supports SUI and non-SUI deposits. For non-SUI deposits, the input coin
	 * is swapped into SUI via the Aftermath router before depositing.
	 *
	 * @param inputs.walletAddress - Wallet address submitting the deposit.
	 * @param inputs.isSponsoredTx - Whether to build the transaction for sponsored gas. Defaults to false.
	 * @param inputs.coinType - Coin type to deposit. Defaults to SUI.
	 * @param inputs.amount - Amount to deposit (required when sourcing from wallet or for non-SUI).
	 * @param inputs.coinArg - PTB coin argument to use as input (if omitted, sourced from wallet).
	 * @param inputs.slippage - Slippage tolerance for non-SUI swaps (defaults to 0.01).
	 * @param inputs.gasPoolArg - Optional gas pool argument from a previously-built PTB command.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns `SdkTransactionResponse` with `tx`.
	 */
	public async getDepositTx(
		inputs: Omit<ApiGasPoolDepositBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<ApiGasPoolDepositBody, ApiTransactionResponse>(
			"transactions/deposit",
			{
				...otherInputs,
				txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Builds a transaction to withdraw SUI from the gas pool.
	 *
	 * When `deferTransfer` is `true`, the withdrawn coin is not transferred.
	 * Instead, `withdrawnCoinArg` is returned for further PTB composition.
	 *
	 * @param inputs.walletAddress - Wallet address submitting the withdrawal.
	 * @param inputs.amount - Amount of SUI to withdraw in MIST.
	 * @param inputs.recipientAddress - Optional recipient (defaults to `walletAddress`).
	 * @param inputs.deferTransfer - When true, returns the withdrawn coin arg instead of transferring.
	 * @param inputs.gasPoolArg - Optional gas pool argument from a previously-built PTB command.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns `tx` plus optional `withdrawnCoinArg` when deferred.
	 */
	public async getWithdrawTx(
		inputs: Omit<ApiGasPoolWithdrawBody, "txKind"> & { tx?: Transaction }
	) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiGasPoolWithdrawBody,
			ApiGasPoolWithdrawResponse
		>(
			"transactions/withdraw",
			{
				...otherInputs,
				txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Requests a gas-pool-sponsored transaction. Returns a complete transaction
	 * with the gas payment and epoch bound attached, the sponsor's signature, and
	 * the digest both signatures commit to — the caller signs `transaction` as the
	 * sender and submits it together with `sponsorSignature`.
	 *
	 * @param inputs.walletAddress - Wallet address requesting the sponsorship.
	 * @param inputs.bytes - Base64 of the signed `SPONSOR_GAS` auth message.
	 * @param inputs.signature - Signature over `bytes`.
	 * @param inputs.tx - Optional transaction to sponsor (appended as a tx kind).
	 * @returns `ApiGasPoolSponsorResponse`.
	 */
	public async getSponsoredTransaction(
		inputs: Omit<ApiGasPoolSponsorBody, "txKind"> & { tx?: Transaction }
	): Promise<ApiGasPoolSponsorResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApi<ApiGasPoolSponsorResponse, ApiGasPoolSponsorBody>(
			"transactions/sponsor",
			{
				...otherInputs,
				txKind: tx
					? await this.api?.Transactions().fetchBase64TxKindFromTx({ tx })
					: undefined,
			}
		);
	}

	/**
	 * Builds a transaction to grant another wallet access to the gas pool.
	 *
	 * @param inputs.walletAddress - Owner wallet address.
	 * @param inputs.targetWalletAddress - Wallet address to grant access to.
	 * @param inputs.gasPoolArg - Optional gas pool argument from a previously-built PTB command.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns `SdkTransactionResponse` with `tx`.
	 */
	public async getGrantTx(
		inputs: Omit<ApiGasPoolGrantBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<ApiGasPoolGrantBody, ApiTransactionResponse>(
			"transactions/grant",
			{
				...otherInputs,
				txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Builds a transaction to revoke another wallet's access to the gas pool.
	 *
	 * @param inputs.walletAddress - Owner wallet address.
	 * @param inputs.targetWalletAddress - Wallet address to revoke access from.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns `SdkTransactionResponse` with `tx`.
	 */
	public async getRevokeTx(
		inputs: Omit<ApiGasPoolRevokeBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<ApiGasPoolRevokeBody, ApiTransactionResponse>(
			"transactions/revoke",
			{
				...otherInputs,
				txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Builds a transaction to share a gas pool that was created with `deferShare: true`.
	 *
	 * Use this after composing additional commands (deposit, grant, etc.) with
	 * the `gasPoolArg` returned by {@link getCreateTx}.
	 *
	 * @param inputs.gasPoolArg - Gas pool argument from a deferred create.
	 * @param inputs.sharePolicyArg - Share policy argument from a deferred create.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns `SdkTransactionResponse` with `tx`.
	 */
	public async getShareTx(
		inputs: Omit<ApiGasPoolShareBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<ApiGasPoolShareBody, ApiTransactionResponse>(
			"transactions/share",
			{
				...otherInputs,
				txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({ tx }),
			},
			undefined,
			{ txKind: true }
		);
	}
}
