import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsVaultUpdateForceWithdrawDelayTxBody,
	ApiPerpetualsVaultUpdateLockPeriodTxBody,
	ApiPerpetualsVaultProcessForceWithdrawTxBody,
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
} from "../../types";

export class PerpetualsVault extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly vaultObject: PerpetualsVaultObject,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals/vaults");
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Withdraw Request Txs
	// =========================================================================

	public async getProcessForceWithdrawTx(inputs: {
		sizesToClose: Record<PerpetualsMarketId, Balance>;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultProcessForceWithdrawTxBody>(
			"transactions/process-force-withdraw",
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

	public async getProcessWithdrawRequestsTx(inputs: {
		userAddresses: SuiAddress[];
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsVaultProcessWithdrawRequestsTxBody>(
			"transactions/process-withdraw-requests",
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
}
