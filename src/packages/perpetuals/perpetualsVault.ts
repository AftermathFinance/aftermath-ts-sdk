import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsVaultOwnerUpdateForceWithdrawDelayTxBody,
	ApiPerpetualsVaultOwnerUpdateLockPeriodTxBody,
	ApiPerpetualsVaultProcessForceWithdrawRequestTxBody,
	ApiPerpetualsVaultOwnerProcessWithdrawRequestsTxBody,
	Balance,
	CallerConfig,
	PerpetualsMarketId,
	PerpetualsVaultObject,
	SuiAddress,
	ApiPerpetualsVaultOwnerUpdatePerformanceFeeTxBody,
	ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxResponse,
	ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxBody,
	PerpetualsVaultWithdrawRequest,
	ApiPerpetualsVaultsWithdrawRequestsBody,
	ApiPerpetualsVaultOwnedWithdrawRequestsBody,
	ApiPerpetualsVaultCreateWithdrawRequestTxBody,
	ApiPerpetualsVaultCancelWithdrawRequestTxBody,
	ApiPerpetualsVaultDepositTxBody,
	ApiPerpetualsVaultUpdateWithdrawRequestSlippageTxBody,
	ApiPerpetualsVaultPreviewCreateWithdrawRequestBody,
	ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse,
	ApiPerpetualsVaultPreviewDepositResponse,
	ApiPerpetualsVaultPreviewDepositBody,
	ApiPerpetualsVaultPreviewProcessForceWithdrawRequestResponse,
	ApiPerpetualsVaultPreviewProcessForceWithdrawRequestBody,
	ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsResponse,
	ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsBody,
	ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesResponse,
	ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesBody,
	PerpetualsVaultCap,
	ApiTransactionResponse,
	ObjectId,
	PerpetualsPartialVaultCap,
	ApiPerpetualsVaultPreviewOwnerWithdrawCollateralResponse,
	ApiPerpetualsVaultPreviewOwnerWithdrawCollateralBody,
	ApiPerpetualsVaultOwnerWithdrawCollateralTxBody,
	ApiPerpetualsVaultsWithdrawRequestsResponse,
	ApiPerpetualsVaultOwnerWithdrawCollateralTxResponse,
	ApiPerpetualsVaultProcessForceWithdrawRequestTxResponse,
	PerpetualsAccountObject,
	ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestBody,
	ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestResponse,
	ApiPerpetualsVaultPauseVaultForForceWithdrawRequestTxBody,
} from "../../types";
import { PerpetualsAccount } from "./perpetualsAccount";
import { Perpetuals } from "./perpetuals";

/**
 * High-level wrapper around a single Perpetuals vault.
 *
 * A vault is a managed perpetuals account that accepts user deposits (LP),
 * trades across up to a bounded set of markets, and supports withdrawals via
 * a request flow.
 *
 * This class provides:
 *
 * - Transaction builders for:
 *   - User actions (deposit, create/cancel withdraw request, update slippage)
 *   - Force-withdraw processing (close positions and settle a request)
 *   - Owner admin actions (update params, process requests, withdraw fees/collateral)
 * - Read helpers for:
 *   - Vault withdraw requests
 *   - LP token pricing
 *   - Accessing the vault’s underlying perpetuals account
 * - Static validation helpers for LP coin metadata (name/symbol constraints)
 * - A small calculation helper for withdraw-request slippage
 *
 * Typical usage:
 *
 * ```ts
 * const perps = afSdk.Perpetuals();
 * const { vaults } = await perps.getAllVaults();
 * const vault = vaults[0];
 *
 * const { tx } = await vault.getDepositTx({
 *   walletAddress: "0x...",
 *   depositAmount: BigInt("1000000000"),
 *   minLpAmountOut: 0n,
 * });
 * ```
 */
export class PerpetualsVault extends Caller {
	// =========================================================================
	//  Public Constants
	// =========================================================================

