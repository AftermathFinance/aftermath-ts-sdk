import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsVaultUpdateForceWithdrawDelayTxBody,
	ApiPerpetualsVaultUpdateLockPeriodTxBody,
	ApiPerpetualsVaultProcessForceWithdrawRequestTxBody,
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
	ApiPerpetualsVaultsWithdrawRequestsBody,
	ApiPerpetualsVaultWithdrawRequestsBody,
	ApiPerpetualsVaultCreateWithdrawRequestTxBody,
	ApiPerpetualsVaultCancelWithdrawRequestTxBody,
	ApiPerpetualsVaultDepositTxBody,
	ApiPerpetualsVaultUpdateWithdrawRequestSlippagesTxBody,
	ApiPerpetualsVaultPreviewCreateWithdrawRequestBody,
	ApiPerpetualsVaultPreviewCreateWithdrawRequestResponse,
	ApiPerpetualsVaultPreviewDepositResponse,
	ApiPerpetualsVaultPreviewDepositBody,
	ApiPerpetualsVaultPreviewProcessForceWithdrawRequestResponse,
	ApiPerpetualsVaultPreviewProcessForceWithdrawRequestBody,
	ApiPerpetualsVaultPreviewProcessWithdrawRequestsResponse,
	ApiPerpetualsVaultPreviewProcessWithdrawRequestsBody,
	ApiPerpetualsVaultPreviewWithdrawOwnerFeesResponse,
	ApiPerpetualsVaultPreviewWithdrawOwnerFeesBody,
	PerpetualsVaultCap,
	ApiTransactionResponse,
	ObjectId,
	PerpetualsPartialVaultCap,
} from "../../types";
import { PerpetualsAccount } from "./perpetualsAccount";
import { Perpetuals } from "./perpetuals";

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

	// =========================================================================
	//  Constructor
	// =========================================================================

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

	public async getProcessForceWithdrawRequestTx(inputs: {
		walletAddress: SuiAddress;
		// TODO: change to arr ?
		sizesToClose: Record<PerpetualsMarketId, Balance>;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsVaultProcessForceWithdrawRequestTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/process-force-withdraw-request",
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
		return this.fetchApiTxObject<
			ApiPerpetualsVaultProcessWithdrawRequestsTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/process-withdraw-requests",
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
		return this.fetchApiTxObject<
			ApiPerpetualsVaultUpdateWithdrawRequestSlippagesTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/update-withdraw-request-slippages",
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
		return this.fetchApiTxObject<
			ApiPerpetualsVaultUpdateForceWithdrawDelayTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/update-force-withdraw-delay",
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
		return this.fetchApiTxObject<
			ApiPerpetualsVaultUpdateLockPeriodTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/update-lock-period",
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
		return this.fetchApiTxObject<
			ApiPerpetualsVaultUpdateOwnerFeePercentageTxBody,
			ApiTransactionResponse
		>(
			"vault/transactions/update-owner-fee-percentage",
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
		return this.fetchApiTxObject<
			ApiPerpetualsVaultWithdrawOwnerFeesTxBody,
			ApiPerpetualsVaultWithdrawOwnerFeesTxResponse
		>(
			"vault/transactions/withdraw-owner-fees",
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
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  User Interactions Txs
	// =========================================================================

	public async getCreateWithdrawRequestTx(inputs: {
		walletAddress: SuiAddress;
		lpWithdrawAmount: Balance;
		minLpWithdrawAmount: Balance;
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

		const depositInputs =
			"depositAmount" in otherInputs
				? {
						depositAmount: otherInputs.depositAmount,
						collateralCoinType: this.vaultObject.collateralCoinType,
				  }
				: {
						depositCoinArg: otherInputs.depositCoinArg,
				  };

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
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	// TODO: move to `Perpetuals` ?
	public getAllWithdrawRequests(): Promise<PerpetualsVaultWithdrawRequest[]> {
		return this.fetchApi<
			PerpetualsVaultWithdrawRequest[],
			ApiPerpetualsVaultsWithdrawRequestsBody
		>("vaults/withdraw-requests", {
			vaultIds: [this.vaultObject.objectId],
		});
	}

	// // TODO: add to perps account as well ?

	// public async getWithdrawRequestsForUser(inputs: {
	// 	walletAddress: SuiAddress;
	// }) {
	// 	return this.fetchApi<
	// 		PerpetualsVaultWithdrawRequest[],
	// 		ApiPerpetualsVaultWithdrawRequestsBody
	// 	>("owned-withdraw-requests", {
	// 		...inputs,
	// 		vaultIds: [this.vaultObject.objectId],
	// 	});
	// }

	// =========================================================================
	//  Admin Previews
	// =========================================================================

	public async getPreviewProcessWithdrawRequests(inputs: {
		// NOTE: should these be `walletAddresses` instead ?
		userAddresses: SuiAddress[];
	}) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewProcessWithdrawRequestsResponse,
			ApiPerpetualsVaultPreviewProcessWithdrawRequestsBody
		>("vault/previews/process-withdraw-requests", {
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
		>("vault/previews/withdraw-owner-fees", {
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
		>("vault/previews/create-withdraw-request", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

	public async getPreviewDeposit(inputs: { depositAmount: Balance }) {
		return this.fetchApi<
			ApiPerpetualsVaultPreviewDepositResponse,
			ApiPerpetualsVaultPreviewDepositBody
		>("vault/previews/deposit", {
			...inputs,
			vaultId: this.vaultObject.objectId,
		});
	}

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

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getLpCoinPrice(): Promise<number> {
		return (
			await new Perpetuals(this.config, this.Provider).getLpCoinPrices({
				vaultIds: [this.vaultObject.objectId],
			})
		)[0];
	}

	// =========================================================================
	//  Account
	// =========================================================================

	public partialVaultCap(): PerpetualsPartialVaultCap {
		return {
			vaultId: this.vaultObject.objectId,
			ownerAddress: this.vaultObject.ownerAddress,
			accountId: this.vaultObject.accountId,
			accountObjectId: this.vaultObject.accountObjectId,
			collateralCoinType: this.vaultObject.collateralCoinType,
		};
	}

	public async getAccountObject() {
		return (
			await new Perpetuals(this.config, this.Provider).getAccountObjects({
				accountIds: [this.vaultObject.accountId],
				collateralCoinType: this.vaultObject.collateralCoinType,
			})
		)[0];
	}

	public async getAccount() {
		return new Perpetuals(this.config, this.Provider).getAccount({
			accountCap: this.partialVaultCap(),
		});
	}

	// =========================================================================
	//  Static
	// =========================================================================

	/**
	 * Checks if a string is a valid LP coin name.
	 *
	 * @param value - The string to check.
	 * @returns `true` if `value` is can be used as a valid LP coin name, otherwise `false`.
	 */
	public static isValidLpCoinName = (value: string): boolean => {
		return /^[A-Z][_a-zA-Z0-9]*$/.test(value);
	};

	/**
	 * Checks if a string is a valid LP coin type.
	 *
	 * @param value - The string to check.
	 * @returns `true` if `value` is can be used as a valid LP coin type, otherwise `false`.
	 */
	public static isValidLpCoinTypeSymbol = (value: string): boolean => {
		return /^[A-Z][A-Z0-9]*$/i.test(value);
	};
}
