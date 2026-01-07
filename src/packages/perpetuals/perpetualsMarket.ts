import { AftermathApi, Casting, Coin, Helpers, PerpetualsAccount } from "../..";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	ApiIndexerEventsBody,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	CoinType,
	FilledMakerOrdersEvent,
	FilledTakerOrderEvent,
	ObjectId,
	PerpetualsMarketCandleDataPoint,
	PerpetualsMarketId,
	PerpetualsMarketParams,
	PerpetualsMarketState,
	PerpetualsOrderData,
	PerpetualsOrderId,
	PerpetualsOrderPrice,
	PerpetualsOrderSide,
	PerpetualsOrderbook,
	PerpetualsPosition,
	SuiNetwork,
	Timestamp,
	Url,
	PerpetualsMarketData,
	Balance,
	PerpetualsFilledOrderData,
	ApiPerpetualsMaxOrderSizeBody,
	ApiPerpetualsMarkets24hrStatsResponse,
	ApiDataWithCursorBody,
	ApiPerpetualsMarketOrderHistoryResponse,
	CallerConfig,
	Percentage,
	ApiPerpetualsPreviewPlaceOrderResponse,
	PerpetualsMarket24hrStats,
	ApiPerpetualsPreviewPlaceLimitOrderBody,
	SdkPerpetualsPlaceLimitOrderPreviewInputs,
	ApiPerpetualsPreviewPlaceMarketOrderBody,
	SdkPerpetualsPlaceMarketOrderPreviewInputs,
	PerpetualsAccountId,
	ApiPerpetualsMarketOrderHistoryBody,
} from "../../types";
import { Perpetuals } from "./perpetuals";
import { PerpetualsOrderUtils } from "./utils";

/**
 * High-level wrapper around a single perpetuals market.
 *
 * This class provides:
 *
 * - Lightweight accessors for immutable market properties:
 *   - `marketId`, `indexPrice`, `collateralPrice`, `collateralCoinType`
 *   - `marketParams`, `marketState`
 * - Read endpoints for:
 *   - Orderbook snapshots
 *   - 24h stats and order history
 *   - Market prices and derived funding metrics
 * - Helpers for:
 *   - Order sizing (max size, lot/tick rounding)
 *   - Margin and collateral calculations
 *   - Constructing an “empty” position for a market
 *
 * Typical usage:
 *
 * ```ts
 * const perps = new Perpetuals(config);
 * const markets = await perps.getMarkets({ marketIds: ["0x..."] });
 * const btcPerp = new PerpetualsMarket(markets[0], config);
 *
 * const ob = await btcPerp.getOrderbook();
 * const stats = await btcPerp.get24hrStats();
 * const prices = await btcPerp.getPrices();
 * ```
 */
