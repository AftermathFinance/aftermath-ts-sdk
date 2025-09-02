import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsVaultUpdateForceWithdrawDelayTxBody,
	ApiPerpetualsVaultUpdateLockPeriodTxBody,
	ApiPerpetualsVaultProcessForceWithdrawsTxBody,
	ApiPerpetualsVaultProcessWithdrawRequestsTxBody,
	Balance,
	CallerConfig,
	PerpetualsMarketId,
	PerpetualsVaultObject,
	SuiAddress,
	ApiPerpetualsVaultUpdateOwnerFeePercentageTxBody,
	ApiPerpetualsVaultWithdrawOwnerFeesTxResponse,
	ApiPerpetualsVaultWithdrawOwnerFeesTxBody,
	PerpetualsVaultWithdrawRequest,
	ApiPerpetualsVaultAllWithdrawRequestsBody,
	ApiPerpetualsVaultWithdrawRequestsBody,
	ApiPerpetualsVaultCreateWithdrawRequestTxBody,
	ApiPerpetualsVaultCancelWithdrawRequestsTxBody,
	ApiPerpetualsVaultDepositTxBody,
	ApiPerpetualsVaultUpdateWithdrawRequestSlippagesTxBody,
	ApiPerpetualsVaultPreviewCreateWithdrawRequestBody,
	ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse,
	ApiPerpetualsVaultPreviewDepositResponse,
	ApiPerpetualsVaultPreviewDepositBody,
	ApiPerpetualsVaultPreviewProcessForceWithdrawsResponse,
	ApiPerpetualsVaultPreviewProcessForceWithdrawsBody,
	ApiPerpetualsVaultPreviewProcessWithdrawRequestsResponse,
	ApiPerpetualsVaultPreviewProcessWithdrawRequestsBody,
	ApiPerpetualsVaultPreviewWithdrawOwnerFeesResponse,
	ApiPerpetualsVaultPreviewWithdrawOwnerFeesBody,
} from "../../types";
import { PerpetualsAccount } from "./perpetualsAccount";

export class PerpetualsVault extends Caller {
	// =========================================================================
	//  Public Constants
	// =========================================================================

	public static readonly constants = {
		// NOTE: what is this ?

		// /// Time necessary for the next vault's params update
		// vaultParamsUpdateFrequency: (u64 = 86400000),

		/// Maximum lock period in milliseconds.
		maxLockPeriodMs: 604800000, // 1 week
		/// Minimum lock period in milliseconds.
		minLockPeriodMs: 3600000, // 1 hour
		/// Maximum period for force withdraw delay in milliseconds.
		maxForceWithdrawDelayMs: 86400000, // 1 day
		/// Minimum period for force withdraw delay in milliseconds.
		minForceWithdrawDelayMs: 3600000, // 1 hour
		/// Minimum vault fee.
		minOwnerFeePercentage: 0.0, // 0%
		/// Maximum vault fee.
		maxOwnerFeePercentage: 0.2, // 20%
		// Minimum USD value required for users deposits.
		minDepositUsd: 1,
		// Minimum USD value required to be locked by vault owner during vault creation.
		minOwnerLockUsd: 10,
		/// The maximum number of distinct `ClearingHouse`.
		maxMarketsInVault: 12,
		/// The maximum number of pending orders allowed for a single position in the `Vault`.
		maxPendingOrdersPerPosition: 70,
	};