	/**
	 * Vault-level protocol limits and UI-friendly constraints.
	 *
	 * @remarks
	 * These are SDK constants (not fetched from chain). They should match the
	 * on-chain / backend limits enforced by the vault module.
	 */
	public static readonly constants = {
		/**
		 * Maximum lock period in milliseconds.
		 */
		maxLockPeriodMs: 5184000000, // 2 months

		/**
		 * Maximum period for force withdraw delay in milliseconds.
		 */
		maxForceWithdrawDelayMs: 86400000, // 1 day

		/**
		 * Maximum vault fee (performance fee).
		 */
		maxPerformanceFeePercentage: 0.2, // 20%

		/**
		 * Minimum USD value required for user deposits.
		 */
		minDepositUsd: 1,

		/**
		 * Minimum USD value required to be locked by vault owner during vault creation.
		 */
		minOwnerLockUsd: 1,

		/**
		 * The maximum number of distinct markets (`ClearingHouse`s) the vault can trade.
		 */
		maxMarketsInVault: 12,

		/**
		 * The maximum number of pending orders allowed for a single position in the vault.
		 */
		maxPendingOrdersPerPosition: 70,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Create a new {@link PerpetualsVault} wrapper.
	 *
	 * @param vaultObject - Raw on-chain vault object snapshot.
	 * @param config - Optional {@link CallerConfig} (network, auth, base URL).
	 * @param Provider - Optional shared {@link AftermathApi} provider. When provided,
	 *   transaction builders will serialize {@link Transaction}s into `txKind`.
	 */
	constructor(
		public readonly vaultObject: PerpetualsVaultObject,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals");
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Withdraw Request Txs
	// =========================================================================

	/**
	 * Build a `process-force-withdraw-request` transaction.
	 *
	 * Force-withdraw is a mechanism that closes required positions and processes
	 * a withdraw request after a delay window (see vault params).
	 *
	 * @param inputs.walletAddress - User wallet that owns the withdraw request.
	 * @param inputs.sizesToClose - Mapping of marketId -> size (base units) to close.
	 * @param inputs.recipientAddress - Optional recipient of the withdrawn collateral.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx` (and any additional outputs
	 *   provided by the backend response type).
	 */
	public async getProcessForceWithdrawRequestTx(inputs: {
		walletAddress: SuiAddress;
		// TODO: change to arr ?
		sizesToClose: Record<PerpetualsMarketId, Balance>;
		recipientAddress?: SuiAddress;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultProcessForceWithdrawRequestTxBody,
			ApiPerpetualsVaultProcessForceWithdrawRequestTxResponse
		>(
			"vault/transactions/process-force-withdraw-request",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	// TODO: docs
	public async getPauseVaultForForceWithdrawRequestTx(inputs: {
		tx?: Transaction;
	}) {
		const { tx } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultPauseVaultForForceWithdrawRequestTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/pause-vault-for-force-withdraw-request",
			{
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Build an `update-withdraw-request-slippage` transaction.
	 *
	 * This updates the user's minimum acceptable collateral output amount
	 * for an existing withdraw request.
	 *
	 * @param inputs.minCollateralAmountOut - New minimum collateral amount out.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getUpdateWithdrawRequestSlippageTx(inputs: {
		minCollateralAmountOut: Balance;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultUpdateWithdrawRequestSlippageTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/update-withdraw-request-slippage",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	// =========================================================================
	//  Owner Settings Txs
	// =========================================================================

	/**
	 * Build an owner transaction to update the vault's force withdraw delay.
	 *
	 * @param inputs.forceWithdrawDelayMs - New delay (ms). Should be <= {@link constants.maxForceWithdrawDelayMs}.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getOwnerUpdateForceWithdrawDelayTx(inputs: {
		forceWithdrawDelayMs: bigint;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultOwnerUpdateForceWithdrawDelayTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/owner/update-force-withdraw-delay",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Build an owner transaction to update the vault's lock period.
	 *
	 * @param inputs.lockPeriodMs - New lock period (ms). Should be <= {@link constants.maxLockPeriodMs}.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getOwnerUpdateLockPeriodTx(inputs: {
		lockPeriodMs: bigint;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultOwnerUpdateLockPeriodTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/owner/update-lock-period",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Build an owner transaction to update the vault performance fee.
	 *
	 * @param inputs.performanceFeePercentage - New fee as a fraction (e.g. `0.2` = 20%).
	 *   Should be <= {@link constants.maxPerformanceFeePercentage}.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getOwnerUpdatePerformanceFeeTx(inputs: {
		performanceFeePercentage: number;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultOwnerUpdatePerformanceFeeTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/owner/update-performance-fee",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	// =========================================================================
	//  Owner Interactions Txs
	// =========================================================================

	/**
	 * Build an owner transaction to process one or more users' withdraw requests.
	 *
	 * This is the normal (non-force) processing path for withdrawals. The owner
	 * batches users and settles their requests in a single transaction.
	 *
	 * @param inputs.userAddresses - Users whose requests should be processed.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getOwnerProcessWithdrawRequestsTx(inputs: {
		userAddresses: SuiAddress[];
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultOwnerProcessWithdrawRequestsTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/owner/process-withdraw-requests",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Build an owner transaction to withdraw accrued performance fees.
	 *
	 * @param inputs.withdrawAmount - Amount of collateral to withdraw as fees.
	 * @param inputs.recipientAddress - Optional recipient address for the withdrawn fees.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Response containing `tx` and any extra outputs described by
	 * {@link ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxResponse}.
	 */
	public async getOwnerWithdrawPerformanceFeesTx(inputs: {
		withdrawAmount: Balance;
		recipientAddress?: SuiAddress;
		tx?: Transaction;
	}) {
		const { tx: txFromInputs, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxBody,
			ApiPerpetualsVaultOwnerWithdrawPerformanceFeesTxResponse
		>(
			"vault/transactions/owner/withdraw-performance-fees",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: txFromInputs ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Build an owner transaction to withdraw vault collateral by redeeming LP.
	 *
	 * @param inputs.lpWithdrawAmount - Amount of LP to redeem.
	 * @param inputs.minCollateralAmountOut - Minimum collateral out to protect from slippage.
	 * @param inputs.recipientAddress - Optional recipient address for withdrawn collateral.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Response containing `tx` and any extra outputs described by
	 * {@link ApiPerpetualsVaultOwnerWithdrawCollateralTxResponse}.
	 */
	public async getOwnerWithdrawCollateralTx(inputs: {
		lpWithdrawAmount: Balance;
		minCollateralAmountOut: Balance;
		recipientAddress?: SuiAddress;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultOwnerWithdrawCollateralTxBody,
			ApiPerpetualsVaultOwnerWithdrawCollateralTxResponse
		>(
			"vault/transactions/owner/withdraw-collateral",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	// =========================================================================
	//  User Interactions Txs
	// =========================================================================

	/**
	 * Build a user transaction to create a vault withdraw request.
	 *
	 * Withdrawals are request-based: the user specifies how much LP to redeem
	 * and a minimum collateral output amount.
	 *
	 * @param inputs.walletAddress - Wallet creating the request.
	 * @param inputs.lpWithdrawAmount - Amount of LP to withdraw.
	 * @param inputs.minCollateralAmountOut - Minimum collateral out (slippage guard).
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getCreateWithdrawRequestTx(inputs: {
		walletAddress: SuiAddress;
		lpWithdrawAmount: Balance;
		minCollateralAmountOut: Balance;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultCreateWithdrawRequestTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/create-withdraw-request",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Build a user transaction to cancel an existing vault withdraw request.
	 *
	 * @param inputs.walletAddress - Wallet canceling the request.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getCancelWithdrawRequestTx(inputs: {
		walletAddress: SuiAddress;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultCancelWithdrawRequestTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/cancel-withdraw-request",
			{
				...otherInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	/**
	 * Build a user transaction to deposit collateral into the vault in exchange for LP.
	 *
	 * You can specify the deposit as:
	 * - `depositAmount` (wallet pays directly), OR
	 * - `depositCoinArg` (use an existing transaction argument)
	 *
	 * @param inputs.walletAddress - Depositor wallet.
	 * @param inputs.minLpAmountOut - Minimum LP out (slippage guard).
	 * @param inputs.isSponsoredTx - Whether the tx is sponsored (gas paid by another party).
	 * @param inputs.depositAmount - Amount of collateral to deposit (mutually exclusive with `depositCoinArg`).
	 * @param inputs.depositCoinArg - Transaction argument referencing collateral coin.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 *
	 * @example
	 * ```ts
	 * const { txKind } = await vault.getDepositTx({
	 *   walletAddress: "0x...",
	 *   depositAmount: 1_000_000_000n,
	 *   minLpAmountOut: 0n,
	 * });
	 * ```
	 */
	// TODO: make return lp coin out ?
	public async getDepositTx(
		inputs: {
			walletAddress: SuiAddress;
			minLpAmountOut: Balance;
			tx?: Transaction;
			isSponsoredTx?: boolean;
		} & (
			| { depositAmount: Balance }
			| { depositCoinArg: TransactionObjectArgument }
		)
	) {
		const { tx, ...otherInputs } = inputs;

		const depositInputs =
			"depositAmount" in otherInputs
				? {
						depositAmount: otherInputs.depositAmount,
						collateralCoinType: this.vaultObject.collateralCoinType,
				  }
				: { depositCoinArg: otherInputs.depositCoinArg };

		return this.fetchApiTxObject<
			ApiPerpetualsVaultDepositTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/deposit",
			{
				...otherInputs,
				...depositInputs,
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetch all withdraw requests for this vault.
	 *
	 * @returns {@link ApiPerpetualsVaultsWithdrawRequestsResponse} containing requests
	 * scoped to `this.vaultObject.objectId`.
	 *
	 * @remarks
	 * This currently calls the `vaults/withdraw-requests` endpoint with a single vault ID.
	 * This may be moved to {@link Perpetuals} as a shared helper.
	 */
	// TODO: move to `Perpetuals` (as well) ?
	public getAllWithdrawRequests(): Promise<ApiPerpetualsVaultsWithdrawRequestsResponse> {
		return this.fetchApi<
			ApiPerpetualsVaultsWithdrawRequestsResponse,
			ApiPerpetualsVaultsWithdrawRequestsBody
		>("vaults/withdraw-requests", {
			vaultIds: [this.vaultObject.objectId],
		});
	}

	// =========================================================================
	//  Owner Previews
	// =========================================================================

	/**
	 * Preview the results of an owner processing one or more withdraw requests.
	 *
	 * @param inputs.userAddresses - Users to process.
	 * @returns Preview response with expected effects.
	 */
	public async getPreviewOwnerProcessWithdrawRequests(inputs: {
		// NOTE: should these be `walletAddresses` instead ?
		userAddresses: SuiAddress[];
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsResponse,
			ApiPerpetualsVaultPreviewOwnerProcessWithdrawRequestsBody
		>("vault/previews/owner/process-withdraw-requests", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	/**
	 * Preview the amount available for the owner to withdraw as performance fees.
	 *
	 * @returns Preview response including withdrawable fees and related metadata.
	 */
	public async getPreviewOwnerWithdrawPerformanceFees() {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesResponse,
			ApiPerpetualsVaultPreviewOwnerWithdrawPerformanceFeesBody
		>("vault/previews/owner/withdraw-performance-fees", {
			vaultId: this.vaultObject.objectId,
		});
	}

	/**
	 * Preview an owner collateral withdrawal (LP redemption).
	 *
	 * @param inputs.lpWithdrawAmount - LP amount to redeem.
	 * @returns Preview response including estimated collateral out.
	 */
	public async getPreviewOwnerWithdrawCollateral(inputs: {
		lpWithdrawAmount: Balance;
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewOwnerWithdrawCollateralResponse,
			ApiPerpetualsVaultPreviewOwnerWithdrawCollateralBody
		>("vault/previews/owner/withdraw-collateral", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	// =========================================================================
	//  User Previews
	// =========================================================================

	/**
	 * Preview creating a withdraw request.
	 *
	 * @param inputs.walletAddress - Requesting wallet.
	 * @param inputs.lpWithdrawAmount - LP amount to withdraw.
	 * @returns Preview response including estimated collateral out and constraints.
	 */
	public async getPreviewCreateWithdrawRequest(inputs: {
		walletAddress: SuiAddress;
		lpWithdrawAmount: Balance;
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse,
			ApiPerpetualsVaultPreviewCreateWithdrawRequestBody
		>("vault/previews/create-withdraw-request", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	/**
	 * Preview depositing into the vault.
	 *
	 * @param inputs.depositAmount - Deposit amount in collateral coin units.
	 * @returns Preview response including estimated LP out.
	 */
	public async getPreviewDeposit(inputs: { depositAmount: Balance }) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewDepositResponse,
			ApiPerpetualsVaultPreviewDepositBody
		>("vault/previews/deposit", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	/**
	 * Preview processing a force withdraw request for a user.
	 *
	 * This is useful to determine what positions/sizes must be closed or what
	 * the expected outputs are prior to building the actual transaction.
	 *
	 * @param inputs.walletAddress - User wallet with a pending force-withdraw.
	 * @returns Preview response describing expected processing effects.
	 */
	public async getPreviewProcessForceWithdrawRequest(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewProcessForceWithdrawRequestResponse,
			ApiPerpetualsVaultPreviewProcessForceWithdrawRequestBody
		>("vault/previews/process-force-withdraw-request", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	// TODO: docs
	public async getPreviewPauseVaultForForceWithdrawRequest(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestResponse,
			ApiPerpetualsVaultPreviewPauseVaultForForceWithdrawRequestBody
		>("vault/previews/pause-vault-for-force-withdraw-request", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetch the current LP coin price for this vault (in collateral units).
	 *
	 * Internally calls {@link Perpetuals.getLpCoinPrices} and returns the first price.
	 *
	 * @returns LP coin price as a `number`.
	 */
	public async getLpCoinPrice(): Promise<number> {
		return (
			await new Perpetuals(this.config, this.Provider).getLpCoinPrices({
				vaultIds: [this.vaultObject.objectId],
			})
		).lpCoinPrices[0];
	}

	// =========================================================================
	//  Account
	// =========================================================================

	/**
	 * Build a lightweight “cap-like” object for the vault’s underlying account.
	 *
	 * @returns {@link PerpetualsPartialVaultCap} suitable for account fetch helpers
	 * such as {@link Perpetuals.getAccount}.
	 */
	public partialVaultCap(): PerpetualsPartialVaultCap {
		return {
			vaultId: this.vaultObject.objectId,
			ownerAddress: this.vaultObject.ownerAddress,
			accountId: this.vaultObject.accountId,
			accountObjectId: this.vaultObject.accountObjectId,
			collateralCoinType: this.vaultObject.collateralCoinType,
		};
	}

	/**
	 * Fetch the underlying perpetuals account object for this vault.
	 *
	 * @returns `{ account }` where `account` is the on-chain {@link PerpetualsAccountObject}.
	 */
	public async getAccountObject(): Promise<{
		account: PerpetualsAccountObject;
	}> {
		return {
			account: (
				await new Perpetuals(
					this.config,
					this.Provider
				).getAccountObjects({
					accountIds: [this.vaultObject.accountId],
				})
			).accounts[0],
		};
	}

	/**
	 * Fetch a {@link PerpetualsAccount} wrapper for the vault’s underlying account.
	 *
	 * @returns `{ account }` where `account` is a high-level {@link PerpetualsAccount}.
	 */
	public async getAccount(): Promise<{ account: PerpetualsAccount }> {
		return new Perpetuals(this.config, this.Provider).getAccount({
			accountCap: this.partialVaultCap(),
		});
	}

	// =========================================================================
	//  Getters
	// =========================================================================

	// TODO: docs
	public isPaused(): boolean {
		return !!(
			this.vaultObject.pausedUntilTimestamp &&
			this.vaultObject.pausedUntilTimestamp > BigInt(Date.now())
		);
	}

	// =========================================================================
	//  Static
	// =========================================================================

	/**
	 * Checks if a string is a valid LP coin name.
	 *
	 * @param value - The string to check.
	 * @returns `true` if `value` can be used as a valid LP coin name, otherwise `false`.
	 *
	 * @remarks
	 * Current rule: ASCII-only. This aligns with many on-chain metadata constraints.
	 */
	public static isValidLpCoinName = (value: string): boolean => {
		return /^[\x00-\x7F]+$/.test(value);
	};

	/**
	 * Checks if a string is a valid LP coin type symbol.
	 *
	 * @param value - The string to check.
	 * @returns `true` if `value` can be used as a valid LP coin type symbol, otherwise `false`.
	 *
	 * @remarks
	 * Current rule: uppercase A–Z plus underscore.
	 */
	public static isValidLpCoinTypeSymbol = (value: string): boolean => {
		return /^[A-Z_]+$/.test(value);
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Compute the implied slippage tolerance for a withdraw request.
	 *
	 * Defined as:
	 * ```text
	 * (lpAmountInUsd - minCollateralAmountOutUsd) / lpAmountInUsd
	 * ```
	 *
	 * @param inputs.withdrawRequest - Withdraw request to analyze.
	 * @returns Slippage fraction (0..1). Returns `0` if `lpAmountInUsd` is missing/zero.
	 */
	public static calcWithdrawRequestSlippage = (inputs: {
		withdrawRequest: PerpetualsVaultWithdrawRequest;
	}) => {
		const { withdrawRequest } = inputs;
		return withdrawRequest.lpAmountInUsd
			? (withdrawRequest.lpAmountInUsd -
					withdrawRequest.minCollateralAmountOutUsd) /
					withdrawRequest.lpAmountInUsd
			: 0;
	};
}
