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
	PerpetualsMarketPriceDataPoint,
	PerpetualsMarketVolumeDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsAccountCap,
	PerpetualsAccountId,
	PerpetualsAccountObject,
	IFixed,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Casting } from "../../general/utils";
import { PerpetualsOrderUtils } from "./utils";

export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly OrderUtils = PerpetualsOrderUtils;

	private static readonly moveErrors: Record<number, string> = {
		// Clearing House

		// Cannot deposit/withdraw zero coins to/from the account's collateral.
		0: "Deposit Or Withdraw Amount Zero",
		// Orderbook size or price are invalid values
		1: "Invalid Size Or Price",
		// When trying to access a particular insurance fund, but it does not exist.
		2: "Invalid Insurance Fund Id",
		// Index price returned from oracle is 0 or invalid value
		3: "Bad Index Price",
		// Registry already contains the specified collateral type
		4: "Invalid Collateral Type",
		// Order value in USD is too low
		5: "Order Usd Value Too Low",
		// Wrong number of sizes passed to liquidation.
		// It must match the number of liqee's positions.
		6: "Invalid Number Of Sizes",

		// MarketManager

		// Tried to create a new market with invalid parameters.
		1000: "Invalid Market Parameters",
		// Tried to call `update_funding` before enough time has passed since the
		// last update.
		1001: "Updating Funding Too Early",
		// Margin ratio update proposal already exists for market
		1002: "Proposal Already Exists",
		// Margin ratio update proposal cannot be commited too early
		1003: "Premature Proposal",
		// Margin ratio update proposal delay is outside the valid range
		1004: "Invalid Proposal Delay",
		// Market does not exist
		1005: "Market Does Not Exist",
		// Tried to update a config with a value outside of the allowed range
		1006: "Value Out Of Range",
		// Margin ratio update proposal does not exist for market
		1007: "Proposal Does Not Exist",
		// Exchange has no available fees to withdraw
		1008: "No Fees Accrued",
		// Tried to withdraw more insurance funds than the allowed amount
		1009: "Insufficient Insurance Surplus",
		// Cannot create a market for which a price feed does not exist
		1010: "No Price Feed For Market",

		// Account Manager

		// Tried accessing a nonexistent account.
		2000: "Account Not Found",
		// Tried accessing a nonexistent account position.
		2001: "Position Not Found",
		// Tried creating a new position when the account already has the maximum
		// allowed number of open positions.
		2002: "Max Positions Exceeded",
		// An operation brought an account below initial margin requirements.
		// 2003: "Initial Margin Requirement Violated",
		2003: "Margin Requirements Violated, Try Lowering Size",
		// Account is above MMR, so can't be liquidated.
		2004: "Account Above MMR",
		// Cannot realize bad debt via means other than calling 'liquidate'.
		2005: "Account Bad Debt",
		// Cannot withdraw more than the account's free collateral.
		2006: "Insufficient Free Collateral",
		// Cannot delete a position that is not worthless
		2007: "Position Not Null",
		// Tried placing a new pending order when the position already has the maximum
		// allowed number of pending orders.
		2008: "Max Pending Orders Exceeded",
		// Used for checking both liqee and liqor positions during liquidation
		2009: "Account Below IMR",
		// When leaving liqee's account with a margin ratio above tolerance,
		// meaning that liqor has overbought position
		2010: "Account Above Tolerance",

		// Orderbook & OrderedMap

		// While searching for a key, but it doesn't exist.
		3000: "Key Does Not Exist",
		// While inserting already existing key.
		3001: "Key Already Exists",
		// When attempting to destroy a non-empty map
		3002: "Destroying Not Empty Map",
		// Invalid user tries to modify an order
		3003: "Invalid User For Order",
		// Orderbook flag requirements violated
		3004: "Flag Requirements Violated",
		// Minimum size matched not reached
		3005: "Not Enough Liquidity",
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork) {
		super(network, "perpetuals");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	public async getMarketsForCollateral(inputs: {
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarket[]> {
		const { collateralCoinType } = inputs;
		const marketDatas = await this.fetchApi<PerpetualsMarketData[]>(
			`${collateralCoinType}/markets`
		);
		return marketDatas.map(
			(marketData) => new PerpetualsMarket(marketData, this.network)
		);
	}

	public async getMarket(inputs: {
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarket> {
		const marketData = await this.fetchApi<PerpetualsMarketData>(
			`0xplaceholder/markets/${inputs.marketId}`
		);
		return new PerpetualsMarket(marketData, this.network);
	}

	public async getMarkets(inputs: {
		marketIds: PerpetualsMarketId[];
	}): Promise<PerpetualsMarket[]> {
		return Promise.all(
			inputs.marketIds.map((marketId) =>
				this.getMarket({
					marketId,
				})
			)
		);
	}

	public async getAccount(inputs: {
		accountCap: PerpetualsAccountCap;
	}): Promise<PerpetualsAccount> {
		const { accountCap } = inputs;
		const account = await this.fetchApi<PerpetualsAccountObject>(
			`${accountCap.collateralCoinType}/accounts/${accountCap.accountId}`
		);
		return new PerpetualsAccount(account, accountCap, this.network);
	}

	public async getUserAccountCaps(
		inputs: ApiPerpetualsAccountsBody & {
			collateralCoinType: CoinType;
		}
	): Promise<PerpetualsAccountCap[]> {
		const { collateralCoinType, walletAddress } = inputs;
		return this.fetchApi<PerpetualsAccountCap[], ApiPerpetualsAccountsBody>(
			`${collateralCoinType}/accounts`,
			{
				walletAddress,
			}
		);
	}

	// =========================================================================
	//  Data
	// =========================================================================

	public getMarketHistoricalData(inputs: {
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
		fromTimestamp: Timestamp;
		toTimestamp: Timestamp;
		intervalMs: number;
	}) {
		const {
			collateralCoinType,
			marketId,
			fromTimestamp,
			toTimestamp,
			intervalMs,
		} = inputs;
		return this.fetchApi<ApiPerpetualsHistoricalMarketDataResponse>(
			`${collateralCoinType}/markets/${marketId}/historical-data/${fromTimestamp}/${toTimestamp}/${intervalMs}`
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getCreateAccountTx(inputs: ApiPerpetualsCreateAccountBody) {
		return this.fetchApiTransaction<ApiPerpetualsCreateAccountBody>(
			"transactions/create-account",
			inputs
		);
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

		return (
			Casting.IFixed.numberFromIFixed(quoteAssetNotionalAmount) /
			denominator
		);
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static translateMoveErrorCode(errorCode: number) {
		return errorCode in this.moveErrors
			? this.moveErrors[errorCode]
			: undefined;
	}
}
