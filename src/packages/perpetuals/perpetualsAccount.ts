import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsLimitOrderBody,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsPreviewPlaceOrderResponse,
	ApiPerpetualsWithdrawCollateralBody,
	Balance,
	PerpetualsAccountCap,
	PerpetualsAccountObject,
	PerpetualsMarketId,
	PerpetualsOrderId,
	PerpetualsPosition,
	SdkPerpetualsPlaceLimitOrderInputs,
	SdkPerpetualsPlaceMarketOrderInputs,
	SuiAddress,
	ApiPerpetualsTransferCollateralBody,
	ObjectId,
	ApiPerpetualsCancelOrdersBody,
	Percentage,
	ApiDataWithCursorBody,
	Timestamp,
	ApiPerpetualsAccountCollateralHistoryResponse,
	ApiPerpetualsAccountOrderHistoryResponse,
	PerpetualsAccountId,
	ApiPerpetualsAccountCollateralHistoryBody,
	ApiPerpetualsAccountOrderHistoryBody,
	ApiPerpetualsPreviewCancelOrdersBody,
	ApiPerpetualsPreviewCancelOrdersResponse,
	// ApiPerpetualsPreviewReduceOrderBody,
	// ApiPerpetualsPreviewReduceOrderResponse,
	ApiPerpetualsAllocateCollateralBody,
	ApiPerpetualsDeallocateCollateralBody,
	// ApiPerpetualsReduceOrderBody,
	ApiPerpetualsPreviewSetLeverageBody,
	ApiPerpetualsPreviewSetLeverageResponse,
	ApiPerpetualsSetLeverageTxBody,
	CallerConfig,
	SdkPerpetualsCancelOrdersPreviewInputs,
	ApiPerpetualsStopOrderDatasBody,
	PerpetualsStopOrderData,
	ApiPerpetualsCancelStopOrdersBody,
	ApiPerpetualsPlaceStopOrdersBody,
	SdkPerpetualsPlaceStopOrdersInputs,
	ApiPerpetualsEditStopOrdersBody,
	SdkPerpetualsPlaceSlTpOrdersInputs,
	ApiPerpetualsPlaceSlTpOrdersBody,
	// ApiPerpetualsAccountMarginHistoryBody,
	ApiPerpetualsWithdrawCollateralResponse,
	SdkPerpetualsPlaceMarketOrderPreviewInputs,
	SdkPerpetualsPlaceLimitOrderPreviewInputs,
	ApiPerpetualsPreviewPlaceMarketOrderBody,
	ApiPerpetualsPreviewPlaceLimitOrderBody,
	ApiTransactionResponse,
	ApiPerpetualsPreviewEditCollateralResponse,
	ApiPerpetualsPreviewEditCollateralBody,
	PerpetualsAccountMarginHistoryData,
	ApiPerpetualsAccountMarginHistoryBody,
	PerpetualsVaultCap,
	PerpetualsPartialVaultCap,
	ApiPerpetualsAccountMarginHistoryResponse,
	ApiPerpetualsStopOrderDatasResponse,
	ApiPerpetualsGrantAgentWalletTxBody,
	ApiPerpetualsRevokeAgentWalletTxBody,
	PerpetualsOrderData,
} from "../../types";
import { Casting, Helpers } from "../../general/utils";
import { Perpetuals } from "./perpetuals";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";

/**
 * Note on “refreshing” account state:
 *
 * This class is a thin wrapper around a snapshot of {@link PerpetualsAccountObject}
 * that is typically fetched via {@link Perpetuals.getAccount}. The transaction builders
 * use the current snapshot to derive fields like `hasPosition` and to construct
 * SL/TP helpers that depend on the position side.
 *
 * If your app is long-lived, you may want to periodically re-fetch the account
 * (and recreate this wrapper) to avoid stale local position/order state. For example:
 * - After placing/canceling orders
 * - After fills/liquidations/funding settlements
 * - After switching markets or wallets
 */

/**
 * High-level wrapper around a single Perpetuals account or vault account.
 *
 * This class encapsulates:
 *
 * - Transaction builders for:
 *   - Collateral actions (deposit, withdraw, allocate, deallocate, transfer)
 *   - Orders (market/limit, cancel, stop orders, SL/TP, set leverage)
 * - Read-only account helpers:
 *   - Stop-order message signing
 *   - Order & stop-order metadata
 *   - Collateral & trade history
 * - Convenience helpers to:
 *   - Fetch and categorize SL/TP stop orders
 *   - Resolve account/vault identifiers and owner addresses
 *
 * You typically do not construct `PerpetualsAccount` directly. Instead, use
 * {@link Perpetuals.getAccount} or {@link Perpetuals.getAccounts}, which
 * fetch all required on-chain data and wrap it for you:
 *
 * ```ts
 * const afSdk = new Aftermath("MAINNET");
 * await afSdk.init();
 *
 * const perps = afSdk.Perpetuals();
 * const [accountCap] = await perps.getOwnedAccountCaps({
 *   walletAddress: "0x...",
 * });
 *
 * const account = await perps.getAccount({ accountCap });
 *
 * // Build a deposit transaction
 * const depositTx = await account.getDepositCollateralTx({
 *   depositAmount: BigInt("1000000000"),
 * });
 * ```
 */
export class PerpetualsAccount extends Caller {
	// =========================================================================
	//  Private Members
	// =========================================================================

