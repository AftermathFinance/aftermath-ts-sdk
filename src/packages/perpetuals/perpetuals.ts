import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	SuiNetwork,
	Url,
	PerpetualsMarketState,
	PerpetualsMarketData,
	PerpetualsAccountData,
	PerpetualsMarketId,
	ApiPerpetualsOwnedAccountCapsBody,
	PerpetualsPosition,
	PerpetualsOrderSide,
	PerpetualsOrderbook,
	CoinType,
	PerpetualsOrderId,
	FilledTakerOrderEvent,
	Timestamp,
	PerpetualsMarketCandleDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsAccountCap,
	PerpetualsAccountId,
	PerpetualsAccountObject,
	IFixed,
	MoveErrorCode,
	CallerConfig,
	SuiAddress,
	ObjectId,
	ApiPerpetualsMarkets24hrStatsResponse,
	ApiPerpetualsAccountCapsBody,
	PerpetualsVaultObject,
	Percentage,
	Balance,
	PerpetualsVaultCap,
	PerpetualsVaultWithdrawRequest,
	ApiPerpetualsVaultWithdrawRequestsBody,
	PerpetualsVaultCapExtended,
	PerpetualsOrderPrice,
	ApiTransactionResponse,
	PerpetualsWsUpdatesSubscriptionMessage,
	PerpetualsWsUpdatesResponseMessage,
	PerpetualsWsCandleResponseMessage,
	ApiPerpetualsCreateVaultBody,
	ApiPerpetualsCreateVaultCapBody,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { PerpetualsOrderUtils } from "./utils";
import { AftermathApi } from "../../general/providers";
import { Coin } from "../coin";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { PerpetualsVault } from "./perpetualsVault";

