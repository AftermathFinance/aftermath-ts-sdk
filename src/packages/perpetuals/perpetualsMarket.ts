import { Casting, Coin, Helpers, PerpetualsAccount } from "../..";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import {
	ApiIndexerEventsBody,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	ApiPerpetualsOrderbookStateBody,
	CoinType,
	FilledMakerOrderEvent,
	FilledTakerOrderEvent,
	ObjectId,
	PerpetualsMarketPriceDataPoint,
	PerpetualsMarketId,
	PerpetualsMarketParams,
	PerpetualsMarketState,
	PerpetualsOrderData,
	PerpetualsOrderId,
	PerpetualsOrderPrice,
	PerpetualsOrderSide,
	PerpetualsOrderbook,
	PerpetualsOrderbookState,
	PerpetualsPosition,
	SuiNetwork,
	Timestamp,
	Url,
	PerpetualsMarketData,
	Balance,
	PerpetualsFilledOrderData,
	ApiPerpetualsMaxOrderSizeBody,
	ApiPerpetualsMarket24hrVolumeResponse,
} from "../../types";
import { Perpetuals } from "./perpetuals";
import { PerpetualsOrderUtils } from "./utils";

export class PerpetualsMarket extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public readonly marketId: PerpetualsMarketId;
	public readonly collateralCoinType: CoinType;
	public readonly marketParams: PerpetualsMarketParams;
	public readonly marketState: PerpetualsMarketState;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public marketData: PerpetualsMarketData,
		public readonly network?: SuiNetwork
	) {
		super(
			network,
			`perpetuals/${marketData.collateralCoinType}/markets/${marketData.objectId}`
		);
		this.marketId = marketData.objectId;
		this.collateralCoinType = marketData.collateralCoinType;
		this.marketParams = marketData.marketParams;
		this.marketState = marketData.marketState;
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public getOrderbookPrice() {
		return this.fetchApi<number>("orderbook-price");
	}

	public get24hrVolume(): Promise<ApiPerpetualsMarket24hrVolumeResponse> {
		return this.fetchApi<ApiPerpetualsMarket24hrVolumeResponse>(
			"24hr-volume"
		);
	}

	public getPrice24hrsAgo() {
		return this.fetchApi<number>("price-24hrs-ago");
	}

	public getOrderbookState(inputs: {
		orderbookPrice: number;
		priceBucketSize: number;
	}) {
		return this.fetchApi<
			PerpetualsOrderbookState,
			ApiPerpetualsOrderbookStateBody
		>("orderbook-state", {
			...inputs,
			lotSize: this.lotSize(),
			tickSize: this.tickSize(),
		});
	}

	public getMaxOrderSizeUsd = async (inputs: {
		account: PerpetualsAccount;
		indexPrice: number;
		side: PerpetualsOrderSide;
		leverage: number;
		price?: PerpetualsOrderPrice;
	}): Promise<number> => {
		const { side, price, account, indexPrice, leverage } = inputs;
		const maxSize: bigint = await this.fetchApi<
			bigint,
			ApiPerpetualsMaxOrderSizeBody
		>("max-order-size", {
			accountId: account.accountCap.accountId,
			collateral: account.collateralBalance(),
			side,
			price,
			leverage,
		});
		return Number(maxSize) * this.lotSize() * indexPrice;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public async getFilledOrderEvents(inputs: ApiIndexerEventsBody) {
		return this.fetchApiIndexerEvents<FilledTakerOrderEvent>(
			`events/filled-order`,
			inputs
		);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public timeUntilNextFundingMs = (): Timestamp => {
		return this.nextFundingTimeMs() - Date.now();
	};

	public nextFundingTimeMs = (): Timestamp => {
		const fundingFrequencyMs = Number(this.marketParams.fundingFrequencyMs);
		const lastFundingIntervalNumber = Math.floor(
			this.marketState.fundingLastUpdMs / fundingFrequencyMs
		);
		return (lastFundingIntervalNumber + 1) * fundingFrequencyMs;
	};

	// The funding rate as the difference between book and index TWAPs relative to the index price,
	// scaled by the funding period adjustment:
	// (bookTwap - indexTwap) / indexPrice * (fundingFrequency / fundingPeriod)
	//
	// To get the rate as a percentage, multiply the output by 100.
	public estimatedFundingRate = (inputs: { indexPrice: number }): number => {
		const { indexPrice } = inputs;

		const premiumTwap = IFixedUtils.numberFromIFixed(
			this.marketState.premiumTwap
		);
		const relativePremium = premiumTwap / indexPrice;
		const periodAdjustment =
			Number(this.marketParams.fundingFrequencyMs) /
			Number(this.marketParams.fundingPeriodMs);
		return relativePremium * periodAdjustment;
	};

	public priceToOrderPrice = (inputs: {
		price: number;
	}): PerpetualsOrderPrice => {
		const { price } = inputs;
		const lotSize = this.marketParams.lotSize;
		const tickSize = this.marketParams.tickSize;
		return Perpetuals.priceToOrderPrice({
			price,
			lotSize,
			tickSize,
		});
	};

	public orderPriceToPrice = (inputs: {
		orderPrice: PerpetualsOrderPrice;
	}): number => {
		const { orderPrice } = inputs;
		const lotSize = this.marketParams.lotSize;
		const tickSize = this.marketParams.tickSize;
		return Perpetuals.orderPriceToPrice({
			orderPrice,
			lotSize,
			tickSize,
		});
	};

	public calcOrderCollateral(inputs: {
		indexPrice: number;
		size: bigint;
	}): Balance {
		const { indexPrice, size } = inputs;

		const imr = this.initialMarginRatio();
		return BigInt(
			Math.floor(Number(size) * this.lotSize() * indexPrice * imr)
		);
	}

	public calcOptimisticMaxOrderSize = (inputs: {
		position: PerpetualsPosition | undefined;
		account: PerpetualsAccount;
		indexPrice: number;
		collateralPrice: number;
		side: PerpetualsOrderSide;
	}): number => {
		const { position, indexPrice, side, account, collateralPrice } = inputs;

		const imr = this.initialMarginRatio();

		const isReversing = position
			? Boolean(side ^ Perpetuals.positionSide(position))
			: false;

		const freeMarginUsd =
			account.calcFreeMarginUsdForPosition({
				...inputs,
				market: this,
			}) +
			account.collateral() * collateralPrice;

		let maxSize = freeMarginUsd / (indexPrice * imr);
		if (isReversing && position && position.baseAssetAmount > BigInt(0)) {
			const currentSizeNum =
				Casting.IFixed.numberFromIFixed(position.baseAssetAmount) * 2;
			const bidsQuantityNum = Casting.IFixed.numberFromIFixed(
				position.bidsQuantity
			);
			const asksQuantityNum = Casting.IFixed.numberFromIFixed(
				position.asksQuantity
			);

			maxSize += Math.max(
				Math.abs(currentSizeNum + bidsQuantityNum),
				Math.abs(currentSizeNum - asksQuantityNum)
			);
		}

		return maxSize;
	};

	public calcPessimisticMaxOrderSizeUsd = async (inputs: {
		position: PerpetualsPosition | undefined;
		freeMarginUsd: number;
		minInitialMargin: number;
		indexPrice: number;
		side: PerpetualsOrderSide;
		executionPrice: number;
		sizeFilled: number;
		sizePosted: number;
		optimisticSize: number;
	}): Promise<number> => {
		const {
			indexPrice,
			side,
			position,
			executionPrice,
			freeMarginUsd,
			minInitialMargin,
			sizeFilled,
			sizePosted,
			optimisticSize,
		} = inputs;

		const percentFilled = Math.min(
			sizeFilled / (sizeFilled + sizePosted),
			1
		);

		const marginRatioInitial = this.initialMarginRatio();
		const takerFee = Casting.IFixed.numberFromIFixed(
			this.marketParams.takerFee
		);

		const isReversing = position
			? Boolean(side ^ Perpetuals.positionSide(position))
			: false;

		const slippage =
			percentFilled === 0
				? 0
				: Math.max(
						(side === PerpetualsOrderSide.Bid
							? executionPrice - indexPrice
							: indexPrice - executionPrice) / indexPrice,
						0
				  );

		const marginOfError = 0.005;
		const safetyScalar = Math.min(1 - slippage, 1 - marginOfError);
		let maxSize: number = 0;
		if (isReversing && position && position.baseAssetAmount !== BigInt(0)) {
			maxSize += Math.abs(
				Casting.IFixed.numberFromIFixed(position.baseAssetAmount)
			);

			// Size that can be placed to close the position
			const { marginDelta, reqDelta, sizeFilled, sizePosted } =
				this.simulateClosePosition({
					position,
					indexPrice,
					executionPrice,
					size: optimisticSize,
					percentFilled,
				});

			const newPercentFilled = sizeFilled / (sizeFilled + sizePosted);

			const margin = freeMarginUsd + minInitialMargin + marginDelta;
			const imr = minInitialMargin + reqDelta;

			// Size that adds margin requirement
			maxSize +=
				((margin - imr) * safetyScalar) /
				(indexPrice * marginRatioInitial +
					(executionPrice * takerFee + slippage * indexPrice) *
						newPercentFilled);
		} else {
			maxSize =
				(freeMarginUsd * safetyScalar) /
				(indexPrice * marginRatioInitial +
					(executionPrice * takerFee + slippage * indexPrice) *
						percentFilled);
		}

		// accounts for any minor price fluctatuations or possible rounding errors
		return (
			this.roundToValidSize({ size: maxSize, floor: true }) * indexPrice
		);
	};

	public calcCollateralRequiredForOrder = (inputs: {
		fills: PerpetualsFilledOrderData[];
		account: PerpetualsAccount;
		side: PerpetualsOrderSide;
		size: number;
		indexPrice: number;
		collateralPrice: number;
		price: number | undefined;
	}): number => {
		const {
			account,
			size,
			fills,
			side,
			price,
			indexPrice,
			collateralPrice,
		} = inputs;

		const position = account.positionForMarketId({
			marketId: this.marketId,
		});
		const positionSize = position
			? Math.abs(
					Casting.IFixed.numberFromIFixed(position.baseAssetAmount)
			  )
			: 0;
		const isOpeningOrIncreasingPosition =
			!position ||
			!positionSize ||
			Perpetuals.positionSide(position) === side;

		let sizeRemaining = Math.abs(size);
		let fillsRemaining = Helpers.deepCopy(
			fills.map((fill) => ({
				...fill,
				size: Math.abs(fill.size),
			}))
		);
		let sizeFilled = 0;
		let sizeFilledUsd = 0;
		let sizeFilledForReversing = 0;
		let sizeFilledForReversingUsd = 0;
		while (sizeRemaining > 0 && fillsRemaining.length > 0) {
			const fill = fillsRemaining[0];

			if (
				price !== undefined &&
				(side === PerpetualsOrderSide.Bid
					? price < fill.price
					: price > fill.price)
			)
				break;

			let sizeToFill: number;

			if (!isOpeningOrIncreasingPosition && sizeFilled >= positionSize) {
				sizeToFill = Math.min(sizeRemaining, fill.size);

				sizeFilledForReversing += sizeToFill;
				sizeFilledForReversingUsd += sizeToFill * fill.price;
			} else {
				sizeToFill = Math.min(
					sizeRemaining,
					fill.size,
					isOpeningOrIncreasingPosition
						? Number.MAX_VALUE
						: positionSize - sizeFilled
				);

				sizeFilled += sizeToFill;
				sizeFilledUsd += sizeToFill * fill.price;
			}

			sizeRemaining -= sizeToFill;
			fillsRemaining[0].size -= sizeToFill;

			if (fillsRemaining[0].size <= 0) {
				fillsRemaining = [...fillsRemaining.slice(1)];
			}
		}

		const imr = this.initialMarginRatio();
		const sizePosted = sizeRemaining;
		const executionPrice = sizeFilled ? sizeFilledUsd / sizeFilled : 0;

		const collateralForUnrealizedPnl =
			(sizeFilled *
				Math.max(
					0,
					side === PerpetualsOrderSide.Bid
						? executionPrice - indexPrice
						: indexPrice - executionPrice
				)) /
			collateralPrice;
		const collateralForFilled =
			(sizeFilled * executionPrice * imr) / collateralPrice;
		const collateralForPosted =
			(sizePosted * indexPrice * imr) / collateralPrice;

		const marginOfError = 0.1;

		let collateralRequired;

		if (isOpeningOrIncreasingPosition) {
			// opening/increasing position
			collateralRequired =
				(1 + marginOfError) *
				(collateralForFilled +
					collateralForPosted +
					collateralForUnrealizedPnl);
		} else if (
			sizeFilled === positionSize &&
			sizeFilledForReversing === 0
		) {
			// closing position
			// TODO: make this match account close position tx inputs calc
			return 0;
		} else if (sizeFilledForReversing > 0) {
			// reversing position

			// TODO: use correct calculations

			// const executionPriceForReversing = sizeFilledForReversing
			// 	? sizeFilledForReversingUsd / sizeFilledForReversing
			// 	: 0;
			// const collateralForFilledForReversing =
			// 	(sizeFilledForReversing * executionPriceForReversing * imr) /
			// 	collateralPrice;

			// collateralRequired =
			// 	(1 + marginOfError) *
			// 	(collateralForFilledForReversing + collateralForPosted);

			const executionPriceForReversing = sizeFilledForReversing
				? sizeFilledForReversingUsd / sizeFilledForReversing
				: 0;
			const collateralForFilledForReversing =
				(sizeFilledForReversing * executionPriceForReversing * imr) /
				collateralPrice;

			const collateralForUnrealizedPnlForReversing =
				(sizeFilledForReversing *
					Math.max(
						0,
						side === PerpetualsOrderSide.Bid
							? executionPriceForReversing - indexPrice
							: indexPrice - executionPriceForReversing
					)) /
				collateralPrice;

			// const positionFreeMargin =
			// 	account.calcFreeMarginUsdForPosition({
			// 		...inputs,
			// 		market: this,
			// 	}) * collateralPrice;

			const collateralChange =
				collateralForPosted +
				(collateralForFilledForReversing +
					// - positionFreeMargin
					collateralForUnrealizedPnlForReversing);
			return (
				(1 + marginOfError * (collateralChange > 0 ? 1 : -1)) *
				collateralChange
			);
		} else {
			// reducing position
			return 0;
		}

		return Math.min(collateralRequired, account.collateral());
	};

	public calcCollateralUsedForOrder = (inputs: {
		orderData: PerpetualsOrderData;
		indexPrice: number;
		collateralPrice: number;
	}): {
		collateral: number;
		collateralUsd: number;
	} => {
		const { orderData, indexPrice, collateralPrice } = inputs;

		const imr = this.initialMarginRatio();

		const collateralUsd =
			Number(orderData.initialSize - orderData.filledSize) *
			this.lotSize() *
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

	public lotSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.lotSize);
	}

	public tickSize() {
		return Perpetuals.lotOrTickSizeToNumber(this.marketParams.tickSize);
	}

	public maxLeverage() {
		return (
			1 /
			Casting.IFixed.numberFromIFixed(
				this.marketParams.marginRatioInitial
			)
		);
	}

	public initialMarginRatio() {
		return Casting.IFixed.numberFromIFixed(
			this.marketParams.marginRatioInitial
		);
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	public orderPrice(inputs: { orderId: PerpetualsOrderId }): number {
		const { orderId } = inputs;
		const orderPrice = PerpetualsOrderUtils.price(orderId);
		return this.orderPriceToPrice({ orderPrice });
	}

	public roundToValidPrice = (inputs: { price: number }) => {
		return Math.round(inputs.price / this.tickSize()) * this.tickSize();
	};

	public roundToValidSize = (inputs: { size: number; floor?: boolean }) => {
		const lots = inputs.size / this.lotSize();
		return (
			(inputs.floor ? Math.floor(lots) : Math.round(lots)) *
			this.lotSize()
		);
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	// private getExecutionPrice(inputs: {
	// 	side: PerpetualsOrderSide;
	// 	size: bigint;
	// 	collateral: Balance;
	// 	price?: PerpetualsOrderPrice;
	// }) {
	// 	return this.fetchApi<
	// 		ApiPerpetualsExecutionPriceResponse,
	// 		ApiPerpetualsExecutionPriceBody
	// 	>("execution-price", {
	// 		...inputs,
	// 		lotSize: this.lotSize(),
	// 		basePriceFeedId: this.marketParams.basePriceFeedId,
	// 		collateralPriceFeedId: this.marketParams.collateralPriceFeedId,
	// 	});
	// }

	private simulateClosePosition(inputs: {
		position: PerpetualsPosition;
		indexPrice: number;
		executionPrice: number;
		size: number;
		percentFilled: number;
	}): {
		marginDelta: number;
		reqDelta: number;
		sizeFilled: number;
		sizePosted: number;
	} {
		const { position, indexPrice, executionPrice, size, percentFilled } =
			inputs;

		const imr = this.initialMarginRatio();
		const takerFee = Casting.IFixed.numberFromIFixed(
			this.marketParams.takerFee
		);

		const positionSizeNum = Casting.IFixed.numberFromIFixed(
			position.baseAssetAmount
		);
		const positionBidsNum = Casting.IFixed.numberFromIFixed(
			position.bidsQuantity
		);
		const positionAsksNum = Casting.IFixed.numberFromIFixed(
			position.asksQuantity
		);
		const netSizeBefore = Math.max(
			Math.abs(positionSizeNum + positionBidsNum),
			Math.abs(positionSizeNum - positionAsksNum)
		);

		let sizeFilled = size * percentFilled;
		let sizePosted = size * (1 - percentFilled);

		let positionSizeFilledNum: number;
		let positionSizePosted: number;
		const positionSizeAbs = Math.abs(positionSizeNum);
		if (sizeFilled >= positionSizeAbs) {
			positionSizeFilledNum = positionSizeAbs;
			positionSizePosted = 0;
			sizeFilled = sizeFilled - positionSizeAbs;
		} else {
			positionSizeFilledNum = sizeFilled;
			positionSizePosted = positionSizeAbs - sizeFilled;
			sizeFilled = 0;
			sizePosted = sizePosted - positionSizePosted;
		}

		const netSizeAfter = Math.max(
			Math.abs(
				positionSizeAbs -
					positionSizeFilledNum +
					positionBidsNum -
					positionSizePosted
			),
			Math.abs(
				positionSizeAbs -
					positionSizeFilledNum +
					positionAsksNum -
					positionSizePosted
			)
		);
		const entryPrice = Perpetuals.calcEntryPrice(position);
		const uPnl = positionSizeFilledNum * (indexPrice - entryPrice);
		const rPnl = positionSizeFilledNum * (executionPrice - entryPrice);
		// pessimistically don't consider positive pnl since the order may not actually be
		// matched at the sell price
		const fees =
			Math.abs(positionSizeFilledNum) * executionPrice * takerFee;
		const marginDelta = rPnl - uPnl - fees;
		const reqDelta = (netSizeAfter - netSizeBefore) * indexPrice * imr;

		return { marginDelta, reqDelta, sizeFilled, sizePosted };
	}
}