	/**
	 * If this account is backed by a vault, this holds the vault object ID.
	 * Otherwise, `undefined` for "direct" user accounts.
	 *
	 * This is used primarily to route requests to either:
	 * - `/perpetuals/account/...` endpoints, or
	 * - `/perpetuals/vault/...` endpoints.
	 */
	private readonly vaultId: ObjectId | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Create a new {@link PerpetualsAccount} wrapper.
	 *
	 * @param account - Raw account object with positions and equity data.
	 * @param accountCap - Account cap or partial vault cap object containing
	 *   ownership and collateral metadata.
	 * @param config - Optional {@link CallerConfig} (network, auth, etc.).
	 * @param Provider - Optional shared {@link AftermathApi} provider instance
	 *   used to derive serialized transaction kinds (`txKind`) from
	 *   {@link Transaction} objects.
	 */
	constructor(
		public readonly account: PerpetualsAccountObject,
		public readonly accountCap:
			| PerpetualsAccountCap
			| PerpetualsPartialVaultCap,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		const vaultId =
			"vaultId" in accountCap ? accountCap.vaultId : undefined;
		super(config, "perpetuals");
		this.vaultId = vaultId;
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Collateral Txs
	// =========================================================================

	/**
	 * Build a `deposit-collateral` transaction for this account.
	 *
	 * For non-vault accounts, this endpoint constructs a transaction that:
	 * - Optionally extends an existing {@link Transaction}, and
	 * - Deposits collateral into the Perpetuals account.
	 *
	 * **Note:** Vault accounts are currently not supported and will throw.
	 *
	 * @param inputs.tx - Optional existing transaction to extend. If omitted,
	 *   a new {@link Transaction} is created under the hood.
	 * @param inputs.isSponsoredTx - Optional flag indicating whether the
	 *   transaction is gas-sponsored.
	 * @param inputs.depositAmount - Amount of collateral to deposit, if paying
	 *   directly from the wallet.
	 * @param inputs.depositCoinArg - Transaction object argument referencing a
	 *   coin to deposit (mutually exclusive with `depositAmount`).
	 *
	 * @returns Transaction response containing a `tx`.
	 *
	 * @example
	 * ```ts
	 * const { tx } = await account.getDepositCollateralTx({
	 *   depositAmount: BigInt("1000000000"),
	 * });
	 * ```
	 */
	public async getDepositCollateralTx(
		inputs: {
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

		if ("vaultId" in this.accountCap)
			throw new Error(
				"`getDepositCollateralTx` not supported by vault accounts, please use method `getAdminDepositTx` on class `PerpetualsVault` instead"
			);

		return this.fetchApiTxObject<
			ApiPerpetualsDepositCollateralBody,
			ApiTransactionResponse
		>(
			"account/transactions/deposit-collateral",
			{
				...otherInputs,
				walletAddress: this.ownerAddress(),
				collateralCoinType: this.accountCap.collateralCoinType,
				accountId: this.accountCap.accountId,
				accountCapId: this.accountCap.objectId,
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

	/**
	 * Build a `withdraw-collateral` transaction for this account.
	 *
	 * For non-vault accounts, this endpoint constructs a transaction to:
	 * - Withdraw collateral from the Perpetuals account, and
	 * - Optionally transfer it to a `recipientAddress` (otherwise coin is left
	 *   as a transaction argument).
	 *
	 * **Note:** Vault accounts are currently not supported and will throw.
	 *
	 * @param inputs.withdrawAmount - Amount of collateral to withdraw.
	 * @param inputs.recipientAddress - Optional address to receive the withdrawn
	 *   coins directly.
	 * @param inputs.tx - Optional transaction to extend (defaults to new `Transaction()`).
	 *
	 * @returns A response containing `tx` and the `coinOutArg` where the
	 *   withdrawn coins end up if `recipientAddress` is not used.
	 *
	 * @example
	 * ```ts
	 * const { tx, coinOutArg } = await account.getWithdrawCollateralTx({
	 *   withdrawAmount: BigInt("1000000000"),
	 * });
	 * ```
	 */
	public async getWithdrawCollateralTx(inputs: {
		withdrawAmount: Balance;
		recipientAddress?: SuiAddress;
		tx?: Transaction;
	}) {
		const { withdrawAmount, recipientAddress, tx: txFromInputs } = inputs;

		if (this.vaultId)
			throw new Error(
				"this method is not supported for vaults, please use method `getAdminWithdrawTx` on class `PerpetualsVault` instead"
			);

		return this.fetchApiTxObject<
			ApiPerpetualsWithdrawCollateralBody,
			ApiPerpetualsWithdrawCollateralResponse
		>(
			"account/transactions/withdraw-collateral",
			{
				withdrawAmount,
				recipientAddress,
				walletAddress: this.ownerAddress(),
				accountId: this.accountCap.accountId,
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

	/**
	 * Build an `allocate-collateral` transaction, moving collateral from this
	 * account into a specific market (clearing house).
	 *
	 * Works for both account-backed and vault-backed accounts.
	 *
	 * @param inputs.marketId - Market to allocate collateral to.
	 * @param inputs.allocateAmount - Amount of collateral to allocate.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing a `tx`.
	 */
	public async getAllocateCollateralTx(inputs: {
		marketId: PerpetualsMarketId;
		allocateAmount: Balance;
		tx?: Transaction;
	}) {
		const { tx, allocateAmount, marketId } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsAllocateCollateralBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/allocate-collateral",
			{
				marketId,
				allocateAmount,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
				walletAddress: this.ownerAddress(),
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx: tx ?? new Transaction() }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `deallocate-collateral` transaction, moving collateral from a
	 * specific market back to this account.
	 *
	 * Works for both account-backed and vault-backed accounts.
	 *
	 * @param inputs.marketId - Market to deallocate collateral from.
	 * @param inputs.deallocateAmount - Amount of collateral to deallocate.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing a `tx`.
	 */
	public async getDeallocateCollateralTx(inputs: {
		marketId: PerpetualsMarketId;
		deallocateAmount: Balance;
		tx?: Transaction;
	}) {
		const { tx, deallocateAmount, marketId } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsDeallocateCollateralBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/deallocate-collateral",
			{
				marketId,
				deallocateAmount,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
				walletAddress: this.ownerAddress(),
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx: tx ?? new Transaction() }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `transfer-collateral` transaction between two Perpetuals accounts.
	 *
	 * Only supported for direct accounts, **not** vault-backed accounts.
	 *
	 * @param inputs.transferAmount - Amount of collateral to transfer.
	 * @param inputs.toAccountId - Destination account ID.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing a `tx`.
	 */
	public async getTransferCollateralTx(inputs: {
		transferAmount: Balance;
		toAccountId: PerpetualsAccountId;
		toAccountCapId?: ObjectId;
		tx?: Transaction;
	}) {
		const { transferAmount, toAccountId, toAccountCapId, tx } = inputs;

		if ("vaultId" in this.accountCap)
			throw new Error(
				"`getTransferCollateralTx` not supported by vault accounts"
			);

		return this.fetchApiTxObject<
			ApiPerpetualsTransferCollateralBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/transfer-collateral",
			{
				transferAmount,
				toAccountId,
				toAccountCapId,
				walletAddress: this.ownerAddress(),
				fromAccountId: this.accountCap.accountId,
				fromAccountCapId: this.accountCap.objectId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx: tx ?? new Transaction() }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Order Txs
	// =========================================================================

	/**
	 * Build a `place-market-order` transaction for this account.
	 *
	 * This is the primary entrypoint for opening/closing positions via market orders.
	 * It automatically:
	 * - Injects the account/vault identity into the payload.
	 * - Derives `hasPosition` based on the current account state for the given market.
	 * - Optionally attaches SL/TP stop orders via the `slTp` input.
	 *
	 * Important behavioral notes:
	 * - `hasPosition` is derived from the local {@link PerpetualsAccountObject} snapshot.
	 *   If the snapshot is stale, consider re-fetching the account first.
	 * - For vault-backed accounts, the API routes to `/perpetuals/vault/...` and uses
	 *   `vaultId` as the identity discriminator. For direct accounts, it uses `accountId`.
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceMarketOrderInputs} for details.
	 *   Notably:
	 *   - `marketId`, `side`, `size`, `collateralChange`, `reduceOnly`
	 *   - Optional `leverage`
	 *   - Optional `slTp` params
	 *   - Optional `tx` to extend
	 *
	 * @returns Transaction response containing `tx`.
	 *
	 * @example
	 * ```ts
	 * const { tx } = await account.getPlaceMarketOrderTx({
	 *   marketId: "0x...",
	 *   side: PerpetualsOrderSide.Bid,
	 *   size: BigInt("1000000000"),
	 *   collateralChange: 10,
	 *   reduceOnly: false,
	 * });
	 * ```
	 */
	public async getPlaceMarketOrderTx(
		inputs: SdkPerpetualsPlaceMarketOrderInputs
	) {
		const { tx: txFromInputs, ...otherInputs } = inputs;

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.ownerAddress());

		return this.fetchApiTxObject<
			ApiPerpetualsMarketOrderBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/place-market-order",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
				// hasPosition:
				// 	this.positionForMarketId(otherInputs) !== undefined,
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `place-limit-order` transaction for this account.
	 *
	 * Similar to {@link getPlaceMarketOrderTx}, but uses limit order semantics:
	 * - Requires `price` and `orderType`.
	 * - Supports reduce-only flags, expiry, optional leverage, and SL/TP stop orders.
	 *
	 * Notes:
	 * - `hasPosition` is derived from local account state; refresh the account if needed.
	 * - This method does not validate tick/lot sizing locally; the API/on-chain
	 *   will enforce market constraints.
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceLimitOrderInputs}.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getPlaceLimitOrderTx(
		inputs: SdkPerpetualsPlaceLimitOrderInputs
	) {
		const { tx: txFromInputs, ...otherInputs } = inputs;

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.ownerAddress());

		return this.fetchApiTxObject<
			ApiPerpetualsLimitOrderBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/place-limit-order",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
				// hasPosition:
				// 	this.positionForMarketId(otherInputs) !== undefined,
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `cancel-orders` transaction for this account.
	 *
	 * Each market in `marketIdsToData` supplies:
	 * - `orderIds`: the orders to cancel in that market
	 * - `collateralChange`: collateral adjustment to apply alongside cancellation
	 * - `leverage`: leverage context used for estimating/validating constraints server-side
	 *
	 * Notes:
	 * - Cancels are applied per market; some markets may succeed while others fail
	 *   depending on API/on-chain validation (returned as a transaction failure at execution).
	 * - If you need to understand the effect prior to building a tx, use
	 *   {@link getCancelOrdersPreview}.
	 *
	 * @param inputs.tx - Optional transaction to extend.
	 * @param inputs.marketIdsToData - Mapping from market IDs to cancel payloads.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getCancelOrdersTx(inputs: {
		tx?: Transaction;
		marketIdsToData: Record<
			PerpetualsMarketId,
			{
				orderIds: PerpetualsOrderId[];
				collateralChange: number;
			}
		>;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsCancelOrdersBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/cancel-orders",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `cancel-stop-orders` transaction for this account.
	 *
	 * This cancels stop-order *objects/tickets* by their object IDs. These IDs are
	 * returned by stop-order query endpoints (see {@link getStopOrderDatas}).
	 *
	 * @param inputs.tx - Optional transaction to extend.
	 * @param inputs.stopOrderIds - Array of stop-order ticket IDs to cancel.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getCancelStopOrdersTx(inputs: {
		tx?: Transaction;
		stopOrderIds: ObjectId[];
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsCancelStopOrdersBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/cancel-stop-orders",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `place-stop-orders` transaction for this account.
	 *
	 * This allows placing one or more stop orders in a single transaction,
	 * optionally with a dedicated gas coin and a sponsored gas flag.
	 *
	 * Typical usage:
	 * - Construct stop order payload(s) client-side
	 * - Call this method to build a transaction kind
	 * - Sign/execute the transaction via Sui
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceStopOrdersInputs}.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getPlaceStopOrdersTx(
		inputs: SdkPerpetualsPlaceStopOrdersInputs
	) {
		const {
			tx: txFromInputs,
			isSponsoredTx,
			stopOrders,
			gasCoinArg,
		} = inputs;

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.ownerAddress());

		return this.fetchApiTxObject<
			ApiPerpetualsPlaceStopOrdersBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/place-stop-orders",
			{
				stopOrders,
				gasCoinArg,
				isSponsoredTx,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `place-sl-tp-orders` transaction for this account.
	 *
	 * This helper constructs SL/TP stop orders for an **existing** position
	 * in a given market. If the account has no position for `marketId`, this
	 * throws an error.
	 *
	 * Implementation details:
	 * - Determines the current position side from the account snapshot.
	 * - Sets `positionSide` for the API so SL/TP orders are bound to closing logic
	 *   (i.e. they should trigger on the opposite side of the open position).
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceSlTpOrdersInputs}.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getPlaceSlTpOrdersTx(
		inputs: SdkPerpetualsPlaceSlTpOrdersInputs
	) {
		const {
			tx: txFromInputs,
			isSponsoredTx,
			marketId,
			...slTpInputs
		} = inputs;

		const position = this.positionForMarketId({ marketId });
		if (!position) throw new Error("you have no position for this market");

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.ownerAddress());

		return this.fetchApiTxObject<
			ApiPerpetualsPlaceSlTpOrdersBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/place-sl-tp-orders",
			{
				...slTpInputs,
				marketId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
				positionSide: Perpetuals.positionSide({
					baseAssetAmount: position.baseAssetAmount,
				}),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build an `edit-stop-orders` transaction for this account.
	 *
	 * This endpoint lets you update existing stop orders in batch.
	 *
	 * Notes:
	 * - You must provide the full updated stop-order objects (including object IDs).
	 * - This is typically used to adjust trigger prices, sizes, expiries, or the
	 *   embedded limit-order parameters.
	 *
	 * @param inputs.stopOrders - Full updated stop-order payloads to apply.
	 * @param inputs.tx - Optional transaction to extend.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getEditStopOrdersTx(
		inputs: Omit<
			ApiPerpetualsEditStopOrdersBody,
			"txKind" | "accountObjectId"
		> & {
			tx?: Transaction;
		}
	) {
		const { tx: txFromInputs, stopOrders } = inputs;

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.ownerAddress());

		return this.fetchApiTxObject<
			ApiPerpetualsEditStopOrdersBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/edit-stop-orders",
			{
				stopOrders,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	// public async getReduceOrderTx(inputs: {
	// 	tx?: Transaction;
	// 	collateralChange: number;
	// 	marketId: PerpetualsMarketId;
	// 	orderId: PerpetualsOrderId;
	// 	sizeToSubtract: bigint;
	// 	leverage?: number;
	// }) {
	// 	const { tx, ...otherInputs } = inputs;
	// 	return this.fetchApiTxObject<
	// 		ApiPerpetualsReduceOrderBody,
	// 		ApiTransactionResponse
	// 	>(
	// 		`${this.vaultId ? "vault" : "account"}/` +
	// 			"transactions/reduce-order",
	// 		{
	// 			...otherInputs,
	// 			txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
	// 				{ tx }
	// 			),
	// 			walletAddress: this.ownerAddress(),
	// 			...("vaultId" in this.accountCap
	// 				? {
	// 						vaultId: this.accountCap.vaultId,
	// accountId: undefined,
	// 				  }
	// 				: {
	// 						accountId: this.accountCap.accountId,
	// vaultId: undefined,
	// 				  }),
	// 		},
	// 		undefined,
	// 		{
	// 			txKind: true,
	// 		}
	// 	);
	// }

	/**
	 * Build a `set-leverage` transaction for a given market.
	 *
	 * This updates the effective leverage for the position (or potential position)
	 * in `marketId`, and optionally adjusts collateral in tandem.
	 *
	 * Notes:
	 * - Leverage changes may be constrained by protocol risk limits and current
	 *   position state.
	 * - If you want to understand the effect first, use {@link getSetLeveragePreview}.
	 *
	 * @param inputs.tx - Optional transaction to extend.
	 * @param inputs.leverage - Target leverage value.
	 * @param inputs.collateralChange - Net collateral change to apply alongside
	 *   the leverage update.
	 * @param inputs.marketId - Market whose leverage to adjust.
	 *
	 * @returns Transaction response containing `tx`.
	 */
	public async getSetLeverageTx(inputs: {
		tx?: Transaction;
		leverage: number;
		collateralChange: number;
		marketId: PerpetualsMarketId;
	}) {
		const { leverage, tx, collateralChange, marketId } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsSetLeverageTxBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/set-leverage",
			{
				leverage,
				marketId,
				collateralChange,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Position Txs
	// =========================================================================

	// public async getClosePositionTx(inputs: {
	// 	size: bigint;
	// 	market: PerpetualsMarket;
	// 	orderDatas: PerpetualsOrderData[];
	// 	indexPrice: number;
	// 	collateralPrice: number;
	// }) {
	// 	throw new Error("TODO");
	// 	// return this.getPlaceMarketOrderTx({
	// 	// 	...this.closePositionTxInputs(inputs),
	// 	// });
	// }

	// =========================================================================
	//  Interactions
	// =========================================================================

	/**
	 * Build a deterministic message payload to sign when querying stop orders
	 * from the backend.
	 *
	 * This payload is intended to be signed off-chain and then submitted to
	 * `getStopOrderDatas` as a proof of account ownership.
	 *
	 * Important:
	 * - The returned payload is *not* a Sui transaction; it is an off-chain
	 *   “authentication” message.
	 * - The backend expects `account_id` to be a decimal string. This code
	 *   normalizes the bigint `accountId` by stripping the trailing `n`.
	 *
	 * @param inputs.marketIds - Optional list of market IDs to scope the query.
	 *
	 * @returns An object describing the action and account/market IDs, suitable
	 *   for message signing.
	 *
	 * @example
	 * ```ts
	 * const message = account.getStopOrdersMessageToSign({ marketIds: ["0x..."] });
	 * const { signature } = await wallet.signMessage({
	 *   message: new TextEncoder().encode(JSON.stringify(message)),
	 * });
	 * ```
	 */
	public getStopOrdersMessageToSign(inputs?: {
		marketIds: PerpetualsMarketId[];
	}): {
		action: string;
		account_id: string;
		clearing_house_ids: string[];
	} {
		return {
			action: "GET_STOP_ORDERS",
			account_id: this.accountCap.accountId
				.toString()
				.replaceAll("n", ""),
			clearing_house_ids: inputs?.marketIds ?? [],
		};
	}

	// public async getPlaceOrderPreview(
	// 	inputs: SdkPerpetualsPlaceOrderPreviewInputs,
	// 	abortSignal?: AbortSignal
	// ): Promise<
	// 	| {
	// 			error: string;
	// 	  }
	// 	| {
	// 			updatedPosition: PerpetualsPosition;
	// 			priceSlippage: number;
	// 			percentSlippage: Percentage;
	// 			filledSize: number;
	// 			filledSizeUsd: number;
	// 			postedSize: number;
	// 			postedSizeUsd: number;
	// 			collateralChange: number;
	// 			executionPrice: number;
	// 	  }
	// > {
	// 	return this.fetchApi<
	// 		ApiPerpetualsPreviewOrderResponse,
	// 		ApiPerpetualsPreviewOrderBody
	// 	>(
	// 		`${this.vaultId ? "vault" : "account"}/` +"previews/place-order",
	// 		{
	// 			...inputs,
	// 			accountId: this.accountCap.accountId,
	// 			collateralCoinType: this.accountCap.collateralCoinType,
	// 		},
	// 		abortSignal
	// 	);
	// }

	/**
	 * Preview the effects of placing a market order (without building a tx).
	 *
	 * This is a read-only API call that runs the protocol’s pricing / margin /
	 * slippage logic against the current market state and your account/vault context.
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceMarketOrderPreviewInputs}.
	 * @param abortSignal - Optional `AbortSignal` to cancel the request.
	 *
	 * @returns Either an error message or a preview including:
	 * - `updatedPosition`
	 * - `priceSlippage`, `percentSlippage`
	 * - `filledSize`, `filledSizeUsd`
	 * - `postedSize`, `postedSizeUsd`
	 * - `collateralChange`
	 * - `executionPrice`
	 */
	public async getPlaceMarketOrderPreview(
		inputs: SdkPerpetualsPlaceMarketOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<ApiPerpetualsPreviewPlaceOrderResponse> {
		return this.fetchApi<
			ApiPerpetualsPreviewPlaceOrderResponse,
			ApiPerpetualsPreviewPlaceMarketOrderBody
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"previews/place-market-order",
			{
				...inputs,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			abortSignal
		);
	}

	/**
	 * Preview the effects of placing a limit order (without building a tx).
	 *
	 * The preview simulates:
	 * - How much size would execute immediately vs post to the book
	 * - Expected slippage and execution price
	 * - Resulting position and margin impact
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceLimitOrderPreviewInputs}.
	 * @param abortSignal - Optional `AbortSignal` to cancel the request.
	 *
	 * @returns Either an error message or a preview object similar to
	 *   {@link getPlaceMarketOrderPreview}.
	 */
	public async getPlaceLimitOrderPreview(
		inputs: SdkPerpetualsPlaceLimitOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<ApiPerpetualsPreviewPlaceOrderResponse> {
		return this.fetchApi<
			ApiPerpetualsPreviewPlaceOrderResponse,
			ApiPerpetualsPreviewPlaceLimitOrderBody
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"previews/place-limit-order",
			{
				...inputs,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			abortSignal
		);
	}

	/**
	 * Preview the effects of canceling orders across one or more markets.
	 *
	 * This is commonly used to:
	 * - Validate that cancels are allowed under current margin constraints
	 * - Estimate how collateral/margin would change after canceling (and applying
	 *   the associated `collateralChange` values)
	 *
	 * If `marketIdsToData` is empty, this returns a trivial preview with:
	 * - `marketIdsToData: {}`
	 *
	 * @param inputs - See {@link SdkPerpetualsCancelOrdersPreviewInputs}.
	 * @param abortSignal - Optional `AbortSignal` to cancel the request.
	 *
	 * @returns Either:
	 * - `{ marketIdsToData }`, or
	 * - `{ error }`.
	 */
	public async getCancelOrdersPreview(
		inputs: SdkPerpetualsCancelOrdersPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<ApiPerpetualsPreviewCancelOrdersResponse> {
		// NOTE: should this case return an error instead ?
		if (Object.keys(inputs.marketIdsToData).length <= 0)
			return {
				marketIdsToData: {},
			};

		return this.fetchApi<
			ApiPerpetualsPreviewCancelOrdersResponse,
			ApiPerpetualsPreviewCancelOrdersBody
		>(
			`${this.vaultId ? "vault" : "account"}/` + "previews/cancel-orders",
			{
				...inputs,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			abortSignal
		);
	}

	// public async getReduceOrderPreview(
	// 	inputs: {
	// 		marketId: PerpetualsMarketId;
	// 		orderId: PerpetualsOrderId;
	// 		sizeToSubtract: bigint;
	// 		leverage?: number;
	// 	},
	// 	abortSignal?: AbortSignal
	// ): Promise<
	// 	| {
	// 			positionAfterReduceOrder: PerpetualsPosition;
	// 			collateralChange: number;
	// 	  }
	// 	| {
	// 			error: string;
	// 	  }
	// > {
	// 	return this.fetchApi<
	// 		ApiPerpetualsPreviewReduceOrderResponse,
	// 		ApiPerpetualsPreviewReduceOrderBody
	// 	>(
	// 		`${this.vaultId ? "vault" : "account"}/` + "previews/reduce-order",
	// 		{
	// 			...inputs,
	// 			...("vaultId" in this.accountCap
	// 				? {
	// 						vaultId: this.accountCap.vaultId,
	//						accountId: undefined,
	// 				  }
	// 				: {
	// 						accountId: this.accountCap.accountId,
	//						vaultId: undefined,
	// 				  }),
	// 		},
	// 		abortSignal
	// 	);
	// }

	/**
	 * Preview the effects of setting leverage for a given market.
	 *
	 * The preview returns:
	 * - The position after the leverage change (`updatedPosition`)
	 * - The collateral delta required/produced (`collateralChange`)
	 *
	 * @param inputs.marketId - Market whose leverage you want to adjust.
	 * @param inputs.leverage - Target leverage value.
	 * @param abortSignal - Optional `AbortSignal` to cancel the request.
	 *
	 * @returns Either:
	 * - `{ updatedPosition, collateralChange }`, or
	 * - `{ error }`.
	 */
	public async getSetLeveragePreview(
		inputs: {
			marketId: PerpetualsMarketId;
			leverage: number;
		},
		abortSignal?: AbortSignal
	): Promise<
		| {
				updatedPosition: PerpetualsPosition;
				collateralChange: number;
		  }
		| {
				error: string;
		  }
	> {
		const { marketId, leverage } = inputs;

		return this.fetchApi<
			ApiPerpetualsPreviewSetLeverageResponse,
			ApiPerpetualsPreviewSetLeverageBody
		>(
			`${this.vaultId ? "vault" : "account"}/` + "previews/set-leverage",
			{
				marketId,
				leverage,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			abortSignal
		);
	}

	/**
	 * Preview the effects of allocating/deallocating collateral for the position in
	 * a given market.
	 *
	 * Semantics:
	 * - Positive `collateralChange` previews allocation (moving collateral into the market).
	 * - Negative `collateralChange` previews deallocation (moving collateral out of the market).
	 *
	 * @param inputs.marketId - Market of whose position you want to allocate/deallocate
	 * collateral to/from.
	 * @param inputs.collateralChange - The target collateral change (a positive number
	 * for allocating collateral, negative for deallocating collateral).
	 * @param abortSignal - Optional `AbortSignal` to cancel the request.
	 *
	 * @returns Either:
	 * - `{ updatedPosition, collateralChange }`, or
	 * - `{ error }`.
	 */
	public async getEditCollateralPreview(
		inputs: {
			marketId: PerpetualsMarketId;
			collateralChange: Balance;
		},
		abortSignal?: AbortSignal
	): Promise<
		| {
				updatedPosition: PerpetualsPosition;
				collateralChange: number;
		  }
		| {
				error: string;
		  }
	> {
		const { marketId, collateralChange } = inputs;

		return this.fetchApi<
			ApiPerpetualsPreviewEditCollateralResponse,
			ApiPerpetualsPreviewEditCollateralBody
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"previews/edit-collateral",
			{
				marketId,
				collateralChange,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
							accountId: undefined,
					  }
					: {
							accountId: this.accountCap.accountId,
							accountCapId: this.accountCap.objectId,
							vaultId: undefined,
					  }),
			},
			abortSignal
		);
	}

	// public getPlaceClosePositionOrderPreview = async (
	// 	inputs: {
	// 		size: bigint;
	// 		marketId: PerpetualsMarketId;
	// 		leverage?: number;
	// 	} & (
	// 		| {
	// 				accountId: PerpetualsAccountId;
	// 		  }
	// 		| {
	// 				vaultId: ObjectId;
	// 		  }
	// 	),
	// 	abortSignal?: AbortSignal
	// ): Promise<ReturnType<PerpetualsAccount["getPlaceMarketOrderPreview"]>> => {
	// 	// TODO: make this fetch instead ?
	// 	const position = this.positionForMarketId({
	// 		marketId: inputs.marketId,
	// 	});
	// 	if (!position)
	// 		throw new Error(
	// 			`Account has no position for market id: ${inputs.marketId}`
	// 		);
	// 	return this.getPlaceMarketOrderPreview(
	// 		{
	// 			...inputs,
	// 			reduceOnly: true,
	// 			side:
	// 				Perpetuals.positionSide(position) ===
	// 				PerpetualsOrderSide.Ask
	// 					? PerpetualsOrderSide.Bid
	// 					: PerpetualsOrderSide.Ask,
	// 		},
	// 		abortSignal
	// 	);
	// };

	/**
	 * Fetch stop-order ticket data for this account, using an off-chain signed
	 * payload.
	 *
	 * Typical flow:
	 * 1) Call {@link getStopOrdersMessageToSign} to construct a deterministic payload
	 * 2) Sign the payload with the wallet
	 * 3) Provide the signed payload to this method to fetch stop order data
	 *
	 * @param inputs.bytes - Serialized message that was signed (e.g. JSON string).
	 * @param inputs.signature - Signature over `bytes`.
	 * @param inputs.marketIds - Optional subset of markets to filter results by.
	 *
	 * @returns {@link ApiPerpetualsStopOrderDatasResponse} containing `stopOrderDatas`.
	 */
	public async getStopOrderDatas(inputs: {
		bytes: string;
		signature: string;
		marketIds?: PerpetualsMarketId[];
	}) {
		const { bytes, signature, marketIds } = inputs;

		return this.fetchApi<
			ApiPerpetualsStopOrderDatasResponse,
			ApiPerpetualsStopOrderDatasBody
		>(`${this.vaultId ? "vault" : "account"}/` + "stop-order-datas", {
			bytes,
			signature,
			walletAddress: this.ownerAddress(),
			marketIds: marketIds ?? [],
			...("vaultId" in this.accountCap
				? {
						vaultId: this.accountCap.vaultId,
						accountId: undefined,
				  }
				: {
						accountId: this.accountCap.accountId,
						accountCapId: this.accountCap.objectId,
						vaultId: undefined,
				  }),
		});
	}

	/**
	 * Fetch paginated collateral-change history for this account, including
	 * deposits, withdrawals, funding settlements, liquidations, etc.
	 *
	 * Pagination:
	 * - Use `beforeTimestampCursor` to fetch older entries.
	 * - The API returns a `nextBeforeTimestampCursor` to continue pagination.
	 *
	 * @param inputs.beforeTimestampCursor - Optional cursor for pagination.
	 * @param inputs.limit - Optional limit per page.
	 *
	 * @returns {@link ApiPerpetualsAccountCollateralHistoryResponse} containing
	 * an array of changes and a `nextBeforeTimestampCursor`.
	 */
	public async getCollateralHistory(
		inputs: Omit<ApiPerpetualsAccountCollateralHistoryBody, "accountId">
	) {
		return this.fetchApi<
			ApiPerpetualsAccountCollateralHistoryResponse,
			ApiPerpetualsAccountCollateralHistoryBody
		>("account/collateral-history", {
			...inputs,
			accountId: this.accountCap.accountId,
		});
	}

	/**
	 * Fetch paginated order history for this account.
	 *
	 * This endpoint is distinct from {@link getOrderDatas}:
	 * - `getOrderDatas` resolves current/pending orders based on the snapshot.
	 * - `getOrderHistory` returns historical order events (fills, cancels, etc.)
	 *   over time with cursor-based pagination.
	 *
	 * @param inputs.beforeTimestampCursor - Optional cursor for pagination.
	 * @param inputs.limit - Optional limit per page.
	 *
	 * @returns {@link ApiPerpetualsAccountOrderHistoryResponse} containing a list of
	 * orders and a `nextBeforeTimestampCursor`.
	 */
	public async getOrderHistory(
		inputs: Omit<ApiPerpetualsAccountOrderHistoryBody, "accountId">
	) {
		return this.fetchApi<
			ApiPerpetualsAccountOrderHistoryResponse,
			ApiPerpetualsAccountOrderHistoryBody
		>("account/order-history", {
			...inputs,
			accountId: this.accountCap.accountId,
		});
	}

	/**
	 * Fetch historical margin snapshots for this account over a time range.
	 *
	 * This endpoint returns time-series margin data suitable for charting UI
	 * such as equity and available collateral over time.
	 *
	 * Notes:
	 * - This is an account-level view (aggregated across markets).
	 *
	 * @param inputs - {@link ApiPerpetualsAccountMarginHistoryBody} without `accountId`.
	 * @returns {@link ApiPerpetualsAccountMarginHistoryResponse} containing `marginHistoryDatas`.
	 */
	public async getMarginHistory(
		inputs: Omit<ApiPerpetualsAccountMarginHistoryBody, "accountId">
	) {
		return this.fetchApi<
			ApiPerpetualsAccountMarginHistoryResponse,
			ApiPerpetualsAccountMarginHistoryBody
		>("account/margin-history", {
			...inputs,
			accountId: this.accountCap.accountId,
		});
	}

	// public async getOwnedWithdrawRequests() {
	// 	return new Perpetuals(
	// 		this.config,
	// 		this.Provider
	// 	).getOwnedWithdrawRequests({
	// 		walletAddress: this.ownerAddress(),
	// 	});
	// }

	/**
	 * Build a transaction that grants an Agent Wallet (assistant permissions) for this perpetuals account.
	 *
	 * The returned transaction must be signed and submitted by the **account admin** wallet.
	 * After execution, `recipientAddress` can execute supported trading actions on behalf of this account.
	 *
	 * Agent wallets can perform all supported actions **except**:
	 * - withdrawing collateral, and
	 * - granting or revoking other agent wallets.
	 *
	 * @param inputs.recipientAddress Wallet address to receive agent permissions.
	 * @param inputs.tx Optional existing {@link Transaction} to append to. If omitted, a new Transaction is used.
	 * @throws If this instance represents a vault account (agent wallets are account-only).
	 */
	public async getGrantAgentWalletTx(inputs: {
		recipientAddress: SuiAddress;
		tx?: Transaction;
	}) {
		const { tx, recipientAddress } = inputs;

		if ("vaultId" in this.accountCap)
			throw new Error(
				"`getGrantAgentWalletTx` not supported by vault accounts"
			);

		return this.fetchApiTxObject<
			ApiPerpetualsGrantAgentWalletTxBody,
			ApiTransactionResponse
		>(
			"account/transactions/grant-agent-wallet",
			{
				recipientAddress,
				accountId: this.accountCap.accountId,
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

	/**
	 * Build a transaction that revokes an Agent Wallet (assistant capability) from this perpetuals account.
	 *
	 * The returned transaction must be signed and submitted by the **account admin** wallet.
	 * After execution, the revoked wallet immediately loses its delegated permissions.
	 *
	 * @param inputs.accountCapId Object ID of the assistant capability to revoke.
	 * @param inputs.tx Optional existing {@link Transaction} to append to. If omitted, a new Transaction is used.
	 * @throws If this instance represents a vault account (agent wallets are account-only).
	 */
	public async getRevokeAgentWalletTx(inputs: {
		accountCapId: ObjectId;
		tx?: Transaction;
	}) {
		const { tx, accountCapId } = inputs;

		if ("vaultId" in this.accountCap)
			throw new Error(
				"`getRevokeAgentWalletTx` not supported by vault accounts"
			);

		return this.fetchApiTxObject<
			ApiPerpetualsRevokeAgentWalletTxBody,
			ApiTransactionResponse
		>(
			"account/transactions/revoke-agent-wallet",
			{
				accountCapId,
				accountId: this.accountCap.accountId,
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
	//  Helpers
	// =========================================================================

	/**
	 * Find the current position for a given market ID, if any.
	 *
	 * @param inputs.marketId - Market ID to search for.
	 * @returns {@link PerpetualsPosition} if found, otherwise `undefined`.
	 */
	public positionForMarketId(inputs: {
		marketId: PerpetualsMarketId;
	}): PerpetualsPosition | undefined {
		try {
			return this.account.positions.find(
				(pos) => pos.marketId === inputs.marketId
			)!;
		} catch (e) {
			return undefined;
		}
	}

	/**
	 * Filter a list of stop orders to only include non-SL/TP orders.
	 *
	 * A stop order is considered SL/TP if it appears in the combined set of
	 * SL/TP orders across **all** markets (see {@link slTpStopOrderDatas}).
	 *
	 * Note:
	 * - This implementation uses JSON string equality to compare objects.
	 *   This is pragmatic but assumes stable field ordering and identical shapes.
	 *
	 * @param inputs.stopOrderDatas - Full array of stop-order ticket data.
	 * @returns An array of non-SL/TP stop orders, or `undefined` if none exist.
	 */
	public nonSlTpStopOrderDatas(inputs: {
		stopOrderDatas: PerpetualsStopOrderData[];
	}): PerpetualsStopOrderData[] | undefined {
		const { stopOrderDatas } = inputs;

		const slTpOrders = this.slTpStopOrderDatas(inputs);

		const stopOrders = stopOrderDatas.filter(
			(stopOrder) =>
				!(slTpOrders ?? [])
					.map((slTpOrder) => JSON.stringify(slTpOrder))
					.includes(JSON.stringify(stopOrder))
		);
		return stopOrders.length <= 0 ? undefined : stopOrders;
	}

	/**
	 * Extract all SL/TP-style stop orders across **all** markets for this
	 * account.
	 *
	 * SL/TP orders are stop orders which:
	 * - Have an `slTp` payload, and
	 * - Target the opposite side of the current position.
	 *
	 * This combines:
	 * - "Full" SL/TP orders (size >= `i64MaxBigInt`)
	 * - "Partial" SL/TP orders (size < `i64MaxBigInt`)
	 *
	 * The "full vs partial" distinction is a protocol convention: some systems
	 * encode “close entire position” using a sentinel max size.
	 *
	 * @param inputs.stopOrderDatas - Full list of stop-order tickets.
	 * @returns Array of SL/TP stop orders, or `undefined` if none exist.
	 */
	public slTpStopOrderDatas(inputs: {
		stopOrderDatas: PerpetualsStopOrderData[];
	}): PerpetualsStopOrderData[] | undefined {
		const { stopOrderDatas } = inputs;

		let slTpOrders: PerpetualsStopOrderData[] = [];

		for (const { marketId } of this.account.positions) {
			const { fullSlTpOrder, partialSlTpOrders } =
				this.slTpStopOrderDatasForPosition({
					marketId,
					stopOrderDatas,
				});
			slTpOrders = [
				...slTpOrders,
				...(fullSlTpOrder ? [fullSlTpOrder] : []),
				...(partialSlTpOrders ?? []),
			];
		}
		for (const limitOrderId of Helpers.uniqueArray(
			stopOrderDatas.map((stopOrder) => stopOrder.slTp?.limitOrderId)
		)) {
			if (limitOrderId === undefined) continue;

			const { fullSlTpOrder, partialSlTpOrders } =
				this.slTpStopOrderDatasForLimitOrder({
					limitOrderId,
					stopOrderDatas,
				});
			slTpOrders = [
				...slTpOrders,
				...(fullSlTpOrder ? [fullSlTpOrder] : []),
				...(partialSlTpOrders ?? []),
			];
		}
		return slTpOrders.length <= 0 ? undefined : slTpOrders;
	}

	/**
	 * Filter stop orders for a single market to only include non-SL/TP orders.
	 *
	 * Uses {@link slTpStopOrderDatasForPosition} under the hood.
	 *
	 * @param inputs.marketId - Market ID to filter for.
	 * @param inputs.stopOrderDatas - Full list of stop orders.
	 * @returns Non-SL/TP stop orders for the given market, or `undefined` if none exist.
	 */
	public nonSlTpStopOrderDatasForPosition(inputs: {
		marketId: PerpetualsMarketId;
		stopOrderDatas: PerpetualsStopOrderData[];
	}): PerpetualsStopOrderData[] | undefined {
		const { marketId, stopOrderDatas } = inputs;

		const position = this.positionForMarketId({ marketId });
		if (!position) return undefined;

		const { fullSlTpOrder, partialSlTpOrders } =
			this.slTpStopOrderDatasForPosition(inputs);

		const stopOrders = stopOrderDatas.filter(
			(stopOrder) =>
				!stopOrder.limitOrder &&
				![
					...(fullSlTpOrder ? [fullSlTpOrder] : []),
					...(partialSlTpOrders ?? []),
				]
					.map((slTpOrder) => JSON.stringify(slTpOrder))
					.includes(JSON.stringify(stopOrder))
		);
		return stopOrders.length <= 0 ? undefined : stopOrders;
	}

	/**
	 * Categorize stop orders for a specific market into:
	 * - A "full" SL/TP order (size >= `i64MaxBigInt`) if any.
	 * - A set of "partial" SL/TP orders (size < `i64MaxBigInt`).
	 *
	 * SL/TP stop orders are defined as:
	 * - Market ID matches the input market.
	 * - `slTp` field is present.
	 * - Order side is opposite of the position side.
	 * - At least a `stopLossIndexPrice` or `takeProfitIndexPrice` is set.
	 *
	 * Notes on matching:
	 * - The side comparison uses the current position side derived from the account snapshot.
	 * - If `baseAssetAmount === 0` (no effective position), the method returns no SL/TP orders.
	 *
	 * @param inputs.marketId - Market to categorize stop orders for.
	 * @param inputs.stopOrderDatas - Full list of stop orders.
	 *
	 * @returns Object containing:
	 * - `fullSlTpOrder` (if any)
	 * - `partialSlTpOrders` (if any, otherwise `undefined`)
	 */
	public slTpStopOrderDatasForPosition(inputs: {
		marketId: PerpetualsMarketId;
		stopOrderDatas: PerpetualsStopOrderData[];
	}): {
		fullSlTpOrder: PerpetualsStopOrderData | undefined;
		partialSlTpOrders: PerpetualsStopOrderData[] | undefined;
	} {
		const { marketId, stopOrderDatas } = inputs;

		const position = this.positionForMarketId({ marketId });
		if (!position || position.baseAssetAmount === 0) {
			return {
				fullSlTpOrder: undefined,
				partialSlTpOrders: undefined,
			};
		}

		const side = !position ? undefined : Perpetuals.positionSide(position);

		/**
		 * Implementation note:
		 *
		 * This method uses a pair of predicates that differ only by the `size` threshold
		 * to split “full close” SL/TP from “partial close” SL/TP. The sentinel threshold
		 * is {@link Casting.i64MaxBigInt}. Keeping the logic explicit (rather than
		 * abstracting into helpers) makes it easier to reason about protocol conventions.
		 */
		const fullSlTpOrder: PerpetualsStopOrderData | undefined =
			stopOrderDatas.find(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
					(order.slTp.stopLossIndexPrice ||
						order.slTp.takeProfitIndexPrice) &&
					order.size >= Casting.i64MaxBigInt &&
					!order.limitOrder
			);

		const partialSlTpOrders: PerpetualsStopOrderData[] =
			stopOrderDatas.filter(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
					(order.slTp.stopLossIndexPrice ||
						order.slTp.takeProfitIndexPrice) &&
					order.size < Casting.i64MaxBigInt &&
					!order.limitOrder
			);

		return {
			fullSlTpOrder,
			partialSlTpOrders:
				partialSlTpOrders.length <= 0 ? undefined : partialSlTpOrders,
		};
	}

	public slTpStopOrderDatasForLimitOrder(inputs: {
		stopOrderDatas: PerpetualsStopOrderData[];
		limitOrderId: PerpetualsOrderId;
	}): {
		fullSlTpOrder: PerpetualsStopOrderData | undefined;
		partialSlTpOrders: PerpetualsStopOrderData[] | undefined;
	} {
		const { stopOrderDatas, limitOrderId } = inputs;

		/**
		 * Implementation note:
		 *
		 * This method uses a pair of predicates that differ only by the `size` threshold
		 * to split “full close” SL/TP from “partial close” SL/TP. The sentinel threshold
		 * is {@link Casting.i64MaxBigInt}. Keeping the logic explicit (rather than
		 * abstracting into helpers) makes it easier to reason about protocol conventions.
		 */
		const fullSlTpOrder: PerpetualsStopOrderData | undefined =
			stopOrderDatas.find(
				(order) =>
					order.slTp &&
					order.slTp.limitOrderId === limitOrderId &&
					(order.slTp.stopLossIndexPrice ||
						order.slTp.takeProfitIndexPrice) &&
					order.size >= Casting.i64MaxBigInt
			);

		const partialSlTpOrders: PerpetualsStopOrderData[] =
			stopOrderDatas.filter(
				(order) =>
					order.slTp &&
					order.slTp.limitOrderId === limitOrderId &&
					(order.slTp.stopLossIndexPrice ||
						order.slTp.takeProfitIndexPrice) &&
					order.size < Casting.i64MaxBigInt
			);

		return {
			fullSlTpOrder,
			partialSlTpOrders:
				partialSlTpOrders.length <= 0 ? undefined : partialSlTpOrders,
		};
	}

	public orderDatas(): PerpetualsOrderData[] {
		return this.account.positions.reduce(
			(acc, position) => [
				...acc,
				...position.pendingOrders.map((order) => ({
					orderId: order.orderId,
					currentSize: order.currentSize,
					initialSize: order.initialSize,
					side: Perpetuals.orderIdToSide(order.orderId),
					marketId: position.marketId,
				})),
			],
			[] as PerpetualsOrderData[]
		);
	}

	/**
	 * Convenience accessor for the account's available collateral (in coin units).
	 *
	 * This is the amount of collateral not currently locked/allocated across markets,
	 * as represented by the backend response.
	 *
	 * @returns Available collateral as a `number`.
	 */
	public collateral(): number {
		return this.account.availableCollateral;
	}

	// public collateralDecimals(): CoinDecimal {
	// 	return this.accountCap.collateralDecimals;
	// }

	// public collateralBalance(): Balance {
	// 	return Coin.normalizeBalance(
	// 		this.collateral(),
	// 		this.collateralDecimals()
	// 	);
	// }

	/**
	 * Check whether this {@link PerpetualsAccount} is vault-backed.
	 *
	 * @returns `true` if the underlying `accountCap` is a vault cap; otherwise `false`.
	 */
	public isVault(): boolean {
		return "vaultId" in this.accountCap;
	}

	/**
	 * Resolve the owner wallet address of this account or vault.
	 *
	 * - For direct accounts, returns the cap's `walletAddress` field.
	 * - For vault-backed accounts, returns the vault cap's `ownerAddress`.
	 *
	 * Naming note:
	 * - Some types use `walletAddress` for direct ownership. For vault-backed accounts
	 *   the analogous field is `ownerAddress`.
	 *
	 * @returns Owner wallet {@link SuiAddress}.
	 */
	public ownerAddress(): SuiAddress {
		return "walletAddress" in this.accountCap
			? // NOTE: direct accounts expose `walletAddress`; vault accounts expose `ownerAddress`.
			  this.accountCap.walletAddress
			: this.accountCap.ownerAddress;
	}

	/**
	 * Get the underlying account object ID.
	 *
	 * This is the on-chain object that holds the account's state and positions.
	 *
	 * @returns {@link ObjectId} of the account object.
	 */
	public accountObjectId(): ObjectId {
		return this.accountCap.accountObjectId;
	}

	/**
	 * Get the numeric perpetuals account ID.
	 *
	 * This is the protocol-level identifier (bigint-derived) used across API calls.
	 *
	 * @returns {@link PerpetualsAccountId} for this account.
	 */
	public accountId(): PerpetualsAccountId {
		return this.accountCap.accountId;
	}

	/**
	 * Get the account cap object ID, if this is a direct account.
	 *
	 * Direct accounts are controlled via an on-chain “cap” object. Vault-backed
	 * accounts are controlled via vault caps and do not expose a direct account-cap ID.
	 *
	 * @throws If called for a vault-backed account.
	 *
	 * @returns {@link ObjectId} of the account cap.
	 */
	public accountCapId(): ObjectId {
		if ("vaultId" in this.accountCap)
			throw new Error(
				"not account cap id present on vault owned account"
			);
		return this.accountCap.objectId;
	}

	// public closePositionTxInputs = (inputs: {
	// 	size: bigint;
	// 	market: PerpetualsMarket;
	// 	orderDatas: PerpetualsOrderData[];
	// 	indexPrice: number;
	// 	collateralPrice: number;
	// }): SdkPerpetualsPlaceMarketOrderInputs => {
	// 	const { size, market, orderDatas, collateralPrice } = inputs;
	//
	// 	const marketId = market.marketId;
	// 	const position =
	// 		this.positionForMarketId({ marketId }) ?? market.emptyPosition();
	//
	// 	// TODO: move conversion to helper function, since used often
	// 	const ordersCollateral = Helpers.sum(
	// 		orderDatas
	// 			.filter((orderData) => orderData.marketId === market.marketId)
	// 			.map(
	// 				(orderData) =>
	// 					market.calcCollateralUsedForOrder({
	// 						...inputs,
	// 						orderData,
	// 						leverage: position.leverage,
	// 					}).collateral
	// 			)
	// 	);
	//
	// 	const fullPositionCollateralChange =
	// 		Math.max(
	// 			this.calcFreeMarginUsdForPosition(inputs) / collateralPrice -
	// 				ordersCollateral *
	// 					(1 -
	// 						PerpetualsAccount.constants
	// 							.closePositionMarginOfError),
	// 			0
	// 		) * -1;
	//
	// 	// NOTE: is this safe / correct ?
	// 	const collateralChange =
	// 		Number(fullPositionCollateralChange) *
	// 		(Number(size) /
	// 			Casting.Fixed.fixedOneN9 /
	// 			position.baseAssetAmount);
	//
	// 	const positionSide = Perpetuals.positionSide(position);
	// 	return {
	// 		size,
	// 		marketId,
	// 		collateralChange,
	// 		// leverage: position.leverage || 1,
	// 		// leverage: undefined,
	// 		side:
	// 			positionSide === PerpetualsOrderSide.Bid
	// 				? PerpetualsOrderSide.Ask
	// 				: PerpetualsOrderSide.Bid,
	// 		// hasPosition: this.positionForMarketId({ marketId }) !== undefined,
	// 		reduceOnly: true,
	// 	};
	// };
}
