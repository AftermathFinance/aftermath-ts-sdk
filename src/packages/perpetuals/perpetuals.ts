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
		// ClearingHouse

		/// Cannot deposit/withdraw zero coins to/from the account's collateral.
		0: "Deposit Or Withdraw Amount Zero",
		/// Orderbook size or price are invalid values
		1: "Invalid Size Or Price",
		/// Index price returned from oracle is 0 or invalid value
		2: "Bad Index Price",
		/// Market id already used to register a market
		3: "Market Id Already Used",
		/// Order value in USD is too low
		4: "Order Usd Value Too Low",
		/// Passed a vector of invalid order ids to perform force cancellation
		/// during liquidation
		5: "Invalid Force Cancel Ids",
		/// Liquidate must be the first operation of the session, if performed.
		6: "Liquidate Not First Operation",
		/// Passed a vector of invalid order ids to cancel
		7: "Invalid Cancel Order Ids",
		/// Ticket has already passed `expire_timestamp` and can only be cancelled
		8: "Stop Order Ticket Expired",
		/// Index price is not at correct value to satisfy stop order conditions
		9: "Stop Order Conditions Violated",
		/// Index price is not at correct value to satisfy stop order conditions
		10: "Wrong Order Details",
		/// Invalid price feed storage for the clearing house
		11: "Invalid Price Feed Storage",
		/// Same liquidator and liqee account ids
		12: "Self Liquidation",
		/// User trying to access the subaccount is not the one specified by parent
		13: "Invalid Sub Account User",
		/// The parent `Account` trying to delete the subaccount is not the correct one.
		14: "Wrong Parent For Sub Account",
		/// Raised when trying to delete a subaccount still containing collateral.
		15: "Sub Account Contains Collateral",
		/// Raised when trying to call a function with the wrong package's version
		16: "Wrong Version",
		/// Raised when trying to have a session composed by only `start_session` and `end_session`
		17: "Empty Session",

		// Market

		/// While creating ordered map with invalid parameters,
		/// or changing them improperly for an existent map.
		1000: "Invalid Market Parameters",
		/// Tried to call `update_funding` before enough time has passed since the
		/// last update.
		1001: "Updating Funding Too Early",
		/// Margin ratio update proposal already exists for market
		1002: "Proposal Already Exists",
		/// Margin ratio update proposal cannot be committed too early
		1003: "Premature Proposal",
		/// Margin ratio update proposal delay is outside the valid range
		1004: "Invalid Proposal Delay",
		/// Margin ratio update proposal does not exist for market
		1005: "Proposal Does Not Exist",
		/// Exchange has no available fees to withdraw
		1006: "No Fees Accrued",
		/// Tried to withdraw more insurance funds than the allowed amount
		1007: "Insufficient Insurance Surplus",
		/// Cannot create a market for which a price feed does not exist
		1008: "No Price Feed For Market",
		/// Cannot delete a proposal that already matured. It can only be committed.
		1009: "Proposal Already Matured",

		// Position

		/// Tried placing a new pending order when the position already has the maximum
		/// allowed number of pending orders.
		2000: "Max Pending Orders Exceeded",
		/// Used for checking both liqee and liqor positions during liquidation
		2001: "Position Below IMR",
		/// When leaving liqee's position with a margin ratio above tolerance,
		/// meaning that liqor has overbought position
		2002: "Position Above Tolerance",
		/// An operation brought an account below initial margin requirements.
		2003: "Initial Margin Requirement Violated",
		/// Position is above MMR, so can't be liquidated.
		2004: "Position Above MMR",
		/// Cannot realize bad debt via means other than calling 'liquidate'.
		2005: "Position Bad Debt",
		/// Cannot withdraw more than the account's free collateral.
		2006: "Insufficient Free Collateral",
		/// Cannot have more than 1 position in a market.
		2007: "Position Already Exists",

		// Orderbook & OrderedMap

		/// While creating ordered map with wrong parameters.
		3000: "Invalid Map Parameters",
		/// While searching for a key, but it doesn't exist.
		3001: "Key Not Exist",
		/// While inserting already existing key.
		3002: "Key Already Exists",
		/// When attempting to destroy a non-empty map
		3003: "Destroy Not Empty",
		/// Invalid user tries to modify an order
		3004: "Invalid User For Order",
		/// Orderbook flag requirements violated
		3005: "Flag Requirements Violated",
		/// Minimum size matched not reached
		3006: "Not Enough Liquidity",
		/// When trying to change a map configuration, but the map has
		/// length less than 4
		3007: "Map Too Small",
		/// When taker matches its own order
		3008: "Self Trading",
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

	public async getAllMarkets(inputs: {
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
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarket> {
		const marketData = await this.fetchApi<PerpetualsMarketData>(
			`${inputs.collateralCoinType}/markets/${inputs.marketId}`
		);
		return new PerpetualsMarket(marketData, this.network);
	}

	public async getMarkets(inputs: {
		marketIds: PerpetualsMarketId[];
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarket[]> {
		const { collateralCoinType } = inputs;
		return Promise.all(
			inputs.marketIds.map((marketId) =>
				this.getMarket({
					marketId,
					collateralCoinType,
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

		return Math.abs(
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
