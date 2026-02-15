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
	ApiPerpetualsMarketsResponse,
	ApiPerpetualsMarketsBody,
	ApiPerpetualsOrderbooksResponse,
	ApiPerpetualsOrderbooksBody,
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
 * const { markets } = await perps.getMarkets({ marketIds: ["0x..."] });
 * const market = markets[0];
 *
 * const { orderbook } = await market.getOrderbook();
 * const stats = await market.get24hrStats();
 * const { basePrice, collateralPrice } = await market.getPrices();
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
	 * @param Provider - Optional shared {@link AftermathApi} provider instance.
	 *
	 * @remarks
	 * This class extends {@link Caller} with the `"perpetuals"` route prefix, meaning
	 * all HTTP requests resolve under `/perpetuals/...`.
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
	 * Fetch the 24-hour volume and price change statistics for this market.
	 *
	 * Under the hood, this calls {@link Perpetuals.getMarkets24hrStats} and
	 * returns the first (and only) entry.
	 *
	 * @returns {@link PerpetualsMarket24hrStats}.
	 *
	 * @remarks
	 * This method creates a new {@link Perpetuals} instance using `this.config`.
	 * If you need shared Provider behavior, prefer calling `perps.getMarkets24hrStats`
	 * directly with the same Provider you initialized.
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
	 * @returns Object containing `orderbook`.
	 *
	 * @example
	 * ```ts
	 * const { orderbook } = await market.getOrderbook();
	 * console.log(orderbook.bids[0], orderbook.asks[0]);
	 * ```
	 */
	// TODO: move to `Perpetuals` class ?
	public async getOrderbook(): Promise<{
		orderbook: PerpetualsOrderbook;
	}> {
		const { orderbooks } = await this.fetchApi<
			ApiPerpetualsOrderbooksResponse,
			ApiPerpetualsOrderbooksBody
		>("markets/orderbooks", {
			marketIds: [this.marketId],
		});
		return {
			orderbook: orderbooks[0].orderbook,
		};
	}

	/**
	 * Compute the maximum order size that can be placed by a given account
	 * in this market, under optional leverage and price assumptions.
	 *
	 * This is a common frontend helper for:
	 * - "max size" buttons
	 * - input validation against risk limits
	 *
	 * **Note:** This is routed through the `account` namespace because it depends on
	 * the account's collateral and positions.
	 *
	 * @param inputs.accountId - Perpetuals account ID.
	 * @param inputs.side - Order side (Bid/Ask).
	 * @param inputs.leverage - Optional assumed leverage.
	 * @param inputs.price - Optional assumed price (e.g. for limit orders).
	 *
	 * @returns `{ maxOrderSize }` in base units (scaled integer as `bigint`).
	 *
	 * @example
	 * ```ts
	 * const { maxOrderSize } = await market.getMaxOrderSize({
	 *   accountId: 123n,
	 *   side: PerpetualsOrderSide.Bid,
	 *   leverage: 5,
	 * });
	 * ```
	 */
	// TODO: move/add to account ?
	public getMaxOrderSize = async (
		inputs: Omit<ApiPerpetualsMaxOrderSizeBody, "marketId">
	) => {
		return this.fetchApi<
			{
				maxOrderSize: bigint;
			},
			ApiPerpetualsMaxOrderSizeBody
		>("account/max-order-size", {
			...inputs,
			marketId: this.marketId,
		});
	};

	/**
	 * Market-level preview of placing a market order.
	 *
	 * Unlike {@link PerpetualsAccount.getPlaceMarketOrderPreview}, this version:
	 * - Calls `account/previews/place-market-order`
	 * - Explicitly sets `accountId: undefined`, allowing a “generic” preview that
	 *   doesn’t rely on a specific account’s on-chain positions/collateral.
	 *
	 * @param inputs - {@link SdkPerpetualsPlaceMarketOrderPreviewInputs}.
	 * @param abortSignal - Optional abort signal to cancel the request.
	 *
	 * @returns Either `{ error }` or a preview containing the simulated updated position,
	 * slippage, filled/posted sizes, collateral change, and execution price.
	 */
	public async getPlaceMarketOrderPreview(
		inputs: SdkPerpetualsPlaceMarketOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<ApiPerpetualsPreviewPlaceOrderResponse> {
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
	 * @param inputs - {@link SdkPerpetualsPlaceLimitOrderPreviewInputs}.
	 * @param abortSignal - Optional abort signal to cancel the request.
	 *
	 * @returns Either `{ error }` or a preview describing the simulated post-order state.
	 */
	public async getPlaceLimitOrderPreview(
		inputs: SdkPerpetualsPlaceLimitOrderPreviewInputs,
		abortSignal?: AbortSignal
	): Promise<ApiPerpetualsPreviewPlaceOrderResponse> {
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
	 * This is market-wide (public) history, not scoped to any account.
	 *
	 * @param inputs.beforeTimestampCursor - Optional pagination cursor.
	 * @param inputs.limit - Optional page size.
	 *
	 * @returns {@link ApiPerpetualsMarketOrderHistoryResponse} containing:
	 * - `orders`
	 * - `nextBeforeTimestampCursor`
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
	 * Fetch the current prices for this market.
	 *
	 * Internally calls {@link Perpetuals.getPrices} and returns the first result.
	 *
	 * @returns `{ marketId, basePrice, collateralPrice, midPrice, markPrice }`.
	 *
	 * @remarks
	 * This method instantiates a new {@link Perpetuals} client using `this.config`.
	 * If you rely on a shared Provider, call `perps.getPrices(...)` directly instead.
	 */
	public async getPrices(): Promise<{
		marketId: PerpetualsMarketId;
		basePrice: number;
		collateralPrice: number;
		midPrice: number | undefined;
		markPrice: number;
	}> {
		return (
			await new Perpetuals(this.config).getPrices({
				marketIds: [this.marketId],
			})
		).marketsPrices[0];
	}

	// =========================================================================
	//  Funding / Timing
	// =========================================================================

	/**
	 * Compute the remaining time until the next funding event, in milliseconds.
	 *
	 * @returns `nextFundingTimeMs() - Date.now()`.
	 *
	 * @remarks
	 * If the next funding timestamp does not fit safely into a JS `number`,
	 * {@link nextFundingTimeMs} returns `Number.MAX_SAFE_INTEGER`, and the
	 * difference may be very large.
	 */
	public timeUntilNextFundingMs = (): Timestamp => {
		return this.nextFundingTimeMs() - Date.now();
	};

	/**
	 * Get the scheduled timestamp for the next funding event, in milliseconds.
	 *
	 * Safety behavior:
	 * - If `marketData.nextFundingTimestampMs` exceeds `Number.MAX_SAFE_INTEGER`,
	 *   this returns `Number.MAX_SAFE_INTEGER`.
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
	 * This is read directly from `marketData.estimatedFundingRate`.
	 *
	 * @returns Estimated funding rate as a fraction (e.g. `0.01` = 1%).
	 */
	public estimatedFundingRate = (): Percentage => {
		return this.marketData.estimatedFundingRate;
	};

	// =========================================================================
	//  Margin / Collateral Calculations
	// =========================================================================

	/**
	 * Calculate the collateral required to support an order given leverage and prices.
	 *
	 * The computed collateral is based on the *remaining* unfilled size:
	 * `remaining = initialSize - filledSize`.
	 *
	 * USD requirement:
	 * ```text
	 * remainingBase * indexPrice * initialMarginRatio
	 * ```
	 * where `initialMarginRatio = 1 / leverage` (or 1 if leverage is falsy).
	 *
	 * @param inputs.leverage - Target leverage for the order (>= 1).
	 * @param inputs.orderData - Order data containing `initialSize` and `filledSize`.
	 * @param inputs.indexPrice - Index/oracle price of the base asset.
	 * @param inputs.collateralPrice - Price of the collateral asset.
	 *
	 * @returns Object with:
	 * - `collateralUsd`: required collateral in USD
	 * - `collateral`: required collateral in collateral coin units
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

		const collateralUsd =
			(Number(orderData.currentSize) / Casting.Fixed.fixedOneN9) *
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
	 * Get the base-asset lot size for this market as a `number`.
	 *
	 * Order sizes must be multiples of this lot size.
	 *
	 * @returns Lot size in base asset units.
	 */
	public lotSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.lotSize);
	}

	/**
	 * Get the minimal price tick size for this market as a `number`.
	 *
	 * Limit prices must be multiples of this tick size.
	 *
	 * @returns Tick size in quote units (e.g. USD).
	 */
	public tickSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.tickSize);
	}

	/**
	 * Get the maximum theoretical leverage for this market.
	 *
	 * Computed as:
	 * ```ts
	 * 1 / marginRatioInitial
	 * ```
	 *
	 * @returns Maximum leverage.
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
	 * Falling below this ratio may trigger liquidation.
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
	 * Rounding mode:
	 * - `floor: true` => round down
	 * - `ceil: true`  => round up
	 * - neither       => nearest tick (`Math.round`)
	 *
	 * @param inputs.price - Raw price to round.
	 * @param inputs.floor - Force floor rounding.
	 * @param inputs.ceil - Force ceil rounding.
	 * @returns Price snapped to the market tick size.
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
	 * Round a price to the nearest valid tick as a fixed-point `bigint` (1e9 precision).
	 *
	 * This is helpful when you need the on-chain representation directly
	 * (e.g. order price fields stored in 9-decimal fixed).
	 *
	 * @param inputs.price - Raw price as a JS number.
	 * @param inputs.floor - Force floor rounding.
	 * @param inputs.ceil - Force ceil rounding.
	 * @returns Tick-snapped price scaled by `1e9`.
	 */
	public roundToValidPriceBigInt = (inputs: {
		price: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const scaledPrice = Number(inputs.price * Casting.Fixed.fixedOneN9);
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
	 * Rounding mode:
	 * - `floor: true` => round down
	 * - `ceil: true`  => round up
	 * - neither       => nearest lot (`Math.round`)
	 *
	 * @param inputs.size - Raw size in base asset units.
	 * @param inputs.floor - Force floor rounding.
	 * @param inputs.ceil - Force ceil rounding.
	 * @returns Size snapped to the market lot size.
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
	 * Round a base-asset size to the nearest valid lot as a fixed-point `bigint` (1e9 precision).
	 *
	 * @param inputs.size - Raw base size as a JS number.
	 * @param inputs.floor - Force floor rounding.
	 * @param inputs.ceil - Force ceil rounding.
	 * @returns Lot-snapped size scaled by `1e9`.
	 */
	public roundToValidSizeBigInt = (inputs: {
		size: number;
		floor?: boolean;
		ceil?: boolean;
	}) => {
		const scaledSize = Number(inputs.size * Casting.Fixed.fixedOneN9);
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
	 * Useful when an account has no open position but downstream UI/calculations
	 * expect a {@link PerpetualsPosition}-shaped object.
	 *
	 * @returns A zeroed-out {@link PerpetualsPosition} for `this.marketId`.
	 */
	public emptyPosition = (): PerpetualsPosition => {
		return {
			marketId: this.marketId,
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
			makerFee: 1, // 100% (placeholder default)
			takerFee: 1, // 100% (placeholder default)
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
