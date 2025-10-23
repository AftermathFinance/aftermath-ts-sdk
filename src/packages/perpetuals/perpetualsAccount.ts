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
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsPosition,
	SdkPerpetualsPlaceLimitOrderInputs,
	SdkPerpetualsPlaceMarketOrderInputs,
	SuiNetwork,
	Url,
	SuiAddress,
	ApiIndexerEventsBody,
	DepositedCollateralEvent,
	PostedOrderEvent,
	CanceledOrderEvent,
	WithdrewCollateralEvent,
	CollateralEvent,
	PerpetualsOrderEvent,
	ApiPerpetualsTransferCollateralBody,
	ObjectId,
	ApiPerpetualsCancelOrdersBody,
	PerpetualsOrderData,
	CoinDecimal,
	Percentage,
	ObjectVersion,
	ApiPerpetualsAccountOrderDatasBody,
	ApiDataWithCursorBody,
	Timestamp,
	PerpetualsAccountCollateralChangesWithCursor,
	PerpetualsAccountTradesWithCursor,
	PerpetualsAccountId,
	ApiPerpetualsAccountCollateralHistoryBody,
	ApiPerpetualsAccountOrderHistoryBody,
	ApiPerpetualsPreviewCancelOrdersBody,
	ApiPerpetualsPreviewCancelOrdersResponse,
	PackageId,
	ApiPerpetualsPreviewReduceOrderBody,
	ApiPerpetualsPreviewReduceOrderResponse,
	ApiPerpetualsAllocateCollateralBody,
	ApiPerpetualsDeallocateCollateralBody,
	ApiPerpetualsReduceOrderBody,
	ApiPerpetualsPreviewSetLeverageBody,
	ApiPerpetualsPreviewSetLeverageResponse,
	ApiPerpetualsSetLeverageTxBody,
	TransactionDigest,
	CallerConfig,
	SdkPerpetualsCancelOrdersPreviewInputs,
	ApiPerpetualsAccountStopOrderDatasBody,
	PerpetualsStopOrderData,
	SerializedTransaction,
	ApiPerpetualsCancelStopOrdersBody,
	ApiPerpetualsPlaceStopOrdersBody,
	SdkPerpetualsPlaceStopOrdersInputs,
	ApiPerpetualsEditStopOrdersBody,
	ServiceCoinData,
	SdkPerpetualsPlaceSlTpOrdersInputs,
	ApiPerpetualsPlaceSlTpOrdersBody,
	ApiPerpetualsAccountMarginHistoryBody,
	PerpetualsAccountMarginData,
	ApiPerpetualsWithdrawCollateralResponse,
	SdkPerpetualsPlaceMarketOrderPreviewInputs,
	SdkPerpetualsPlaceLimitOrderPreviewInputs,
	ApiPerpetualsPreviewPlaceMarketOrderBody,
	ApiPerpetualsPreviewPlaceLimitOrderBody,
	ApiPerpetualsVaultWithdrawRequestsBody,
	PerpetualsVaultWithdrawRequest,
	PerpetualsVaultCap,
	CoinType,
	PerpetualsVaultCapExtended,
	ApiTransactionResponse,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { Perpetuals } from "./perpetuals";
import { Coin } from "..";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { TransactionsApiHelpers } from "../../general/apiHelpers/transactionsApiHelpers";

// TODO: create refresh account positions function ?
export class PerpetualsAccount extends Caller {
	// =========================================================================
	//  Private Constants
	// =========================================================================

	private static readonly constants = {
		closePositionMarginOfError: 0.1, // 10%
	};

	// =========================================================================
	//  Private Members
	// =========================================================================

	private readonly vaultId: ObjectId | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly account: PerpetualsAccountObject,
		public readonly accountCap:
			| PerpetualsAccountCap
			| PerpetualsVaultCapExtended,
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

		// TODO: add vault support
		if (this.vaultId)
			throw new Error("this function is not supported for vaults");

