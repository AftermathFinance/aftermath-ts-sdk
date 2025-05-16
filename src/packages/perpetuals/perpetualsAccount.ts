import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsLimitOrderBody,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsPreviewOrderBody,
	ApiPerpetualsPreviewOrderResponse,
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
	ApiPerpetualsSetPositionLeverageBody,
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
	ApiPerpetualsSetLeverageBody,
	TransactionDigest,
	ApiPerpetualsSetPositionLeverageFromTxBody,
	CallerConfig,
	SdkPerpetualsPlaceOrderPreviewInputs,
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
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { Perpetuals } from "./perpetuals";
import { Coin } from "..";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Transaction } from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { TransactionsApiHelpers } from "../../general/apiHelpers/transactionsApiHelpers";
import { TransactionObjectArgument } from "@mysten/sui.js/transactions";

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

	public async getDepositCollateralTx(inputs: {
		packageId: PackageId;
		amount: Balance;
		isSponsoredTx?: boolean;
	}) {
		// return this.fetchApiTransaction<ApiPerpetualsDepositCollateralBody>(
		// 	"transactions/deposit-collateral",
		// 	{
		// 		...inputs,
		// 		collateralCoinType: this.accountCap.collateralCoinType,
		// 		accountCapId: this.accountCap.objectId,
		// 	}
		// );
		return this.useProvider().fetchBuildDepositCollateralTx({
			...inputs,
			walletAddress: this.accountCap.walletAddress,
			collateralCoinType: this.accountCap.collateralCoinType,
			accountCapId: this.accountCap.objectId,
		});
	}

	public async getWithdrawCollateralTx(inputs: { amount: Balance }) {
		// return this.fetchApiTransaction<ApiPerpetualsWithdrawCollateralBody>(
		// 	"transactions/withdraw-collateral",
		// 	{
		// 		...inputs,
		// 		collateralCoinType: this.accountCap.collateralCoinType,
		// 		accountCapId: this.accountCap.objectId,
		// 	}
		// );
		return this.useProvider().buildWithdrawCollateralTx({
			...inputs,
			walletAddress: this.accountCap.walletAddress,
			collateralCoinType: this.accountCap.collateralCoinType,
			accountCapId: this.accountCap.objectId,
		});
	}

	public async getAllocateCollateralTx(inputs: {
		market: PerpetualsMarket;
		amount: Balance;
	}) {
		const { market } = inputs;
		// return this.fetchApiTransaction<ApiPerpetualsAllocateCollateralBody>(
		// 	"transactions/allocate-collateral",
		// 	{
		// 		...inputs,
		// 		packageId: market.marketData.packageId,
		// 		marketInitialSharedVersion:
		// 			market.marketData.initialSharedVersion,
		// 		marketId: market.marketId,
		// 		collateralCoinType: this.accountCap.collateralCoinType,
		// 		accountCapId: this.accountCap.objectId,
		// 	}
		// );
		return this.useProvider().buildAllocateCollateralTx({
			...inputs,
			walletAddress: this.accountCap.walletAddress,
			packageId: market.marketData.packageId,
			marketInitialSharedVersion: market.marketData.initialSharedVersion,
			marketId: market.marketId,
			collateralCoinType: this.accountCap.collateralCoinType,
			accountCapId: this.accountCap.objectId,
		});
	}

	public async getDeallocateCollateralTx(inputs: {
		market: PerpetualsMarket;
		amount: Balance;
	}) {
		const { market } = inputs;
		// return this.fetchApiTransaction<ApiPerpetualsDeallocateCollateralBody>(
		// 	"transactions/deallocate-collateral",
		// 	{
		// 		...inputs,
		// 		packageId: market.marketData.packageId,
		// 		marketInitialSharedVersion:
		// 			market.marketData.initialSharedVersion,
		// 		marketId: market.marketId,
		// 		basePriceFeedId: market.marketParams.basePriceFeedId,
		// 		collateralPriceFeedId:
		// 			market.marketParams.collateralPriceFeedId,
		// 		collateralCoinType: this.accountCap.collateralCoinType,
		// 		accountCapId: this.accountCap.objectId,
		// 	}
		// );
		return this.useProvider().buildDeallocateCollateralTx({
			...inputs,
			walletAddress: this.accountCap.walletAddress,
			packageId: market.marketData.packageId,
			marketInitialSharedVersion: market.marketData.initialSharedVersion,
			marketId: market.marketId,
			basePriceFeedId: market.marketParams.basePriceFeedId,
			collateralPriceFeedId: market.marketParams.collateralPriceFeedId,
			collateralCoinType: this.accountCap.collateralCoinType,
			accountCapId: this.accountCap.objectId,
		});
	}

	public async getTransferCollateralTx(inputs: {
		amount: Balance;
		toAccountCapId: ObjectId;
	}) {
		// return this.fetchApiTransaction<ApiPerpetualsTransferCollateralBody>(
		// 	"transactions/transfer-collateral",
		// 	{
		// 		...inputs,
		// 		collateralCoinType: this.accountCap.collateralCoinType,
		// 		fromAccountCapId: this.accountCap.objectId,
		// 	}
		// );
		return this.useProvider().buildTransferCollateralTx({
			...inputs,
			walletAddress: this.accountCap.walletAddress,
			collateralCoinType: this.accountCap.collateralCoinType,
			fromAccountCapId: this.accountCap.objectId,
		});
	}

	// =========================================================================
	//  Order Txs
	// =========================================================================

	public async getPlaceMarketOrderTx(
		inputs: SdkPerpetualsPlaceMarketOrderInputs
	) {
		const {
			tx: txFromInputs,
			slTp,
			isSponsoredTx,
			...otherInputs
		} = inputs;

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.accountCap.walletAddress);

		const slTpArgs = await this.getSlTpArgs({
			tx,
			isSponsoredTx,
			stopLoss: slTp && "stopLoss" in slTp ? slTp.stopLoss : undefined,
			takeProfit:
				slTp && "takeProfit" in slTp ? slTp.takeProfit : undefined,
			// TODO: take this as an arg instead ?
			walletAddress: this.accountCap.walletAddress,
		});

		return this.fetchApiTransaction<ApiPerpetualsMarketOrderBody>(
			"transactions/place-market-order",
			{
				...otherInputs,
				...slTpArgs,
				txKind: await this.getTxKind({ tx }),
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
		const {
			tx: txFromInputs,
			slTp,
			isSponsoredTx,
			...otherInputs
		} = inputs;

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.accountCap.walletAddress);

		const slTpArgs = await this.getSlTpArgs({
			tx,
			isSponsoredTx,
			stopLoss: slTp && "stopLoss" in slTp ? slTp.stopLoss : undefined,
			takeProfit:
				slTp && "takeProfit" in slTp ? slTp.takeProfit : undefined,
			// TODO: take this as an arg instead ?
			walletAddress: this.accountCap.walletAddress,
		});

		return this.fetchApiTransaction<ApiPerpetualsLimitOrderBody>(
			"transactions/place-limit-order",
			{
				...otherInputs,
				...slTpArgs,
				txKind: await this.getTxKind({ tx }),
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
				collateralChange: Balance;
				leverage: number;
			}
		>;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsCancelOrdersBody>(
			"transactions/cancel-orders",
			{
				...otherInputs,
				txKind: await this.getTxKind({ tx }),
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
				txKind: await this.getTxKind({ tx }),
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
		const { tx: txFromInputs, isSponsoredTx, stopOrders } = inputs;

		const tx = txFromInputs ?? new Transaction();
		// tx.setSender(this.accountCap.walletAddress);

		if (!this.Provider) throw new Error("missing AftermathApi Provider");
		// TODO: handle case of user passed gas coin object(s)
		const gasCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			isSponsoredTx,
			coinType: Coin.constants.suiCoinType,
			walletAddress: this.accountCap.walletAddress,
			coinAmount: Perpetuals.constants.stopOrderGasCostSUI,
		});

		return this.fetchApiTransaction<ApiPerpetualsPlaceStopOrdersBody>(
			"transactions/place-stop-orders",
			{
				stopOrders,
				marketId: inputs.marketId,
				gasCoin: TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
					coinTxArg: gasCoin,
				}),
				txKind: await this.getTxKind({ tx }),
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

		const slTpOrders = [
			...("stopLoss" in inputs ? [inputs.stopLoss] : []),
			...("takeProfit" in inputs ? [inputs.takeProfit] : []),
		];

		if (!this.Provider) throw new Error("missing AftermathApi Provider");
		// TODO: handle case of user passed gas coin object(s)
		const gasCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			isSponsoredTx,
			coinType: Coin.constants.suiCoinType,
			walletAddress: this.accountCap.walletAddress,
			coinAmount:
				Perpetuals.constants.stopOrderGasCostSUI *
				BigInt(slTpOrders.length),
		});

		return this.fetchApiTransaction<ApiPerpetualsPlaceSlTpOrdersBody>(
			"transactions/place-sl-tp-orders",
			{
				...slTpInputs,
				marketId,
				txKind: await this.getTxKind({ tx }),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
				gasCoin: TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
					coinTxArg: gasCoin,
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
		// tx.setSender(this.accountCap.walletAddress);

		return this.fetchApiTransaction<ApiPerpetualsEditStopOrdersBody>(
			"transactions/edit-stop-orders",
			{
				stopOrders,
				txKind: await this.getTxKind({ tx }),
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
		collateralChange: Balance;
		marketId: PerpetualsMarketId;
		orderId: PerpetualsOrderId;
		sizeToSubtract: bigint;
	}) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTransaction<ApiPerpetualsReduceOrderBody>(
			"transactions/reduce-order",
			{
				...otherInputs,
				txKind: await this.getTxKind({ tx }),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
				leverage:
					this.positionForMarketId({ marketId: otherInputs.marketId })
						?.leverage || 1,
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async executeSetLeverageTx(inputs: {
		tx?: Transaction;
		leverage: number;
		collateralChange: Balance;
		marketId: PerpetualsMarketId;
		executeTxCallback: (args: { tx: Transaction }) => Promise<{
			txDigest: TransactionDigest;
		}>;
	}): Promise<void> {
		const { leverage, tx: txFromInputs, ...otherInputs } = inputs;

		if (inputs.collateralChange === BigInt(0))
			throw new Error("collateralChange cannot be 0");

		const tx = await this.fetchApiTransaction<ApiPerpetualsSetLeverageBody>(
			"transactions/set-leverage",
			{
				...otherInputs,
				leverage,
				txKind: await (async () => {
					if (!txFromInputs) return;

					const txBytes = await txFromInputs.build({
						// NOTE: is this safe ?
						client: this.Provider?.provider,
						onlyTransactionKind: true,
					});
					return Buffer.from(txBytes).toString("base64");
				})(),
				walletAddress: this.accountCap.walletAddress,
				accountObjectId: this.accountCap.objectId,
			},
			undefined,
			{
				txKind: true,
			}
		);
		const { txDigest } = await inputs.executeTxCallback({ tx });

		await this.fetchApi<void, ApiPerpetualsSetPositionLeverageFromTxBody>(
			"account/set-position-leverage-from-tx",
			{
				txDigest,
				leverage,
				accountId: this.accountCap.accountId,
				marketId: inputs.marketId,
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

	public async setPositionLeverage(inputs: {
		bytes: string;
		signature: string;
	}): Promise<boolean> {
		return this.fetchApi<boolean, ApiPerpetualsSetPositionLeverageBody>(
			"account/set-position-leverage",
			{
				...inputs,
				walletAddress: this.accountCap.walletAddress,
			}
		);
	}

	// public async getAllPositionLeverages(): Promise<
	// 	{
	// 		marketId: PerpetualsMarketId;
	// 		leverage: number;
	// 	}[]
	// > {
	// 	return this.fetchApi(
	// 		`${this.accountCap.collateralCoinType}/accounts/${this.accountCap.accountId}/position-leverages`
	// 	);
	// }

	public async getPositionLeverages(inputs: {
		marketIds: PerpetualsMarketId[];
	}): Promise<number[]> {
		// if (inputs.marketIds.length <= 0) return [];
		return this.fetchApi("account/position-leverages", {
			...inputs,
			accountId: this.accountCap.accountId,
		});
	}

	public setPositionLeverageMessageToSign(inputs: {
		marketId: PerpetualsMarketId;
		leverage: number;
	}): {
		account_id: number;
		market_id: PerpetualsMarketId;
		leverage: number;
	} {
		return {
			account_id: Number(this.accountCap.accountId),
			market_id: inputs.marketId,
			leverage: inputs.leverage,
		};
	}

	public async getPlaceOrderPreview(
		inputs: SdkPerpetualsPlaceOrderPreviewInputs,
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
				collateralChange: Balance;
				executionPrice: number;
		  }
	> {
		return this.fetchApi<
			ApiPerpetualsPreviewOrderResponse,
			ApiPerpetualsPreviewOrderBody
		>(
			"previews/place-order",
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
				collateralChange: Balance;
		  }
		| {
				error: string;
		  }
	> {
		// NOTE: should this case return an error instead ?
		if (Object.keys(inputs.marketIdsToData).length <= 0)
			return {
				collateralChange: BigInt(0),
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
		},
		abortSignal?: AbortSignal
	): Promise<
		| {
				positionAfterReduceOrder: PerpetualsPosition;
				collateralChange: Balance;
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
				leverage:
					this.positionForMarketId({ marketId: inputs.marketId })
						?.leverage || 1,
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
				collateralChange: Balance;
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
			side === undefined || !position
				? // TODO: check if at least one order present ? -- if only one order then use that side ?
				  stopOrderDatas.find(
						(order) =>
							order.marketId === marketId &&
							// order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							// order.triggerIfGeStopIndexPrice ===
							// 	(side === PerpetualsOrderSide.Ask) &&
							order.size >= Casting.u64MaxBigInt &&
							// (side === PerpetualsOrderSide.Bid
							// 	? order.stopIndexPrice < indexPrice
							// 	: order.stopIndexPrice > indexPrice)

							((!order.triggerIfGeStopIndexPrice &&
								// order.stopIndexPrice < indexPrice &&
								order.side === PerpetualsOrderSide.Ask) ||
								(order.triggerIfGeStopIndexPrice &&
									// order.stopIndexPrice > indexPrice &&
									order.side === PerpetualsOrderSide.Bid)) &&
							order.reduceOnly
				  )
				: stopOrderDatas.find(
						(order) =>
							order.marketId === marketId &&
							order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							order.triggerIfGeStopIndexPrice ===
								(side === PerpetualsOrderSide.Ask) &&
							order.size >= Casting.u64MaxBigInt &&
							(side === PerpetualsOrderSide.Bid
								? order.stopIndexPrice <
								  Perpetuals.calcEntryPrice(position)
								: order.stopIndexPrice >
								  Perpetuals.calcEntryPrice(position)) &&
							order.reduceOnly
				  );
		const fullTpOrder: PerpetualsStopOrderData | undefined =
			side === undefined || !position
				? // TODO: check if at least one order present ? -- if only one order then use that side ?
				  stopOrderDatas.find(
						(order) =>
							order.marketId === marketId &&
							// order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							// order.triggerIfGeStopIndexPrice ===
							// 	(side === PerpetualsOrderSide.Bid) &&
							order.size >= Casting.u64MaxBigInt &&
							// (side === PerpetualsOrderSide.Bid
							// 	? order.stopIndexPrice > indexPrice
							// 	: order.stopIndexPrice < indexPrice)

							((!order.triggerIfGeStopIndexPrice &&
								// order.stopIndexPrice < indexPrice &&
								order.side === PerpetualsOrderSide.Bid) ||
								(order.triggerIfGeStopIndexPrice &&
									// order.stopIndexPrice > indexPrice &&
									order.side === PerpetualsOrderSide.Ask)) &&
							order.reduceOnly
				  )
				: stopOrderDatas.find(
						(order) =>
							order.marketId === marketId &&
							order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							order.triggerIfGeStopIndexPrice ===
								(side === PerpetualsOrderSide.Bid) &&
							order.size >= Casting.u64MaxBigInt &&
							(side === PerpetualsOrderSide.Bid
								? order.stopIndexPrice >
								  Perpetuals.calcEntryPrice(position)
								: order.stopIndexPrice <
								  Perpetuals.calcEntryPrice(position)) &&
							order.reduceOnly
				  );

		const partialSlOrders: PerpetualsStopOrderData[] =
			side === undefined || !position
				? // TODO: check if at least one order present ? -- if only one order then use that side ?
				  stopOrderDatas.filter(
						(order) =>
							order.marketId === marketId &&
							// order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							// order.triggerIfGeStopIndexPrice ===
							// 	(side === PerpetualsOrderSide.Ask) &&
							// (side === PerpetualsOrderSide.Bid
							// 	? order.stopIndexPrice < indexPrice
							// 	: order.stopIndexPrice > indexPrice)

							((!order.triggerIfGeStopIndexPrice &&
								// order.stopIndexPrice < indexPrice &&
								order.side === PerpetualsOrderSide.Ask) ||
								(order.triggerIfGeStopIndexPrice &&
									// order.stopIndexPrice > indexPrice &&
									order.side === PerpetualsOrderSide.Bid)) &&
							order.reduceOnly
				  )
				: stopOrderDatas.filter(
						(order) =>
							order.marketId === marketId &&
							order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							order.triggerIfGeStopIndexPrice ===
								(side === PerpetualsOrderSide.Ask) &&
							(side === PerpetualsOrderSide.Bid
								? order.stopIndexPrice <
								  Perpetuals.calcEntryPrice(position)
								: order.stopIndexPrice >
								  Perpetuals.calcEntryPrice(position)) &&
							order.reduceOnly
				  );

		const partialTpOrders: PerpetualsStopOrderData[] =
			side === undefined || !position
				? // TODO: check if at least one order present ? -- if only one order then use that side ?
				  stopOrderDatas.filter(
						(order) =>
							order.marketId === marketId &&
							// order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							// order.triggerIfGeStopIndexPrice ===
							// 	(side === PerpetualsOrderSide.Bid) &&
							// (side === PerpetualsOrderSide.Bid
							// 	? order.stopIndexPrice > indexPrice
							// 	: order.stopIndexPrice < indexPrice)

							((!order.triggerIfGeStopIndexPrice &&
								// order.stopIndexPrice < indexPrice &&
								order.side === PerpetualsOrderSide.Bid) ||
								(order.triggerIfGeStopIndexPrice &&
									// order.stopIndexPrice > indexPrice &&
									order.side === PerpetualsOrderSide.Ask)) &&
							order.reduceOnly
				  )
				: stopOrderDatas.filter(
						(order) =>
							order.marketId === marketId &&
							order.side !== side &&
							!("limitOrder" in order) &&
							order.expiryTimestamp >=
								BigInt(Number.MAX_SAFE_INTEGER) &&
							order.triggerIfGeStopIndexPrice ===
								(side === PerpetualsOrderSide.Bid) &&
							(side === PerpetualsOrderSide.Bid
								? order.stopIndexPrice >
								  Perpetuals.calcEntryPrice(position)
								: order.stopIndexPrice <
								  Perpetuals.calcEntryPrice(position)) &&
							order.reduceOnly
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
		return Casting.IFixed.numberFromIFixed(this.accountCap.collateral);
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
		const collateralChange = BigInt(
			Math.round(
				Number(fullPositionCollateralChange) *
					(Number(size) / Number(positionSize))
			)
		);

		const positionSide = Perpetuals.positionSide(position);
		return {
			size,
			marketId,
			collateralChange,
			leverage: position.leverage || 1,
			side:
				positionSide === PerpetualsOrderSide.Bid
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			// hasPosition: this.positionForMarketId({ marketId }) !== undefined,
		};
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private async getSlTpArgs(inputs: {
		tx: Transaction;
		walletAddress: SuiAddress;
		stopLoss: PerpetualsSlTpOrderDetails | undefined;
		takeProfit: PerpetualsSlTpOrderDetails | undefined;
		isSponsoredTx: boolean | undefined;
	}): Promise<{
		slTp?: {
			walletAddress: SuiAddress;
			gasCoin: ServiceCoinData;
			stopLoss?: PerpetualsSlTpOrderDetails;
			takeProfit?: PerpetualsSlTpOrderDetails;
		};
	}> {
		const { tx, walletAddress, stopLoss, takeProfit, isSponsoredTx } =
			inputs;

		if (!stopLoss && !takeProfit) return {};

		if (!this.Provider) throw new Error("missing AftermathApi Provider");
		const gasCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			isSponsoredTx,
			coinType: Coin.constants.suiCoinType,
			walletAddress: this.accountCap.walletAddress,
			coinAmount:
				Perpetuals.constants.stopOrderGasCostSUI *
				BigInt(stopLoss && takeProfit ? 2 : 1),
		});
		return {
			slTp: {
				walletAddress,
				stopLoss,
				takeProfit,
				gasCoin: TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
					coinTxArg: gasCoin,
				}),
			},
		};
	}

	private getTxKind = async (inputs: {
		tx: Transaction | undefined;
	}): Promise<SerializedTransaction | undefined> => {
		const { tx } = inputs;
		if (!tx) return;

		const txBytes = await tx.build({
			// NOTE: is this safe ?
			client: this.Provider?.provider,
			onlyTransactionKind: true,
		});
		return Buffer.from(txBytes).toString("base64");
	};

	private useProvider = () => {
		const provider = this.Provider?.Perpetuals();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
