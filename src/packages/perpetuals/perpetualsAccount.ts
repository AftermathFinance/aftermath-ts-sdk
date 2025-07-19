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
	PerpetualsSlTpOrderDetails,
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
	//  Constructor
	// =========================================================================

	constructor(
		public readonly account: PerpetualsAccountObject,
		public readonly accountCap: PerpetualsAccountCap,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals");
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
					coinInArg: TransactionObjectArgument;
			  }
		)
	) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsDepositCollateralBody>(
			"transactions/deposit-collateral",
			{
				...otherInputs,
				walletAddress: this.accountCap.walletAddress,
				collateralCoinType: this.accountCap.collateralCoinType,
				accountObjectId: this.accountCap.objectId,
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

		const { txKind, coinOutArg } = await this.fetchApi<
			ApiPerpetualsWithdrawCollateralResponse,
			ApiPerpetualsWithdrawCollateralBody
		>("transactions/withdraw-collateral", {
			withdrawAmount,
			recipientAddress,
			walletAddress: this.accountCap.walletAddress,
			collateralCoinType: this.accountCap.collateralCoinType,
			accountObjectId: this.accountCap.objectId,
			txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
				{
					tx: txFromInputs ?? new Transaction(),
				}
			),
		});

		const tx = Transaction.fromKind(txKind);
		tx.setSender(this.accountCap.walletAddress);

		return {
			tx,
			coinOutArg,
		};
	}

	public async getAllocateCollateralTx(inputs: {
		marketId: PerpetualsMarketId;
		allocateAmount: Balance;
		tx?: Transaction;
	}) {
		const { tx, allocateAmount, marketId } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsAllocateCollateralBody>(
			"transactions/allocate-collateral",
			{
				marketId,
				allocateAmount,
				accountObjectId: this.accountCap.objectId,
				walletAddress: this.accountCap.walletAddress,
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
		return this.fetchApiTransaction<ApiPerpetualsDeallocateCollateralBody>(
			"transactions/deallocate-collateral",
			{
				marketId,
				deallocateAmount,
				accountObjectId: this.accountCap.objectId,
				walletAddress: this.accountCap.walletAddress,
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
		toAccountObjectId: ObjectId;
		tx?: Transaction;
	}) {
		const { transferAmount, toAccountObjectId, tx } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsTransferCollateralBody>(
			"transactions/transfer-collateral",
			{
				transferAmount,
				toAccountObjectId,
				walletAddress: this.accountCap.walletAddress,
				collateralCoinType: this.accountCap.collateralCoinType,
				fromAccountObjectId: this.accountCap.objectId,
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
		// tx.setSender(this.accountCap.walletAddress);

		return this.fetchApiTransaction<ApiPerpetualsMarketOrderBody>(
			"transactions/place-market-order",
			{
				...otherInputs,
				slTp: slTp
					? {
							walletAddress: this.accountCap.walletAddress,
							...slTp,
					  }
					: undefined,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
		// tx.setSender(this.accountCap.walletAddress);

		return this.fetchApiTransaction<ApiPerpetualsLimitOrderBody>(
			"transactions/place-limit-order",
			{
				...otherInputs,
				slTp: slTp
					? {
							walletAddress: this.accountCap.walletAddress,
							...slTp,
					  }
					: undefined,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
		return this.fetchApiTransaction<ApiPerpetualsCancelOrdersBody>(
			"transactions/cancel-orders",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
		return this.fetchApiTransaction<ApiPerpetualsCancelStopOrdersBody>(
			"transactions/cancel-stop-orders",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
		// tx.setSender(this.accountCap.walletAddress);

		return this.fetchApiTransaction<ApiPerpetualsPlaceStopOrdersBody>(
			"transactions/place-stop-orders",
			{
				stopOrders,
				gasCoinArg,
				isSponsoredTx,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
		// tx.setSender(this.accountCap.walletAddress);

		return this.fetchApiTransaction<ApiPerpetualsPlaceSlTpOrdersBody>(
			"transactions/place-sl-tp-orders",
			{
				...slTpInputs,
				marketId,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
		// tx.setSender(this.accountCap.walletAddress);

		return this.fetchApiTransaction<ApiPerpetualsEditStopOrdersBody>(
			"transactions/edit-stop-orders",
			{
				stopOrders,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
		return this.fetchApiTransaction<ApiPerpetualsReduceOrderBody>(
			"transactions/reduce-order",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
	}): Promise<Transaction> {
		const { leverage, tx, collateralChange, marketId } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsSetLeverageTxBody>(
			"transactions/set-leverage",
			{
				leverage,
				marketId,
				collateralChange,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
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
	// 		"previews/place-order",
	// 		{
	// 			...inputs,
	// 			accountObjectId: this.accountCap.objectId,
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
			"previews/place-market-order",
			{
				...inputs,
				accountObjectId: this.accountCap.objectId,
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
			"previews/place-limit-order",
			{
				...inputs,
				accountObjectId: this.accountCap.objectId,
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
			"previews/cancel-orders",
			{
				...inputs,
				accountObjectId: this.accountCap.objectId,
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
			"previews/reduce-order",
			{
				...inputs,
				accountObjectId: this.accountCap.objectId,
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
			"previews/set-leverage",
			{
				marketId,
				leverage,
				accountObjectId: this.accountCap.objectId,
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
			walletAddress: this.accountCap.walletAddress,
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
		>("account/trade-history", {
			accountId: this.accountCap.accountId,
			collateralCoinType: this.accountCap.collateralCoinType,
		});
	}

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

		let collateralUsd =
			IFixedUtils.numberFromIFixed(position.collateral) *
			inputs.collateralPrice;

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
		const collateralUsd =
			IFixedUtils.numberFromIFixed(position?.collateral) *
				collateralPrice +
			funding;

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

		const baseAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const isLong = Math.sign(baseAmount);

		if (isLong < 0) {
			const fundingShort = IFixedUtils.numberFromIFixed(
				position.cumFundingRateShort
			);
			const marketFundingShort = IFixedUtils.numberFromIFixed(
				inputs.market.marketState.cumFundingRateShort
			);
			return -baseAmount * (marketFundingShort - fundingShort);
		} else {
			const fundingLong = IFixedUtils.numberFromIFixed(
				position.cumFundingRateLong
			);
			const marketFundingLong = IFixedUtils.numberFromIFixed(
				inputs.market.marketState.cumFundingRateLong
			);
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
		const marginRatioMaintenance = IFixedUtils.numberFromIFixed(
			inputs.market.marketParams.marginRatioMaintenance
		);
		const baseAssetAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const quoteAssetAmount = IFixedUtils.numberFromIFixed(
			position.quoteAssetNotionalAmount
		);
		const bidsQuantity = IFixedUtils.numberFromIFixed(
			position.bidsQuantity
		);
		const asksQuantity = IFixedUtils.numberFromIFixed(
			position.asksQuantity
		);
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

		const baseAssetAmount = IFixedUtils.numberFromIFixed(
			position.baseAssetAmount
		);
		const quoteAssetAmount = IFixedUtils.numberFromIFixed(
			position.quoteAssetNotionalAmount
		);

		const numerator =
			IFixedUtils.numberFromIFixed(position.collateral) *
				inputs.collateralPrice +
			funding -
			quoteAssetAmount;

		const MMR = IFixedUtils.numberFromIFixed(
			inputs.market.marketParams.marginRatioMaintenance
		);
		const bidsQuantity = IFixedUtils.numberFromIFixed(
			position.bidsQuantity
		);
		const asksQuantity = IFixedUtils.numberFromIFixed(
			position.asksQuantity
		);
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

		let collateralUsd =
			IFixedUtils.numberFromIFixed(position.collateral) *
			inputs.collateralPrice;

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

			let collateralUsd =
				IFixedUtils.numberFromIFixed(position.collateral) *
				inputs.collateralPrice;

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
			const {
				fullSlOrder,
				fullTpOrder,
				partialSlOrders,
				partialTpOrders,
			} = this.slTpStopOrderDatasForMarketId({
				marketId,
				stopOrderDatas,
			});
			slTpOrders = [
				...slTpOrders,
				...(fullSlOrder ? [fullSlOrder] : []),
				...(fullTpOrder ? [fullTpOrder] : []),
				...(partialSlOrders ?? []),
				...(partialTpOrders ?? []),
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

		const { fullSlOrder, fullTpOrder, partialSlOrders, partialTpOrders } =
			this.slTpStopOrderDatasForMarketId(inputs);

		const stopOrders = stopOrderDatas.filter(
			(stopOrder) =>
				![
					...(fullSlOrder ? [fullSlOrder] : []),
					...(fullTpOrder ? [fullTpOrder] : []),
					...(partialSlOrders ?? []),
					...(partialTpOrders ?? []),
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
		fullSlOrder: PerpetualsStopOrderData | undefined;
		fullTpOrder: PerpetualsStopOrderData | undefined;
		partialSlOrders: PerpetualsStopOrderData[] | undefined;
		partialTpOrders: PerpetualsStopOrderData[] | undefined;
	} {
		const { marketId, stopOrderDatas } = inputs;

		const position = this.positionForMarketId({ marketId });
		if (!position || position.baseAssetAmount === BigInt(0)) {
			return {
				fullSlOrder: undefined,
				fullTpOrder: undefined,
				partialSlOrders: undefined,
				partialTpOrders: undefined,
			};
		}

		const side = !position ? undefined : Perpetuals.positionSide(position);

		// TODO: clean this up
		const fullSlOrder: PerpetualsStopOrderData | undefined =
			stopOrderDatas.find(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
					order.slTp.isStopLoss &&
					order.size >= Casting.i64MaxBigInt
			);
		const fullTpOrder: PerpetualsStopOrderData | undefined =
			stopOrderDatas.find(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
					!order.slTp.isStopLoss &&
					order.size >= Casting.i64MaxBigInt
			);

		const partialSlOrders: PerpetualsStopOrderData[] =
			stopOrderDatas.filter(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
					order.slTp.isStopLoss &&
					order.size < Casting.i64MaxBigInt
			);

		const partialTpOrders: PerpetualsStopOrderData[] =
			stopOrderDatas.filter(
				(order) =>
					order.marketId === marketId &&
					order.slTp &&
					order.side !== side &&
					!order.slTp.isStopLoss &&
					order.size < Casting.i64MaxBigInt
			);

		return {
			fullSlOrder,
			fullTpOrder,
			partialSlOrders:
				partialSlOrders.length <= 0 ? undefined : partialSlOrders,
			partialTpOrders:
				partialTpOrders.length <= 0 ? undefined : partialTpOrders,
		};
	}

	public collateral(): number {
		return (
			Helpers.sum(
				this.account.positions.map((position) =>
					position.baseAssetAmount === BigInt(0)
						? Casting.IFixed.numberFromIFixed(position.collateral)
						: 0
				)
			) +
			Casting.IFixed.numberFromIFixed(this.accountCap.collateral) +
			Casting.IFixed.numberFromIFixed(
				this.accountCap.subAccount.collateral
			)
		);
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
		const ordersCollateral = Coin.normalizeBalance(
			Helpers.sum(
				orderDatas
					.filter(
						(orderData) => orderData.marketId === market.marketId
					)
					.map(
						(orderData) =>
							market.calcCollateralUsedForOrder({
								...inputs,
								orderData,
								leverage: position.leverage,
							}).collateral
					)
			),
			this.collateralDecimals()
		);

		const fullPositionCollateralChange =
			Helpers.maxBigInt(
				BigInt(
					Math.floor(
						Number(
							Coin.normalizeBalance(
								this.calcFreeMarginUsdForPosition(inputs) *
									collateralPrice,
								this.collateralDecimals()
							) - ordersCollateral
						) *
							(1 -
								PerpetualsAccount.constants
									.closePositionMarginOfError)
					)
				),
				BigInt(0)
			) * BigInt(-1);
		const positionSize = BigInt(
			Math.round(
				Math.abs(
					Casting.IFixed.numberFromIFixed(position.baseAssetAmount) /
						market.lotSize()
				)
			)
		);
		// NOTE: is this safe / correct ?
		const collateralChange = Coin.balanceWithDecimals(
			BigInt(
				Math.round(
					Number(fullPositionCollateralChange) *
						(Number(size) / Number(positionSize))
				)
			),
			this.collateralDecimals()
		);

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
