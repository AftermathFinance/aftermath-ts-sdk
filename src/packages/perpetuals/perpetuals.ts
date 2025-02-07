import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	SuiNetwork,
	Url,
	PerpetualsMarketState,
	PerpetualsMarketData,
	PerpetualsAccountData,
	PerpetualsMarketId,
	ApiPerpetualsAccountsBody,
	PerpetualsPosition,
	PerpetualsOrderSide,
	PerpetualsOrderbook,
	CoinType,
	PerpetualsOrderId,
	FilledTakerOrderEvent,
	PerpetualsOrderPrice,
	Timestamp,
	PerpetualsMarketCandleDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsAccountCap,
	PerpetualsAccountId,
	PerpetualsAccountObject,
	IFixed,
	MoveErrorCode,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { PerpetualsOrderUtils } from "./utils";
import { AftermathApi } from "../../general/providers";
import { Coin } from "../coin";

export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly OrderUtils = PerpetualsOrderUtils;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "perpetuals");
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
			(marketData) => new PerpetualsMarket(marketData, this.network)
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
				withOrderbook: boolean;
			}
		>("markets", {
			...inputs,
			withOrderbook: false,
		});
		return marketDatas.map(
			(marketData) =>
				// TODO: make orderbook as input
				new PerpetualsMarket(marketData.market, this.network)
		);
	}

	public async getAccount(inputs: {
		accountCap: PerpetualsAccountCap;
	}): Promise<PerpetualsAccount> {
		const { accountCap } = inputs;
		const account = await this.fetchApi<
			PerpetualsAccountObject,
			{
				accountId: PerpetualsAccountId;
				collateralCoinType: CoinType;
			}
		>("account/positions", {
			accountId: accountCap.accountId,
			collateralCoinType: accountCap.collateralCoinType,
		});
		return new PerpetualsAccount(
			account,
			accountCap,
			this.network,
			this.Provider
		);
	}

	public async getUserAccountCaps(
		inputs: ApiPerpetualsAccountsBody & {
			collateralCoinType: CoinType;
		}
	): Promise<PerpetualsAccountCap[]> {
		const { collateralCoinType, walletAddress } = inputs;
		// return this.fetchApi<PerpetualsAccountCap[], ApiPerpetualsAccountsBody>(
		// 	`${collateralCoinType}/accounts`,
		// 	{
		// 		walletAddress,
		// 	}
		// );

		// TODO: move logic into endpoint
		const [rawAccountCaps, collateralMetadata] = await Promise.all([
			this.useProvider().fetchOwnedRawAccountCapsOfType(inputs),
			// new Coin(undefined, this.network, this.Provider).getCoinMetadata(
			// 	collateralCoinType
			// ),
			{ decimals: 9 },
		]);
		return rawAccountCaps.map((accountCap) => ({
			...accountCap,
			collateralDecimals: collateralMetadata.decimals,
		}));
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

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getCreateAccountTx(inputs: ApiPerpetualsCreateAccountBody) {
		// return this.fetchApiTransaction<ApiPerpetualsCreateAccountBody>(
		// 	"transactions/create-account",
		// 	inputs
		// );
		return this.useProvider().buildCreateAccountTx(inputs);
	}

	// =========================================================================
	//  Public Static Functions
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static positionSide(inputs: {
		baseAssetAmount: IFixed;
	}): PerpetualsOrderSide {
		const baseAmount = IFixedUtils.numberFromIFixed(inputs.baseAssetAmount);
		const isLong = Math.sign(baseAmount);
		const side =
			isLong >= 0 ? PerpetualsOrderSide.Bid : PerpetualsOrderSide.Ask;
		return side;
	}

	public static orderPrice(inputs: {
		orderEvent: FilledTakerOrderEvent;
	}): number {
		const { orderEvent } = inputs;
		return (
			IFixedUtils.numberFromIFixed(orderEvent.quoteAssetDelta) /
			IFixedUtils.numberFromIFixed(orderEvent.baseAssetDelta)
		);
	}

	public static priceToOrderPrice = (inputs: {
		price: number;
		lotSize: number | bigint;
		tickSize: number | bigint;
	}): PerpetualsOrderPrice => {
		const { price, lotSize, tickSize } = inputs;

		const priceFixed = FixedUtils.directUncast(price);
		// convert f18 to b9 (assuming the former is positive)
		const price9 = priceFixed / FixedUtils.fixedOneB9;

		const denominator =
			FixedUtils.fixedOneB9 /
			(typeof lotSize === "number"
				? this.lotOrTickSizeToBigInt(lotSize)
				: lotSize);
		if (denominator <= BigInt(0)) return BigInt(0);

		return (
			price9 /
			(typeof tickSize === "number"
				? this.lotOrTickSizeToBigInt(tickSize)
				: tickSize) /
			denominator
		);
	};

	public static orderPriceToPrice = (inputs: {
		orderPrice: PerpetualsOrderPrice;
		lotSize: number | bigint;
		tickSize: number | bigint;
	}): number => {
		const { orderPrice, lotSize, tickSize } = inputs;

		const temp =
			FixedUtils.fixedOneB9 /
			(typeof lotSize === "number"
				? this.lotOrTickSizeToBigInt(lotSize)
				: lotSize);
		return FixedUtils.directCast(
			orderPrice *
				(typeof tickSize === "number"
					? this.lotOrTickSizeToBigInt(tickSize)
					: tickSize) *
				temp *
				FixedUtils.fixedOneB9
		);
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

	// =========================================================================
	//  Calculations
	// =========================================================================

	public static calcEntryPrice(inputs: {
		baseAssetAmount: IFixed;
		quoteAssetNotionalAmount: IFixed;
	}): number {
		const { baseAssetAmount, quoteAssetNotionalAmount } = inputs;

		const denominator = Casting.IFixed.numberFromIFixed(baseAssetAmount);
		if (!denominator) return 0;

		return Math.abs(
			Casting.IFixed.numberFromIFixed(quoteAssetNotionalAmount) /
				denominator
		);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Perpetuals();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