		return this.fetchApiTxObject<
			ApiPerpetualsDepositCollateralBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/deposit-collateral",
			{
				...otherInputs,
				walletAddress: this.ownerAddress(),
				collateralCoinType: this.accountCap.collateralCoinType,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
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

	public async getWithdrawCollateralTx(inputs: {
		withdrawAmount: Balance;
		recipientAddress?: SuiAddress;
		tx?: Transaction;
	}) {
		const { withdrawAmount, recipientAddress, tx: txFromInputs } = inputs;

		// TODO: add vault support
		if (this.vaultId)
			throw new Error("this function is not supported for vaults");

		return this.fetchApiTxObject<
			ApiPerpetualsWithdrawCollateralBody,
			ApiPerpetualsWithdrawCollateralResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/withdraw-collateral",
			{
				withdrawAmount,
				recipientAddress,
				walletAddress: this.ownerAddress(),
				collateralCoinType: this.accountCap.collateralCoinType,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
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
					  }
					: {
							accountId: this.accountCap.accountId,
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
					  }
					: {
							accountId: this.accountCap.accountId,
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

	public async getTransferCollateralTx(inputs: {
		transferAmount: Balance;
		toAccountId: PerpetualsAccountId;
		tx?: Transaction;
	}) {
		const { transferAmount, toAccountId, tx } = inputs;

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
				walletAddress: this.ownerAddress(),
				collateralCoinType: this.accountCap.collateralCoinType,
				fromAccountId: this.accountCap.accountId,
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

	public async getPlaceMarketOrderTx(
		inputs: SdkPerpetualsPlaceMarketOrderInputs
	) {
		const { tx: txFromInputs, slTp, ...otherInputs } = inputs;

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
				slTp: slTp
					? {
							walletAddress: this.ownerAddress(),
							...slTp,
					  }
					: undefined,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
				hasPosition:
					this.positionForMarketId(otherInputs) !== undefined,
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async getPlaceLimitOrderTx(
		inputs: SdkPerpetualsPlaceLimitOrderInputs
	) {
		const { tx: txFromInputs, slTp, ...otherInputs } = inputs;

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
				slTp: slTp
					? {
							walletAddress: this.ownerAddress(),
							...slTp,
					  }
					: undefined,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
				hasPosition:
					this.positionForMarketId(otherInputs) !== undefined,
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async getCancelOrdersTx(inputs: {
		tx?: Transaction;
		marketIdsToData: Record<
			PerpetualsMarketId,
			{
				orderIds: PerpetualsOrderId[];
				collateralChange: number;
				leverage: number;
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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

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
					  }
					: {
							accountId: this.accountCap.accountId,
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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async getReduceOrderTx(inputs: {
		tx?: Transaction;
		collateralChange: number;
		marketId: PerpetualsMarketId;
		orderId: PerpetualsOrderId;
		sizeToSubtract: bigint;
		leverage?: number;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsReduceOrderBody,
			ApiTransactionResponse
		>(
			`${this.vaultId ? "vault" : "account"}/` +
				"transactions/reduce-order",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.ownerAddress(),
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

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
					  }
					: {
							accountId: this.accountCap.accountId,
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

	public async getClosePositionTx(inputs: {
		size: bigint;
		market: PerpetualsMarket;
		orderDatas: PerpetualsOrderData[];
		indexPrice: number;
		collateralPrice: number;
	}) {
		return this.getPlaceMarketOrderTx({
			...this.closePositionTxInputs(inputs),
		});
	}

	// =========================================================================
	//  Interactions
	// =========================================================================

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
	// 			positionAfterOrder: PerpetualsPosition;
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

	public async getPlaceMarketOrderPreview(
		inputs: SdkPerpetualsPlaceMarketOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<
		| {
				error: string;
		  }
		| {
				positionAfterOrder: PerpetualsPosition;
				priceSlippage: number;
				percentSlippage: Percentage;
				filledSize: number;
				filledSizeUsd: number;
				postedSize: number;
				postedSizeUsd: number;
				collateralChange: number;
				executionPrice: number;
		  }
	> {
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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
				collateralCoinType: this.accountCap.collateralCoinType,
			},
			abortSignal
		);
	}

	public async getPlaceLimitOrderPreview(
		inputs: SdkPerpetualsPlaceLimitOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<
		| {
				error: string;
		  }
		| {
				positionAfterOrder: PerpetualsPosition;
				priceSlippage: number;
				percentSlippage: Percentage;
				filledSize: number;
				filledSizeUsd: number;
				postedSize: number;
				postedSizeUsd: number;
				collateralChange: number;
				executionPrice: number;
		  }
	> {
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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
				collateralCoinType: this.accountCap.collateralCoinType,
			},
			abortSignal
		);
	}

	public async getCancelOrdersPreview(
		inputs: SdkPerpetualsCancelOrdersPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<
		| {
				marketIdsToPositionAfterCancelOrders: Record<
					PerpetualsMarketId,
					PerpetualsPosition
				>;
				collateralChange: number;
		  }
		| {
				error: string;
		  }
	> {
		// NOTE: should this case return an error instead ?
		if (Object.keys(inputs.marketIdsToData).length <= 0)
			return {
				collateralChange: 0,
				marketIdsToPositionAfterCancelOrders: {},
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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
				collateralCoinType: this.accountCap.collateralCoinType,
			},
			abortSignal
		);
	}

	public async getReduceOrderPreview(
		inputs: {
			marketId: PerpetualsMarketId;
			orderId: PerpetualsOrderId;
			sizeToSubtract: bigint;
			leverage?: number;
		},
		abortSignal?: AbortSignal
	): Promise<
		| {
				positionAfterReduceOrder: PerpetualsPosition;
				collateralChange: number;
		  }
		| {
				error: string;
		  }
	> {
		return this.fetchApi<
			ApiPerpetualsPreviewReduceOrderResponse,
			ApiPerpetualsPreviewReduceOrderBody
		>(
			`${this.vaultId ? "vault" : "account"}/` + "previews/reduce-order",
			{
				...inputs,
				...("vaultId" in this.accountCap
					? {
							vaultId: this.accountCap.vaultId,
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
				collateralCoinType: this.accountCap.collateralCoinType,
			},
			abortSignal
		);
	}

	public async getSetLeveragePreview(
		inputs: {
			marketId: PerpetualsMarketId;
			leverage: number;
		},
		abortSignal?: AbortSignal
	): Promise<
		| {
				positionAfterSetLeverage: PerpetualsPosition;
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
					  }
					: {
							accountId: this.accountCap.accountId,
					  }),
				collateralCoinType: this.accountCap.collateralCoinType,
			},
			abortSignal
		);
	}

	public async getOrderDatas(): Promise<PerpetualsOrderData[]> {
		const orderDatas = this.account.positions.reduce(
			(acc, position) => [
				...acc,
				...position.pendingOrders.map((order) => ({
					orderId: order.orderId,
					currentSize: order.size,
				})),
			],
			[] as {
				orderId: PerpetualsOrderId;
				currentSize: bigint;
			}[]
		);
		if (orderDatas.length <= 0) return [];

		return this.fetchApi<
			PerpetualsOrderData[],
			ApiPerpetualsAccountOrderDatasBody
		>("account/order-datas", {
			accountId: this.accountCap.accountId,
			orderDatas,
		});
	}

	public async getStopOrderDatas(inputs: {
		bytes: string;
		signature: string;
		marketIds?: PerpetualsMarketId[];
	}): Promise<PerpetualsStopOrderData[]> {
		const { bytes, signature, marketIds } = inputs;

		return this.fetchApi<
			PerpetualsStopOrderData[],
			ApiPerpetualsAccountStopOrderDatasBody
		>("account/stop-order-datas", {
			bytes,
			signature,
			accountId: this.accountCap.accountId,
			walletAddress: this.ownerAddress(),
			marketIds: marketIds ?? [],
		});
	}

	public async getCollateralHistory(
		inputs: ApiDataWithCursorBody<Timestamp>
	) {
		return this.fetchApi<
			PerpetualsAccountCollateralChangesWithCursor,
			ApiPerpetualsAccountCollateralHistoryBody
		>("account/collateral-history", {
			...inputs,
			accountId: this.accountCap.accountId,
			collateralCoinType: this.accountCap.collateralCoinType,
		});
	}

	public async getOrderHistory(inputs: ApiDataWithCursorBody<Timestamp>) {
		return this.fetchApi<
			PerpetualsAccountTradesWithCursor,
			ApiPerpetualsAccountOrderHistoryBody
		>("account/trade-history", {
			...inputs,
			accountId: this.accountCap.accountId,
		});
	}

	public async getMarginHistory() {
		return this.fetchApi<
			PerpetualsAccountMarginData[],
			ApiPerpetualsAccountMarginHistoryBody
		>("account/margin-history", {
			accountId: this.accountCap.accountId,
			collateralCoinType: this.accountCap.collateralCoinType,
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

	// =========================================================================
	//  Calculations
	// =========================================================================

	public calcFreeCollateralForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			inputs.market.emptyPosition();

		const funding = this.calcUnrealizedFundingsForPosition(inputs);
		const { pnl, minInitialMargin } =
			this.calcPnLAndMarginForPosition(inputs);

		let collateralUsd = position.collateral * inputs.collateralPrice;

		collateralUsd += funding;

		let cappedMargin;
		if (pnl < 0) {
			cappedMargin = collateralUsd + pnl;
		} else {
			cappedMargin = collateralUsd;
		}

		if (cappedMargin >= minInitialMargin) {
			return (cappedMargin - minInitialMargin) / inputs.collateralPrice;
		} else return 0;
	};

	public calcMarginRatioAndLeverageForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): {
		marginRatio: number;
		leverage: number;
	} => {
		const { market, indexPrice, collateralPrice } = inputs;
		const marketId = market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			market.emptyPosition();

		const funding = this.calcUnrealizedFundingsForPosition({
			market,
			position,
		});
		const collateralUsd = position?.collateral * collateralPrice + funding;

		const { pnl, netAbsBaseValue } = this.calcPnLAndMarginForPosition({
			market,
			indexPrice,
			position,
		});

		const marginRatio =
			netAbsBaseValue === 0 ? 0 : (collateralUsd + pnl) / netAbsBaseValue;
		const leverage = marginRatio === 0 ? 0 : 1 / marginRatio;

		return {
			marginRatio,
			leverage,
		};
	};

	public calcUnrealizedFundings = (inputs: {
		markets: PerpetualsMarket[];
	}): number => {
		let totalFunding = 0;

		inputs.markets.forEach((market) => {
			totalFunding += this.calcUnrealizedFundingsForPosition({
				market,
			});
		});

		return totalFunding;
	};

	public calcUnrealizedFundingsForPosition = (inputs: {
		market: PerpetualsMarket;
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;

		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			inputs.market.emptyPosition();

		const baseAmount = position.baseAssetAmount;
		const isLong = Math.sign(baseAmount);

		if (isLong < 0) {
			const fundingShort = position.cumFundingRateShort;
			const marketFundingShort =
				inputs.market.marketState.cumFundingRateShort;
			return -baseAmount * (marketFundingShort - fundingShort);
		} else {
			const fundingLong = position.cumFundingRateLong;
			const marketFundingLong =
				inputs.market.marketState.cumFundingRateLong;
			return -baseAmount * (marketFundingLong - fundingLong);
		}
	};

	public calcPnLAndMarginForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		position?: PerpetualsPosition;
	}): {
		pnl: number;
		minInitialMargin: number;
		minMaintenanceMargin: number;
		netAbsBaseValue: number;
	} => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			inputs.market.emptyPosition();

		const marginRatioInitial = 1 / (position.leverage || 1);
		// const marginRatioInitial = inputs.market.initialMarginRatio();
		const marginRatioMaintenance =
			inputs.market.marketParams.marginRatioMaintenance;
		const baseAssetAmount = position.baseAssetAmount;
		const quoteAssetAmount = position.quoteAssetNotionalAmount;
		const bidsQuantity = position.bidsQuantity;
		const asksQuantity = position.asksQuantity;
		const pnl = baseAssetAmount * inputs.indexPrice - quoteAssetAmount;

		const netAbs = Math.max(
			Math.abs(baseAssetAmount + bidsQuantity),
			Math.abs(baseAssetAmount - asksQuantity)
		);

		const netAbsBaseValue = netAbs * inputs.indexPrice;
		const minInitialMargin = netAbsBaseValue * marginRatioInitial;
		const minMaintenanceMargin = netAbsBaseValue * marginRatioMaintenance;

		return { pnl, minInitialMargin, minMaintenanceMargin, netAbsBaseValue };
	};

	public calcLiquidationPriceForPosition = (inputs: {
		market: PerpetualsMarket;
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			inputs.market.emptyPosition();

		const funding = this.calcUnrealizedFundingsForPosition(inputs);

		const baseAssetAmount = position.baseAssetAmount;
		const quoteAssetAmount = position.quoteAssetNotionalAmount;

		const numerator =
			position.collateral * inputs.collateralPrice +
			funding -
			quoteAssetAmount;

		const MMR = inputs.market.marketParams.marginRatioMaintenance;
		const bidsQuantity = position.bidsQuantity;
		const asksQuantity = position.asksQuantity;
		const netAbs = Math.max(
			Math.abs(baseAssetAmount + bidsQuantity),
			Math.abs(baseAssetAmount - asksQuantity)
		);

		const denominator = netAbs * MMR - baseAssetAmount;
		if (!denominator) return 0;

		const liquidationPrice = numerator / denominator;
		return liquidationPrice <= 0 ? 0 : liquidationPrice;
	};

	public calcFreeMarginUsdForPosition = (inputs: {
		market: PerpetualsMarket;
		indexPrice: number;
		collateralPrice: number;
		position?: PerpetualsPosition;
	}): number => {
		const marketId = inputs.market.marketId;
		const position =
			inputs.position ??
			this.positionForMarketId({ marketId }) ??
			inputs.market.emptyPosition();

		const totalFunding = this.calcUnrealizedFundingsForPosition(inputs);

		const { pnl, minInitialMargin } =
			this.calcPnLAndMarginForPosition(inputs);

		let collateralUsd = position.collateral * inputs.collateralPrice;

		const margin = collateralUsd + totalFunding + pnl;

		if (margin >= minInitialMargin) {
			return margin - minInitialMargin;
		} else return 0;
	};

	public calcAccountState = (inputs: {
		markets: PerpetualsMarket[];
		indexPrices: number[];
		collateralPrice: number;
	}): {
		accountEquity: number;
		totalPnL: number;
		totalFunding: number;
		totalCollateralAllocated: number;
	} => {
		const zipped = Helpers.zip(inputs.markets, inputs.indexPrices);
		let accountEquity = 0;
		let totalPnL = 0;
		let totalFunding = 0;
		let totalCollateralAllocated = 0;

		zipped.forEach(([market, indexPrice]) => {
			const marketId = market.marketId;
			const position =
				this.positionForMarketId({ marketId }) ??
				market.emptyPosition();

			const funding = this.calcUnrealizedFundingsForPosition({
				market,
				position,
			});

			const { pnl } = this.calcPnLAndMarginForPosition({
				market,
				indexPrice,
				position,
			});

			let collateralUsd = position.collateral * inputs.collateralPrice;

			totalPnL += pnl;
			totalFunding += funding;
			totalCollateralAllocated += collateralUsd;
			accountEquity += collateralUsd + funding + pnl;
		});
		return {
			accountEquity,
			totalPnL,
			totalFunding,
			totalCollateralAllocated,
		};
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

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

	public slTpStopOrderDatas(inputs: {
		stopOrderDatas: PerpetualsStopOrderData[];
	}): PerpetualsStopOrderData[] | undefined {
		const { stopOrderDatas } = inputs;

		let slTpOrders: PerpetualsStopOrderData[] = [];

		for (const { marketId } of this.account.positions) {
			const { fullSlTpOrder, partialSlTpOrders } =
				this.slTpStopOrderDatasForMarketId({
					marketId,
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

	public nonSlTpStopOrderDatasForMarketId(inputs: {
		marketId: PerpetualsMarketId;
		stopOrderDatas: PerpetualsStopOrderData[];
	}): PerpetualsStopOrderData[] | undefined {
		const { marketId, stopOrderDatas } = inputs;

		const position = this.positionForMarketId({ marketId });
		if (!position) return undefined;

		const { fullSlTpOrder, partialSlTpOrders } =
			this.slTpStopOrderDatasForMarketId(inputs);

		const stopOrders = stopOrderDatas.filter(
			(stopOrder) =>
				![
					...(fullSlTpOrder ? [fullSlTpOrder] : []),
					...(partialSlTpOrders ?? []),
				]
					.map((slTpOrder) => JSON.stringify(slTpOrder))
					.includes(JSON.stringify(stopOrder))
		);
		return stopOrders.length <= 0 ? undefined : stopOrders;
	}

	public slTpStopOrderDatasForMarketId(inputs: {
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

		// TODO: clean this up
		const fullSlTpOrder: PerpetualsStopOrderData | undefined =
			stopOrderDatas.find(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
					(order.slTp.stopLossIndexPrice ||
						order.slTp.takeProfitIndexPrice) &&
					order.size >= Casting.i64MaxBigInt
			);

		const partialSlTpOrders: PerpetualsStopOrderData[] =
			stopOrderDatas.filter(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
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

	public collateral(): number {
		return this.account.availableCollateral;
	}

	public collateralDecimals(): CoinDecimal {
		return this.accountCap.collateralDecimals;
	}

	public collateralBalance(): Balance {
		return Coin.normalizeBalance(
			this.collateral(),
			this.collateralDecimals()
		);
	}

	public isVault(): boolean {
		return this.isVault !== undefined;
	}

	public ownerAddress(): SuiAddress {
		return "walletAddress" in this.accountCap
			? // TODO: change to ownerAddress ?
			  this.accountCap.walletAddress
			: this.accountCap.ownerAddress;
	}

	public accountObjectId(): ObjectId {
		return this.accountCap.accountObjectId;
	}

	public accountId(): PerpetualsAccountId {
		return this.accountCap.accountId;
	}

	// TODO: make this work with vaults
	public accountCapId(): ObjectId {
		if ("vaultId" in this.accountCap)
			throw new Error(
				"not account cap id present on vault owned account"
			);
		return this.accountCap.objectId;
	}

	public closePositionTxInputs = (inputs: {
		size: bigint;
		market: PerpetualsMarket;
		orderDatas: PerpetualsOrderData[];
		indexPrice: number;
		collateralPrice: number;
	}): SdkPerpetualsPlaceMarketOrderInputs => {
		const { size, market, orderDatas, collateralPrice } = inputs;

		const marketId = market.marketId;
		const position =
			this.positionForMarketId({ marketId }) ?? market.emptyPosition();

		// TODO: move conversion to helper function, since used often
		const ordersCollateral = Helpers.sum(
			orderDatas
				.filter((orderData) => orderData.marketId === market.marketId)
				.map(
					(orderData) =>
						market.calcCollateralUsedForOrder({
							...inputs,
							orderData,
							leverage: position.leverage,
						}).collateral
				)
		);

		const fullPositionCollateralChange =
			Math.max(
				this.calcFreeMarginUsdForPosition(inputs) / collateralPrice -
					ordersCollateral *
						(1 -
							PerpetualsAccount.constants
								.closePositionMarginOfError),
				0
			) * -1;

		// NOTE: is this safe / correct ?
		const collateralChange =
			Number(fullPositionCollateralChange) *
			(Number(size) /
				Casting.Fixed.fixedOneN9 /
				position.baseAssetAmount);

		const positionSide = Perpetuals.positionSide(position);
		return {
			size,
			marketId,
			collateralChange,
			// leverage: position.leverage || 1,
			// leverage: undefined,
			side:
				positionSide === PerpetualsOrderSide.Bid
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			// hasPosition: this.positionForMarketId({ marketId }) !== undefined,
			reduceOnly: true,
		};
	};
}