export class PerpetualsMarket extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/** Unique identifier for this perpetuals market (object ID on chain). */
	public readonly marketId: PerpetualsMarketId;

	/**
	 * Current oracle/index price for the market's underlying asset, quoted in
	 * the index unit (typically USD).
	 */
	public readonly indexPrice: number;

	/**
	 * Current price of the collateral asset in USD (or the platform's base
	 * pricing unit).
	 */
	public readonly collateralPrice: number;

	/** Sui type of the collateral coin (e.g. `"0x2::sui::SUI"`). */
	public readonly collateralCoinType: CoinType;

	/** Static market configuration parameters (lot size, tick size, margins, etc.). */
	public readonly marketParams: PerpetualsMarketParams;

	/** Dynamic market state (funding rates, open interest, etc.). */
	public readonly marketState: PerpetualsMarketState;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Create a new {@link PerpetualsMarket} wrapper from raw market data.
	 *
	 * @param marketData - Snapshot of market configuration and state.
	 * @param config - Optional {@link CallerConfig} (network, base URL, etc.).
	 */
	constructor(
		public marketData: PerpetualsMarketData,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals");
		this.marketId = marketData.objectId;
		this.indexPrice = marketData.indexPrice;
		this.collateralPrice = marketData.collateralPrice;
		this.collateralCoinType = marketData.collateralCoinType;
		this.marketParams = marketData.marketParams;
		this.marketState = marketData.marketState;
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetch the mid price for this market’s orderbook.
	 *
	 * This is a convenience endpoint that returns only:
	 *
	 * - `midPrice`: The midpoint between best bid and best ask, or `undefined`
	 *   if the orderbook is empty or malformed.
	 *
	 * @returns A promise resolving to `{ midPrice }`.
	 *
	 * @example
	 * ```ts
	 * const { midPrice } = await market.getOrderbookMidPrice();
	 * ```
	 */
	// NOTE: should this be entirely removed since data already in orderbook function ?
	public getOrderbookMidPrice() {
		return this.fetchApi<
			{
				midPrice: number | undefined;
			},
			{
				marketId: PerpetualsMarketId;
			}
		>("market/orderbook-price", {
			marketId: this.marketId,
		});
	}

	/**
	 * Fetch the 24-hour statistics for this specific market.
	 *
	 * Under the hood, this calls {@link Perpetuals.getMarkets24hrStats} and
	 * returns the first (and only) entry for this market.
	 *
	 * @returns {@link PerpetualsMarket24hrStats} with volume, high/low, and other metrics.
	 *
	 * @example
	 * ```ts
	 * const stats = await market.get24hrStats();
	 * console.log(stats.volumeUsd, stats.priceChangePct);
	 * ```
	 */
	public async get24hrStats(): Promise<PerpetualsMarket24hrStats> {
		const res = await new Perpetuals(this.config).getMarkets24hrStats({
			marketIds: [this.marketId],
		});
		return res.marketsStats[0];
	}

	/**
	 * Fetch the full orderbook snapshot for this market.
	 *
	 * Currently implemented via the generic `markets` endpoint with:
	 * - `marketIds: [this.marketId]`
	 * - `withOrderbook: true`
	 *
	 * @returns {@link PerpetualsOrderbook} for this market.
	 *
	 * @example
	 * ```ts
	 * const ob = await market.getOrderbook();
	 * console.log(ob.bids[0], ob.asks[0]);
	 * ```
	 */
	public async getOrderbook() {
		// TODO: create own endpoint for just orderbook

		// return this.fetchApi<PerpetualsOrderbook>("market/orderbook");

		const marketDatas = await this.fetchApi<
			{
				market: PerpetualsMarketData;
				orderbook: PerpetualsOrderbook;
			}[],
			{
				marketIds: PerpetualsMarketId[];
				withOrderbook: boolean | undefined;
			}
		>("markets", {
			marketIds: [this.marketId],
			withOrderbook: true,
		});
		return marketDatas[0].orderbook;
	}

	/**
	 * Compute the maximum order size that can be placed by a given account
	 * in this market, under optional leverage and price assumptions.
	 *
	 * This is useful for frontends to:
	 * - Drive "max" buttons.
	 * - Validate order inputs against risk limits.
	 *
	 * **Note:** This lives on the `account` namespace since it depends on
	 * account state.
	 *
	 * @param inputs.accountId - Perpetuals account ID.
	 * @param inputs.side - Order side (Bid/Ask).
	 * @param inputs.leverage - Optional leverage to assume (defaults to account-level).
	 * @param inputs.price - Optional limit price; if omitted, a default or index-based
	 *   assumption may be used by the backend.
	 *
	 * @returns An object containing `maxOrderSize` (as `bigint` in base units).
	 *
	 * @example
	 * ```ts
	 * const { maxOrderSize } = await market.getMaxOrderSize({
	 *   accountId,
	 *   side: PerpetualsOrderSide.Bid,
	 *   leverage: 5,
	 * });
	 * ```
	 */
	// TODO: move/add to account ?
	public getMaxOrderSize = async (inputs: {
		accountId: PerpetualsAccountId;
		side: PerpetualsOrderSide;
		leverage?: number;
		price?: number;
	}) => {
		const { side, price, accountId, leverage } = inputs;
		return this.fetchApi<
			{
				maxOrderSize: bigint;
			},
			ApiPerpetualsMaxOrderSizeBody
		>("account/max-order-size", {
			side,
			price,
			leverage,
			accountId,
			marketId: this.marketId,
		});
	};

	/**
	 * Market-level preview of placing a market order.
	 *
	 * Unlike the account-specific preview on {@link PerpetualsAccount},
	 * this version:
	 * - Calls `account/previews/place-market-order`.
	 * - Explicitly sets `accountId: undefined`, allowing the backend to use
	 *   generic or hypothetical assumptions about account state.
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceMarketOrderPreviewInputs}.
	 * @param abortSignal - Optional `AbortSignal` to cancel the HTTP request.
	 *
	 * @returns Either:
	 * - `{ error }`, or
	 * - A preview with:
	 *   - `updatedPosition`
	 *   - `priceSlippage` / `percentSlippage`
	 *   - `filledSize` / `filledSizeUsd`
	 *   - `postedSize` / `postedSizeUsd`
	 *   - `collateralChange`
	 *   - `executionPrice`
	 */
	public async getPlaceMarketOrderPreview(
		inputs: SdkPerpetualsPlaceMarketOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<
		| {
				error: string;
		  }
		| {
				updatedPosition: PerpetualsPosition;
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
			"account/previews/place-market-order",
			{
				...inputs,
				accountId: undefined,
			},
			abortSignal
		);
	}

	/**
	 * Market-level preview of placing a limit order.
	 *
	 * Similar to {@link getPlaceMarketOrderPreview}, this uses:
	 * - `account/previews/place-limit-order`
	 * - `accountId: undefined`
	 *
	 * @param inputs - See {@link SdkPerpetualsPlaceLimitOrderPreviewInputs}.
	 * @param abortSignal - Optional `AbortSignal` to cancel the request.
	 *
	 * @returns Either:
	 * - `{ error }`, or
	 * - A preview object with post-order position, slippage, and collateral changes.
	 */
	public async getPlaceLimitOrderPreview(
		inputs: SdkPerpetualsPlaceLimitOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<
		| {
				error: string;
		  }
		| {
				updatedPosition: PerpetualsPosition;
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
			"account/previews/place-limit-order",
			{
				...inputs,
				accountId: undefined,
			},
			abortSignal
		);
	}

	// =========================================================================
	//  Order History
	// =========================================================================

	/**
	 * Fetch paginated order history for this market.
	 *
	 * This returns *market-level* order history (not account-specific), useful
	 * for charting, recent orders lists, etc.
	 *
	 * @param inputs.cursor - Optional pagination cursor.
	 * @param inputs.limit - Optional number of orders per page.
	 *
	 * @returns {@link ApiPerpetualsMarketOrderHistoryResponse} including a list of
	 *   orders and a `nextBeforeTimestampCursor`.
	 *
	 * @example
	 * ```ts
	 * const result = await market.getOrderHistory({ limit: 100 });
	 * console.log(result.orders.length, result.nextBeforeTimestampCursor);
	 * ```
	 */
	public async getOrderHistory(
		inputs: Omit<ApiPerpetualsMarketOrderHistoryBody, "marketId">
	) {
		return this.fetchApi<
			ApiPerpetualsMarketOrderHistoryResponse,
			ApiPerpetualsMarketOrderHistoryBody
		>("market/order-history", {
			...inputs,
			marketId: this.marketId,
		});
	}

	// =========================================================================
	//  Prices
	// =========================================================================

	/**
	 * Fetch the current base and collateral prices for this market.
	 *
	 * Internally calls {@link Perpetuals.getPrices} and returns the first
	 * element corresponding to `this.marketId`.
	 *
	 * @returns `{ basePrice, collateralPrice }` for this market.
	 *
	 * @example
	 * ```ts
	 * const { basePrice, collateralPrice } = await market.getPrices();
	 * ```
	 */
	public async getPrices(): Promise<{
		basePrice: number;
		collateralPrice: number;
	}> {
		return (
			await new Perpetuals(
				this.config
				// this.Provider
			).getPrices({
				marketIds: [this.marketId],
			})
		).marketsPrices[0];
	}

	// =========================================================================
	//  Calculations
	// =========================================================================`

	/**
	 * Compute the remaining time until the next funding event, in milliseconds.
	 *
	 * - If the on-chain `nextFundingTimestampMs` exceeds `Number.MAX_SAFE_INTEGER`,
	 *   this uses `Number.MAX_SAFE_INTEGER` as a cap via {@link nextFundingTimeMs}.
	 *
	 * @returns `nextFundingTimeMs() - Date.now()`.
	 */
	public timeUntilNextFundingMs = (): Timestamp => {
		return this.nextFundingTimeMs() - Date.now();
	};

	/**
	 * Get the scheduled timestamp for the next funding event, in milliseconds.
	 *
	 * - If `nextFundingTimestampMs` doesn't fit in JS `number` safely
	 *   (i.e. `> Number.MAX_SAFE_INTEGER`), this method returns
	 *   `Number.MAX_SAFE_INTEGER` as a safeguard.
	 *
	 * @returns Next funding timestamp (ms) as a JS `number`.
	 */
	public nextFundingTimeMs = (): Timestamp => {
		return this.marketData.nextFundingTimestampMs >
			BigInt(Number.MAX_SAFE_INTEGER)
			? Number.MAX_SAFE_INTEGER
			: Number(this.marketData.nextFundingTimestampMs);
	};

	/**
	 * Estimated funding rate per period for this market.
	 *
	 * Conceptually defined as:
	 *
	 * ```text
	 * (bookTwap - indexTwap) / indexPrice * (fundingFrequency / fundingPeriod)
	 * ```
	 *
	 * but here it's read directly from `marketData.estimatedFundingRate`.
	 *
	 * @returns Estimated funding rate as a fraction (e.g. 0.01 = 1%).
	 */
	// The funding rate as the difference between book and index TWAPs relative to the index price,
	// scaled by the funding period adjustment:
	// (bookTwap - indexTwap) / indexPrice * (fundingFrequency / fundingPeriod)
	public estimatedFundingRate = (): Percentage => {
		return this.marketData.estimatedFundingRate;
	};

	/**
	 * Calculate the collateral required to support an order given leverage
	 * and prices.
	 *
	 * The formula is (in USD):
	 *
	 * ```text
	 * remainingSizeBase * indexPrice * initialMarginRatio
	 * ```
	 *
	 * where:
	 * - `remainingSizeBase` = `(initialSize - filledSize) / fixedOneN9`
	 * - `initialMarginRatio` = `1 / leverage` (or 1 if leverage is falsy).
	 *
	 * @param inputs.leverage - Target leverage for the order.
	 * @param inputs.orderData - Order data containing `initialSize` and `filledSize`.
	 * @param inputs.indexPrice - Current index price of the underlying.
	 * @param inputs.collateralPrice - Price of the collateral asset in USD.
	 *
	 * @returns Object with:
	 * - `collateralUsd`: required collateral in USD.
	 * - `collateral`: required collateral in collateral coins.
	 */
	public calcCollateralUsedForOrder = (inputs: {
		leverage: number;
		orderData: PerpetualsOrderData;
		indexPrice: number;
		collateralPrice: number;
	}): {
		collateral: number;
		collateralUsd: number;
	} => {
		const { leverage, orderData, indexPrice, collateralPrice } = inputs;

		const imr = 1 / (leverage || 1);
		// const imr = this.initialMarginRatio();

		const collateralUsd =
			// NOTE: is this safe ?
			(Number(orderData.initialSize - orderData.filledSize) /
				Casting.Fixed.fixedOneN9) *
			indexPrice *
			imr;
		const collateral = collateralUsd / collateralPrice;

		return {
			collateralUsd,
			collateral,
		};
	};

	// =========================================================================
	//  Value Conversions
	// =========================================================================

	/**
	 * Get the base asset lot size for this market as a `number`.
	 *
	 * Order sizes must be a multiple of this lot size.
	 *
	 * @returns Lot size in base asset units.
	 */
	public lotSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.lotSize);
	}

	/**
	 * Get the minimal price tick for this market as a `number`.
	 *
	 * Limit prices must be a multiple of this tick size.
	 *
	 * @returns Tick size in quote units (e.g. USD).
	 */
	public tickSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.tickSize);
	}

	/**
	 * Get the maximum theoretical leverage for this market, computed as:
	 *
	 * ```ts
	 * 1 / marginRatioInitial
	 * ```
	 *
	 * @returns Maximum leverage value for opening positions.
	 */
	public maxLeverage() {
		return 1 / this.marketParams.marginRatioInitial;
	}

	/**
	 * Get the initial margin ratio for this market.
	 *
	 * This is the minimum margin required when opening a position.
	 *
	 * @returns Initial margin ratio as a fraction (e.g. 0.05 = 20x).
	 */
	public initialMarginRatio() {
		return this.marketParams.marginRatioInitial;
	}

	/**
	 * Get the maintenance margin ratio for this market.
	 *
	 * Falling below this ratio may result in liquidation.
	 *
	 * @returns Maintenance margin ratio as a fraction.
	 */
	public maintenanceMarginRatio() {
		return this.marketParams.marginRatioMaintenance;
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Round a price to the nearest valid tick for this market.
	 *
	 * @param inputs.price - Raw price to round.
	 * @param inputs.floor - If `true`, always round down to the previous tick.
	 * @param inputs.ceil - If `true`, always round up to the next tick.
	 *
	 * If neither `floor` nor `ceil` are set, this uses `Math.round`.
	 *
	 * @returns Price snapped to a valid tick.
	 *
	 * @example
	 * ```ts
	 * const validPrice = market.roundToValidPrice({ price: 27123.45 });
	 * ```
	 */
	public roundToValidPrice = (inputs: {
		price: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const ticks = inputs.price / this.tickSize();
		return (
			(inputs.floor
				? Math.floor(ticks)
				: inputs.ceil
				? Math.ceil(ticks)
				: Math.round(ticks)) * this.tickSize()
		);
	};

	/**
	 * Round a price to the nearest valid tick for this market, expressed as
	 * a `bigint` scaled by `Fixed.fixedOneN9`.
	 *
	 * This is useful when you need the on-chain representation directly.
	 *
	 * @param inputs.price - Raw price as a JS number.
	 * @param inputs.floor - If `true`, always round down.
	 * @param inputs.ceil - If `true`, always round up.
	 *
	 * @returns Price scaled by `1e9` and snapped to a valid tick as a `bigint`.
	 */
	public roundToValidPriceBigInt = (inputs: {
		price: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const scaledPrice = Number(inputs.price * Casting.Fixed.fixedOneN9);
		// TODO: make sure this calc is safe
		return (
			(BigInt(
				inputs.floor
					? Math.floor(scaledPrice)
					: inputs.ceil
					? Math.ceil(scaledPrice)
					: Math.round(scaledPrice)
			) /
				this.marketParams.tickSize) *
			this.marketParams.tickSize
		);
	};

	/**
	 * Round a base-asset size to the nearest valid lot size for this market.
	 *
	 * @param inputs.size - Raw size in base asset units.
	 * @param inputs.floor - If `true`, always round down.
	 * @param inputs.ceil - If `true`, always round up.
	 *
	 * @returns Size snapped to a valid lot boundary.
	 */
	public roundToValidSize = (inputs: {
		size: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const lots = inputs.size / this.lotSize();
		return (
			(inputs.floor
				? Math.floor(lots)
				: inputs.ceil
				? Math.ceil(lots)
				: Math.round(lots)) * this.lotSize()
		);
	};

	/**
	 * Round a base-asset size to the nearest valid lot size for this market,
	 * as a scaled `bigint` (`Fixed.fixedOneN9`).
	 *
	 * @param inputs.size - Raw size in base units.
	 * @param inputs.floor - If `true`, always round down.
	 * @param inputs.ceil - If `true`, always round up.
	 *
	 * @returns Size scaled by `1e9` and snapped to valid lot as a `bigint`.
	 */
	public roundToValidSizeBigInt = (inputs: {
		size: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const scaledSize = Number(inputs.size * Casting.Fixed.fixedOneN9);
		// TODO: make sure this calc is safe
		return (
			(BigInt(
				inputs.floor
					? Math.floor(scaledSize)
					: inputs.ceil
					? Math.ceil(scaledSize)
					: Math.round(scaledSize)
			) /
				this.marketParams.lotSize) *
			this.marketParams.lotSize
		);
	};

	/**
	 * Construct an "empty" position object for this market.
	 *
	 * This is useful for UI and calculations when an account has no open
	 * position but you still want a full {@link PerpetualsPosition}-shaped
	 * object with defaulted values.
	 *
	 * @returns A zeroed-out {@link PerpetualsPosition} for `this.marketId`.
	 */
	public emptyPosition = (): PerpetualsPosition => {
		return {
			marketId: this.marketId,
			// collateralCoinType: this.marketData.collateralCoinType,
			collateral: 0,
			collateralUsd: 0,
			baseAssetAmount: 0,
			quoteAssetNotionalAmount: 0,
			cumFundingRateLong: this.marketData.marketState.cumFundingRateLong,
			cumFundingRateShort:
				this.marketData.marketState.cumFundingRateShort,
			asksQuantity: 0,
			bidsQuantity: 0,
			pendingOrders: [],
			makerFee: 1, // 100%
			takerFee: 1, // 100%
			leverage: 1,
			entryPrice: 0,
			freeCollateral: 0,
			freeMarginUsd: 0,
			liquidationPrice: 0,
			marginRatio: 1,
			unrealizedFundingsUsd: 0,
			unrealizedPnlUsd: 0,
		};
	};
}