	public readonly account: PerpetualsAccount;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly vaultObject: PerpetualsVaultObject,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals/vaults");
		this.account = new PerpetualsAccount(
			// @ts-ignore
			vaultObject.account,
			{
				// @ts-ignore
				...vaultObject.accountCap,
				vaultId: vaultObject.objectId,
			},
			config,
			Provider
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Withdraw Request Txs
	// =========================================================================

	public async getProcessForceWithdrawsTx(inputs: {
		// TODO: change to arr ?
		sizesToClose: Record<PerpetualsMarketId, Balance>;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultProcessForceWithdrawsTxBody>(
			"transactions/process-force-withdraws",
			{
				...otherInputs,
				// NOTE: should this be `vaultIds` ?
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async getProcessWithdrawRequestsTx(inputs: {
		userAddresses: SuiAddress[];
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultProcessWithdrawRequestsTxBody>(
			"transactions/process-withdraw-requests",
			{
				...otherInputs,
				// NOTE: should this be `vaultIds` ?
				vaultId: this.vaultObject.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async getUpdateWithdrawRequestSlippageTx(inputs: {
		minLpAmountOut: Balance;
		tx?: Transaction;
	}) {
		const { tx, minLpAmountOut, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultUpdateWithdrawRequestSlippagesTxBody>(
			"transactions/update-withdraw-request-slippages",
			{
				...otherInputs,
				vaultIds: [this.vaultObject.objectId],
				minLpAmountsOut: [minLpAmountOut],
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Admin Settings Txs
	// =========================================================================

	public async getUpdateForceWithdrawDelayTx(inputs: {
		forceWithdrawDelayMs: bigint;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultUpdateForceWithdrawDelayTxBody>(
			"transactions/update-force-withdraw-delay",
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
			{
				txKind: true,
			}
		);
	}

	public async getUpdateLockPeriodTx(inputs: {
		lockPeriodMs: bigint;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultUpdateLockPeriodTxBody>(
			"transactions/update-lock-period",
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
			{
				txKind: true,
			}
		);
	}

	public async getUpdateOwnerFeePercentageTx(inputs: {
		ownerFeePercentage: number;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultUpdateOwnerFeePercentageTxBody>(
			"transactions/update-owner-fee-percentage",
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
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Admin Interactions Txs
	// =========================================================================

	public async getWithdrawOwnerFeesTx(inputs: {
		withdrawAmount: Balance;
		ownerFeePercentage: number;
		tx?: Transaction;
	}) {
		const { tx: txFromInputs, ...otherInputs } = inputs;
		const { txKind, coinOutArg } = await this.fetchApi<
			ApiPerpetualsVaultWithdrawOwnerFeesTxResponse,
			ApiPerpetualsVaultWithdrawOwnerFeesTxBody
		>("transactions/withdraw-owner-fees", {
			...otherInputs,
			vaultId: this.vaultObject.objectId,
			txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
				{
					tx: txFromInputs ?? new Transaction(),
				}
			),
		});

		const tx = Transaction.fromKind(txKind);
		// tx.setSender(this.accountCap.walletAddress);

		return {
			tx,
			coinOutArg,
		};
	}

	// =========================================================================
	//  User Interactions Txs
	// =========================================================================

	public async getCreateWithdrawRequestTx(inputs: {
		lpWithdrawAmount: Balance;
		minLpWithdrawAmount: Balance;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultCreateWithdrawRequestTxBody>(
			"transactions/create-withdraw-request",
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
			{
				txKind: true,
			}
		);
	}

	public async getCancelWithdrawRequestTx(inputs: {
		walletAddress: SuiAddress;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultCancelWithdrawRequestsTxBody>(
			"transactions/cancel-withdraw-requests",
			{
				...otherInputs,
				vaultIds: [this.vaultObject.objectId],
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	// TODO: make return lp coin out ?
	public async getDepositTx(
		inputs: {
			walletAddress: SuiAddress;
			minLpAmountOut: Balance;
			tx?: Transaction;
			isSponsoredTx?: boolean;
		} & (
			| {
					depositAmount: Balance;
			  }
			| {
					depositCoinArg: TransactionObjectArgument;
			  }
		)
	) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultDepositTxBody>(
			"transactions/deposit",
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
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	// vault_caps_ids ?
	public async getAllWithdrawRequests() {
		return this.fetchApi<
			PerpetualsVaultWithdrawRequest[],
			ApiPerpetualsVaultAllWithdrawRequestsBody
		>("all-withdraw-requests", {
			vaultId: this.vaultObject.objectId,
		});
	}

	// TODO: add to perps account as well
	public async getWithdrawRequestsForUser(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApi<
			PerpetualsVaultWithdrawRequest[],
			ApiPerpetualsVaultWithdrawRequestsBody
		>("withdraw-requests", {
			...inputs,
			vaultIds: [this.vaultObject.objectId],
		});
	}

	// =========================================================================
	//  Admin Previews
	// =========================================================================

	// TODO: change all `withdraws` to `withdrawals` ?
	public async getPreviewProcessForceWithdraws(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewProcessForceWithdrawsResponse,
			ApiPerpetualsVaultPreviewProcessForceWithdrawsBody
		>("previews/process-force-withdraws", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	public async getPreviewWithdrawOwnerFees(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewWithdrawOwnerFeesResponse,
			ApiPerpetualsVaultPreviewWithdrawOwnerFeesBody
		>("previews/withdraw-owner-fees", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	// =========================================================================
	//  User Previews
	// =========================================================================

	public async getPreviewCreateWithdrawRequest(inputs: {
		lpWithdrawAmount: Balance;
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse,
			ApiPerpetualsVaultPreviewCreateWithdrawRequestBody
		>("previews/create-withdraw-request", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	public async getPreviewDeposit(inputs: { depositAmount: Balance }) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewDepositResponse,
			ApiPerpetualsVaultPreviewDepositBody
		>("previews/deposit", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	public async getPreviewProcessWithdrawRequests(inputs: {
		// NOTE: should these be `walletAddresses` instead ?
		userAddresses: SuiAddress[];
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewProcessWithdrawRequestsResponse,
			ApiPerpetualsVaultPreviewProcessWithdrawRequestsBody
		>("previews/process-withdraw-requests", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	// // =========================================================================
	// //  Getters
	// // =========================================================================

	// public account() {
	// 	return this.account;
	// }
}
