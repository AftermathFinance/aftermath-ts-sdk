import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	ApiTransactionResponse,
	CallerConfig,
	SdkTransactionResponse,
	SuiAddress,
} from "../../types";
import type {
	ApiGasPoolBody,
	ApiGasPoolCreateBody,
	ApiGasPoolCreateResponse,
	ApiGasPoolDepositBody,
	ApiGasPoolGrantBody,
	ApiGasPoolResponse,
	ApiGasPoolRevokeBody,
	ApiGasPoolShareBody,
	ApiGasPoolSponsorBody,
	ApiGasPoolWithdrawBody,
	ApiGasPoolWithdrawResponse,
} from "./gasPoolsTypes";

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

	constructor(
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "gas-pool");
	}

	// =========================================================================
	//  Pool
	// =========================================================================

	/**
	 * Fetches the gas pool details for a given wallet address.
	 *
	 * @param inputs - {@link ApiGasPoolBody}
	 * @returns {@link ApiGasPoolResponse} containing pool ID, balance, and whitelisted addresses.
	 */
	public async getPool(inputs: ApiGasPoolBody): Promise<ApiGasPoolResponse> {
		return this.fetchApi<ApiGasPoolResponse, ApiGasPoolBody>(
			"pool",
			inputs
		);
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
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
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
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getDepositTx(
		inputs: Omit<ApiGasPoolDepositBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiGasPoolDepositBody,
			ApiTransactionResponse
		>(
			"transactions/deposit",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
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
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Builds a transaction to sponsor (rebate) the transaction sender
	 * using SUI from the gas pool.
	 *
	 * @param inputs.walletAddress - Wallet address submitting the sponsor transaction.
	 * @param inputs.amount - Amount of SUI to rebate in MIST.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getSponsorTx(
		inputs: Omit<ApiGasPoolSponsorBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiGasPoolSponsorBody,
			ApiTransactionResponse
		>(
			"transactions/sponsor",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Builds a transaction to grant another wallet access to the gas pool.
	 *
	 * @param inputs.walletAddress - Owner wallet address.
	 * @param inputs.targetWalletAddress - Wallet address to grant access to.
	 * @param inputs.gasPoolArg - Optional gas pool argument from a previously-built PTB command.
	 * @param inputs.tx - Optional transaction to extend.
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getGrantTx(
		inputs: Omit<ApiGasPoolGrantBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiGasPoolGrantBody,
			ApiTransactionResponse
		>(
			"transactions/grant",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
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
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getRevokeTx(
		inputs: Omit<ApiGasPoolRevokeBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiGasPoolRevokeBody,
			ApiTransactionResponse
		>(
			"transactions/revoke",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
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
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getShareTx(
		inputs: Omit<ApiGasPoolShareBody, "txKind"> & { tx?: Transaction }
	): Promise<SdkTransactionResponse> {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiGasPoolShareBody,
			ApiTransactionResponse
		>(
			"transactions/share",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{ txKind: true }
		);
	}
}