export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly OrderUtils = PerpetualsOrderUtils;

	public static readonly constants = {
		stopOrderGasCostSUI: BigInt(15000000), // 0.15 SUI
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	public async getAllMarkets(inputs: {
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarket[]> {
		const marketDatas = await this.fetchApi<
			PerpetualsMarketData[],
			{
				collateralCoinType: CoinType;
			}
		>("all-markets", inputs);
		return marketDatas.map(
			(marketData) => new PerpetualsMarket(marketData, this.config)
		);
	}

	public async getMarket(inputs: {
		marketId: PerpetualsMarketId;
		collateralCoinType: CoinType;
		// withOrderbook: boolean;
	}): Promise<PerpetualsMarket> {
		const markets = await this.getMarkets({
			marketIds: [inputs.marketId],
			collateralCoinType: inputs.collateralCoinType,
		});
		return markets[0];
	}

	public async getMarkets(inputs: {
		marketIds: PerpetualsMarketId[];
		collateralCoinType: CoinType;
		// withOrderbook: boolean;
	}): Promise<PerpetualsMarket[]> {
		const marketDatas = await this.fetchApi<
			{
				market: PerpetualsMarketData;
				orderbook: PerpetualsOrderbook;
			}[],
			{
				marketIds: PerpetualsMarketId[];
				collateralCoinType: CoinType;
				withOrderbook: boolean | undefined;
			}
		>("markets", {
			...inputs,
			withOrderbook: false,
		});
		return marketDatas.map(
			(marketData) =>
				// TODO: make orderbook as input ?
				new PerpetualsMarket(marketData.market, this.config)
		);
	}

	public async getAllVaults(): Promise<PerpetualsVault[]> {
		const vaultObjects = await this.fetchApi<PerpetualsVaultObject[], {}>(
			"vaults",
			{}
		);
		return vaultObjects.map(
			(vaultObject) => new PerpetualsVault(vaultObject, this.config)
		);
	}

	public async getVault(inputs: {
		marketId: ObjectId;
	}): Promise<PerpetualsVault> {
		const vaults = await this.getVaults({
			vaultIds: [inputs.marketId],
		});
		return vaults[0];
	}

	public async getVaults(inputs: {
		vaultIds: ObjectId[];
	}): Promise<PerpetualsVault[]> {
		const vaultObjects = await this.fetchApi<
			PerpetualsVaultObject[],
			{
				vaultIds: ObjectId[];
			}
		>("vaults", inputs);
		return vaultObjects.map(
			(vaultObject) => new PerpetualsVault(vaultObject, this.config)
		);
	}

	// TODO: merge this with `getAccountObjects` as an option ?
	public async getAccount(inputs: {
		accountCap: PerpetualsAccountCap | PerpetualsVaultCapExtended;
		marketIds?: PerpetualsMarketId[];
	}): Promise<PerpetualsAccount> {
		const { accountCap, marketIds } = inputs;
		return (
			await this.getAccounts({
				accountCaps: [accountCap],
				marketIds,
			})
		)[0];
	}

	// TODO: make account fetching get positions and account cap data all at once ?
	public async getAccounts(inputs: {
		accountCaps: (PerpetualsAccountCap | PerpetualsVaultCapExtended)[];
		marketIds?: PerpetualsMarketId[];
	}): Promise<PerpetualsAccount[]> {
		const { accountCaps, marketIds } = inputs;
		if (accountCaps.length <= 0) return [];

		// TODO: handle different collateral coin types
		const accountObjects = await this.getAccountObjects({
			accountIds: accountCaps.map((accountCap) => accountCap.accountId),
			collateralCoinType: accountCaps[0].collateralCoinType,
			marketIds,
		});
		return accountObjects.map(
			(account, index) =>
				new PerpetualsAccount(
					account,
					accountCaps[index],
					this.config,
					this.Provider
				)
		);
	}

	// TODO: handle different collateral coin types ?
	public async getAccountObjects(inputs: {
		accountIds: PerpetualsAccountId[];
		collateralCoinType: CoinType;
		marketIds?: PerpetualsMarketId[];
	}): Promise<PerpetualsAccountObject[]> {
		const { accountIds, collateralCoinType, marketIds } = inputs;
		if (accountIds.length <= 0) return [];

		return this.fetchApi<
			PerpetualsAccountObject[],
			{
				accountIds: PerpetualsAccountId[];
				collateralCoinType: CoinType;
				marketIds: PerpetualsMarketId[] | undefined;
			}
		>("accounts/positions", {
			accountIds,
			collateralCoinType,
			marketIds,
		});
	}

	public async getOwnedAccountCaps(
		inputs: ApiPerpetualsOwnedAccountCapsBody & {
			collateralCoinTypes?: CoinType[];
		}
	): Promise<PerpetualsAccountCap[]> {
		const { walletAddress, collateralCoinTypes } = inputs;

		return this.fetchApi<
			PerpetualsAccountCap[],
			{
				walletAddress: SuiAddress;
				collateralCoinTypes: CoinType[] | undefined;
			}
		>("accounts/owned", {
			walletAddress,
			collateralCoinTypes,
		});
	}

	public async getOwnedVaultCaps(
		inputs: ApiPerpetualsOwnedAccountCapsBody
	): Promise<PerpetualsVaultCap[]> {
		return this.fetchApi<
			PerpetualsVaultCap[],
			{
				walletAddress: SuiAddress;
			}
		>("vaults/owned-vault-caps", inputs);
	}

	public async getOwnedWithdrawRequests(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApi<
			PerpetualsVaultWithdrawRequest[],
			ApiPerpetualsVaultWithdrawRequestsBody
		>("vaults/owned-withdraw-requests", {
			...inputs,
			// vaultIds: undefined,
		});
	}

	public async getAccountCaps(
		inputs: ApiPerpetualsAccountCapsBody
	): Promise<PerpetualsAccountCap[]> {
		return this.fetchApi<
			PerpetualsAccountCap[],
			ApiPerpetualsAccountCapsBody
		>("accounts", inputs);
	}

	// =========================================================================
	//  Data
	// =========================================================================

	public getMarketHistoricalData(inputs: {
		marketId: PerpetualsMarketId;
		fromTimestamp: Timestamp;
		toTimestamp: Timestamp;
		intervalMs: number;
	}): Promise<ApiPerpetualsHistoricalMarketDataResponse> {
		const { marketId, fromTimestamp, toTimestamp, intervalMs } = inputs;
		return this.fetchApi("market/candle-history", {
			marketId,
			fromTimestamp,
			toTimestamp,
			intervalMs,
		});
	}

	public getMarkets24hrStats(inputs: {
		marketIds: PerpetualsMarketId[];
	}): Promise<ApiPerpetualsMarkets24hrStatsResponse> {
		return this.fetchApi<
			ApiPerpetualsMarkets24hrStatsResponse,
			{
				marketIds: PerpetualsMarketId[];
			}
		>("markets/24hr-stats", inputs);
	}

	// =========================================================================
	//  Prices
	// =========================================================================

	public async getPrices(inputs: { marketIds: ObjectId[] }): Promise<
		{
			basePrice: number;
			collateralPrice: number;
		}[]
	> {
		if (inputs.marketIds.length <= 0) return [];
		return this.fetchApi("markets/prices", inputs);
	}

	public async getLpCoinPrices(inputs: {
		vaultIds: ObjectId[];
	}): Promise<number[]> {
		if (inputs.vaultIds.length <= 0) return [];
		return this.fetchApi("vaults/lp-coin-prices", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getCreateAccountTx(inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		tx?: Transaction;
	}) {
		const { walletAddress, collateralCoinType, tx } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsCreateAccountBody,
			ApiTransactionResponse
		>(
			"transactions/create-account",
			{
				walletAddress,
				collateralCoinType,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async getCreateVaultCapTx(
		// TODO: add tx support
		inputs: Omit<ApiPerpetualsCreateVaultCapBody, "txKind"> & {
			tx?: Transaction;
		}
	) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsCreateVaultCapBody,
			ApiTransactionResponse
		>(
			"vault/transactions/create-vault-cap",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	public async getCreateVaultTx(
		// inputs: {
		// 	walletAddress: SuiAddress;
		// 	collateralCoinType: CoinType;
		// 	lockPeriodMs: number;
		// 	ownerFeePercentage: Percentage;
		// 	forceWithdrawDelayMs: number;
		// 	lpCoinMetadata: {
		// 		// NOTE: is this needed ?
		// 		// decimals: number;
		// 		symbol: string;
		// 		description: string;
		// 		name: string;
		// 		iconUrl?: string;
		// 	};
		// 	tx?: Transaction;
		// } & (
		// 	| {
		// 			initialDepositAmount?: Balance;
		// 	  }
		// 	| {
		// 			initialDepositCoinArg: TransactionObjectArgument;
		// 	  }
		// )
		inputs: Omit<ApiPerpetualsCreateVaultBody, "txKind"> & {
			tx?: Transaction;
		}
	) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsCreateVaultBody,
			ApiTransactionResponse
		>(
			"vault/transactions/create-vault",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Public Static Functions
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static positionSide(inputs: {
		baseAssetAmount: number;
	}): PerpetualsOrderSide {
		const baseAmount = inputs.baseAssetAmount;
		const isLong = Math.sign(baseAmount);
		const side =
			isLong >= 0 ? PerpetualsOrderSide.Bid : PerpetualsOrderSide.Ask;
		return side;
	}

	public static orderPriceFromEvent(inputs: {
		orderEvent: FilledTakerOrderEvent;
	}): number {
		const { orderEvent } = inputs;
		return orderEvent.quoteAssetDelta / orderEvent.baseAssetDelta;
	}

	public static orderPriceFromOrderId(inputs: {
		orderId: PerpetualsOrderId;
	}): number {
		const { orderId } = inputs;
		const orderPrice = PerpetualsOrderUtils.price(orderId);
		return this.orderPriceToPrice({ orderPrice });
	}

	public static priceToOrderPrice = (inputs: {
		price: number;
	}): PerpetualsOrderPrice => {
		const { price } = inputs;
		return BigInt(Math.round(price * FixedUtils.fixedOneN9));
	};

	public static orderPriceToPrice = (inputs: {
		orderPrice: PerpetualsOrderPrice;
	}): number => {
		const { orderPrice } = inputs;
		return Number(orderPrice) / FixedUtils.fixedOneN9;
	};

	public static lotOrTickSizeToNumber(lotOrTickSize: bigint): number {
		return Number(lotOrTickSize) / FixedUtils.fixedOneN9;
	}

	public static lotOrTickSizeToBigInt(lotOrTickSize: number): bigint {
		return BigInt(Math.round(lotOrTickSize * FixedUtils.fixedOneN9));
	}

	public static orderIdToSide = (
		orderId: PerpetualsOrderId
	): PerpetualsOrderSide => {
		return Perpetuals.OrderUtils.isAsk(orderId)
			? PerpetualsOrderSide.Ask
			: PerpetualsOrderSide.Bid;
	};

	public static eventTypeForCollateral = (inputs: {
		eventType: string;
		collateralCoinType: CoinType;
	}): string => {
		return `${inputs.eventType}<${inputs.collateralCoinType}>`;
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	// public static calcEntryPrice(inputs: {
	// 	baseAssetAmount: number;
	// 	quoteAssetNotionalAmount: number;
	// }): number {
	// 	const { baseAssetAmount, quoteAssetNotionalAmount } = inputs;

	// 	const denominator = baseAssetAmount;
	// 	if (!denominator) return 0;

	// 	return Math.abs(quoteAssetNotionalAmount / denominator);
	// }

	// =========================================================================
	//  Websocket
	// =========================================================================

	/**
	 * Open the main updates websocket: /perpetuals/ws/updates
	 *
	 * @returns controller with perps-specific subscribe/unsubscribe helpers
	 */
	public openUpdatesWebsocketStream(args: {
		onMessage: (env: PerpetualsWsUpdatesResponseMessage) => void;
		onOpen?: (ev: Event) => void;
		onError?: (ev: Event) => void;
		onClose?: (ev: CloseEvent) => void;
	}) {
		const { onMessage, onOpen, onError, onClose } = args;

		const ctl = this.openWsStream<
			PerpetualsWsUpdatesSubscriptionMessage,
			PerpetualsWsUpdatesResponseMessage
		>({
			path: "ws/updates",
			onMessage,
			onOpen,
			onError,
			onClose,
		});

		// ---- subscribe/unsubscribe helpers ----
		const subscribeMarket = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { market: { marketId } },
			});

		const unsubscribeMarket = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { market: { marketId } },
			});

		const subscribeUser = ({
			accountId,
			withStopOrders,
		}: {
			accountId: PerpetualsAccountId;
			withStopOrders:
				| {
						walletAddress: SuiAddress;
						bytes: string;
						signature: string;
				  }
				| undefined;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { user: { accountId, withStopOrders } },
			});

		const unsubscribeUser = ({
			accountId,
			withStopOrders,
		}: {
			accountId: PerpetualsAccountId;
			withStopOrders:
				| {
						walletAddress: SuiAddress;
						bytes: string;
						signature: string;
				  }
				| undefined;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { user: { accountId, withStopOrders } },
			});

		const subscribeOracle = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { oracle: { marketId } },
			});

		const unsubscribeOracle = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { oracle: { marketId } },
			});

		const subscribeOrderbook = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { orderbook: { marketId } },
			});

		const unsubscribeOrderbook = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { orderbook: { marketId } },
			});

		const subscribeTrades = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { trades: { marketId } },
			});

		const unsubscribeTrades = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { trades: { marketId } },
			});

		return {
			ws: ctl.ws,
			subscribeMarket,
			unsubscribeMarket,
			subscribeUser,
			unsubscribeUser,
			subscribeOracle,
			unsubscribeOracle,
			subscribeOrderbook,
			unsubscribeOrderbook,
			subscribeTrades,
			unsubscribeTrades,
			close: ctl.close,
		};
	}

	/**
	 * Open market-candles websocket for a single market/interval:
	 * /perpetuals/ws/market-candles/{market_id}/{interval_ms}
	 */
	public openMarketCandlesWebsocketStream(args: {
		marketId: PerpetualsMarketId;
		intervalMs: number;
		onMessage: (msg: PerpetualsWsCandleResponseMessage) => void;
		onOpen?: (ev: Event) => void;
		onError?: (ev: Event) => void;
		onClose?: (ev: CloseEvent) => void;
	}) {
		const { marketId, intervalMs, onMessage, onOpen, onError, onClose } =
			args;

		const path = `ws/market-candles/${encodeURIComponent(
			marketId
		)}/${intervalMs}`;

		// Generic handler already BigInt-parses any "123n" in payloads
		const ctl = this.openWsStream<
			undefined,
			PerpetualsWsCandleResponseMessage
		>({
			path,
			onMessage,
			onOpen,
			onError,
			onClose,
		});

		return {
			ws: ctl.ws,
			close: ctl.close,
		};
	}
}
