import {
	TransactionArgument,
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { SuiEvent, Unsubscribe } from "@mysten/sui/client";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	CoinType,
	PerpetualsAccountObject,
	PerpetualsAddresses,
	ObjectId,
	SuiAddress,
	OracleAddresses,
	AnyObjectType,
	IndexerEventsWithCursor,
	IFixed,
	Balance,
	Timestamp,
	Byte,
	StringByte,
	ObjectVersion,
	TransactionDigest,
	ApiDataWithCursorBody,
	BigIntAsString,
	NumberAsString,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import {
	perpetualsRegistry,
	PerpetualsMarketParams,
	PerpetualsMarketState,
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsCreateAccountBody,
	PerpetualsMarketId,
	PerpetualsAccountId,
	PerpetualsOrderId,
	ApiPerpetualsSLTPOrderBody,
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsOrderbook,
	ApiPerpetualsPreviewOrderBody,
	ApiPerpetualsPreviewOrderResponse,
	ApiPerpetualsAccountsBody,
	PerpetualsOrderData,
	CollateralEvent,
	PerpetualsOrderEvent,
	PerpetualsOrderInfo,
	PerpetualsOrderbookState,
	OrderbookDataPoint,
	ApiPerpetualsOrderbookStateBody,
	PerpetualsOrderPrice,
	FilledMakerOrderEvent,
	FilledTakerOrderEvent,
	ApiPerpetualsExecutionPriceBody,
	ApiPerpetualsExecutionPriceResponse,
	ApiPerpetualsCancelOrdersBody,
	PerpetualsMarketCandleDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsAccountCap,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsLimitOrderBody,
	PerpetualsPosition,
	PerpetualsMarketData,
	PerpetualsRawAccountCap,
	PostedOrderReceiptEvent,
	ApiPerpetualsCancelOrderBody,
	PerpetualsFilledOrderData,
	ApiPerpetualsMaxOrderSizeBody,
	ApiPerpetualsAccountOrderDatasBody,
	ApiPerpetualsMarket24hrVolumeResponse,
	PerpetualsTradeHistoryWithCursor,
	PerpetualsAccountTradesWithCursor,
	PerpetualsAccountCollateralChangesWithCursor,
	ApiPerpetualsSetPositionLeverageBody,
	ApiPerpetualsAccountOrderHistoryBody,
	ApiPerpetualsAccountCollateralHistoryBody,
	PerpetualsCollateralEventName,
	PerpetualsTradeEventName,
} from "../perpetualsTypes";
import { PerpetualsApiCasting } from "./perpetualsApiCasting";
import { Perpetuals } from "../perpetuals";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import {
	EventOnChain,
	SuiAddressWithout0x,
} from "../../../general/types/castingTypes";
import {
	AllocatedCollateralEventOnChain,
	CanceledOrderEventOnChain,
	DeallocatedCollateralEventOnChain,
	DepositedCollateralEventOnChain,
	FilledMakerOrderEventOnChain,
	FilledTakerOrderEventOnChain,
	LiquidatedEventOnChain,
	PerpetualsAccountPositionsIndexerResponse,
	PerpetualsMarketsIndexerResponse,
	PerpetualsPreviewOrderIndexerResponse,
	PostedOrderEventOnChain,
	PostedOrderReceiptEventOnChain,
	SettledFundingEventOnChain,
	WithdrewCollateralEventOnChain,
} from "../perpetualsCastingTypes";
import { Aftermath } from "../../..";
import { PerpetualsOrderUtils } from "../utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { InspectionsApiHelpers } from "../../../general/apiHelpers/inspectionsApiHelpers";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import { bcs } from "@mysten/sui/bcs";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";

export class PerpetualsApi implements MoveErrorsInterface {
	// =========================================================================
	//  Class Members
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			orderbook: "orderbook",
			events: "events",
			clearingHouse: "clearing_house",
			account: "account",
		},
	};

	public readonly addresses: {
		perpetuals: PerpetualsAddresses;
		oracle: OracleAddresses;
	};

	public readonly eventTypes: {
		withdrewCollateral: AnyObjectType;
		depositedCollateral: AnyObjectType;
		settledFunding: AnyObjectType;
		allocatedCollateral: AnyObjectType;
		deallocatedCollateral: AnyObjectType;
		liquidated: AnyObjectType;
		createdAccount: AnyObjectType;
		canceledOrder: AnyObjectType;
		postedOrder: AnyObjectType;
		postedOrderReceipt: AnyObjectType;
		filledMakerOrder: AnyObjectType;
		filledTakerOrder: AnyObjectType;
		updatedPremiumTwap: AnyObjectType;
		updatedSpreadTwap: AnyObjectType;
	};
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const perpetuals = this.Provider.addresses.perpetuals;
		const oracle = this.Provider.addresses.oracle;
		if (!perpetuals || !oracle)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			perpetuals,
			oracle,
		};
		this.eventTypes = {
			// Collateral
			withdrewCollateral: this.eventType("WithdrewCollateral"),
			depositedCollateral: this.eventType("DepositedCollateral"),
			settledFunding: this.eventType("SettledFunding"),
			allocatedCollateral: this.eventType("AllocatedCollateral"),
			deallocatedCollateral: this.eventType("DeallocatedCollateral"),
			// Liquidation
			liquidated: this.eventType("LiquidatedPosition"),
			// Account
			createdAccount: this.eventType("CreatedAccount"),
			// Order
			canceledOrder: this.eventType("CanceledOrder"),
			postedOrder: this.eventType("PostedOrder"),
			filledMakerOrder: this.eventType("FilledMakerOrder"),
			filledTakerOrder: this.eventType("FilledTakerOrder"),
			// Order Receipts
			postedOrderReceipt: this.eventType("OrderbookPostReceipt"),
			// Twap
			updatedPremiumTwap: this.eventType("UpdatedPremiumTwap"),
			updatedSpreadTwap: this.eventType("UpdatedSpreadTwap"),
		};
		this.moveErrors = {
			[this.addresses.perpetuals.packages.perpetuals]: {
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
			},
		};
	}

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public depositCollateralTx = (
		inputs: {
			tx: Transaction;
			collateralCoinType: CoinType;
			accountCapId: ObjectId | TransactionArgument;
		} & (
			| {
					coinId: ObjectId | TransactionArgument;
			  }
			| {
					coinBytes: Uint8Array;
			  }
		)
	) => {
		const { tx, collateralCoinType, accountCapId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"deposit_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				"coinBytes" in inputs
					? tx.pure(inputs.coinBytes)
					: typeof inputs.coinId === "string"
					? tx.object(inputs.coinId)
					: inputs.coinId,
			],
		});
	};

	public allocateCollateralTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		amount: Balance;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, amount } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"allocate_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.pure.u64(amount),
			],
		});
	};

	public deallocateCollateralTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		accountCapId: ObjectId;
		basePriceFeedId: ObjectId;
		collateralPriceFeedId: ObjectId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		amount: Balance;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, amount } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"deallocate_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				tx.object(accountCapId),
				tx.object(inputs.basePriceFeedId),
				tx.object(inputs.collateralPriceFeedId),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure.u64(amount),
			],
		});
	};

	public createMarketPositionTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market_position"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
			],
		});
	};

	public shareClearingHouseTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId | TransactionArgument;
	}) => {
		const { tx, collateralCoinType, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"share_clearing_house"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof marketId === "string" ? tx.object(marketId) : marketId,
			],
		});
	};

	public startSessionTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		basePriceFeedId: ObjectId;
		collateralPriceFeedId: ObjectId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
	}) /* SessionHotPotato<T> */ => {
		const { tx, collateralCoinType, accountCapId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"start_session"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(inputs.basePriceFeedId),
				tx.object(inputs.collateralPriceFeedId),
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public endSessionTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
	}) /* ClearingHouse<T> */ => {
		const { tx, collateralCoinType, sessionPotatoId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"end_session"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
			],
		});
	};

	public placeMarketOrderTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
		size: bigint;
	}) => {
		const { tx, collateralCoinType, sessionPotatoId, side, size } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_market_order"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
				tx.pure.bool(Boolean(side)),
				tx.pure.u64(size),
			],
		});
	};

	public placeLimitOrderTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		sessionPotatoId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
		size: bigint;
		price: bigint;
		orderType: PerpetualsOrderType;
	}) => {
		const {
			tx,
			collateralCoinType,
			sessionPotatoId,
			side,
			size,
			price,
			orderType,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_limit_order"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof sessionPotatoId === "string"
					? tx.object(sessionPotatoId)
					: sessionPotatoId,
				tx.pure.bool(Boolean(side)),
				tx.pure.u64(size),
				tx.pure.u64(price),
				tx.pure.u64(BigInt(orderType)),
			],
		});
	};

	public cancelOrdersTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		accountCapId: ObjectId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		orderIds: PerpetualsOrderId[];
	}) => {
		const { tx, collateralCoinType, accountCapId, marketId, orderIds } =
			inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"cancel_orders"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: true,
				}),
				tx.object(accountCapId),
				tx.pure(bcs.vector(bcs.u128()).serialize(orderIds)),
			],
		});
	};

	public withdrawCollateralTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): TransactionArgument => {
		const { tx, collateralCoinType, accountCapId, amount } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"withdraw_collateral"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.pure.u64(amount),
			],
		});
	};

	public createAccountTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
	}) /* Account<T> */ => {
		const { tx, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_account"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(this.addresses.perpetuals.objects.registry)],
		});
	};

	// public getHotPotatoFieldsTx = (
	// 	inputs: {
	// 		tx: Transaction;
	// 		collateralCoinType: CoinType;
	// 		sessionPotatoId: ObjectId | TransactionArgument;
	// 	}
	// 	/*
	// 		(
	// 			lot_size,
	// 			tick_size,
	// 			timestamp_ms,
	// 			collateral_price,
	// 			index_price,
	// 			book_price,
	// 			fills,
	// 			post
	// 		): (
	// 			u64,
	// 			u64,
	// 			u64,
	// 			u64,
	// 			u256,
	// 			u256,
	// 			u256,
	// 			&vector<FillReceipt>,
	// 			&PostReceipt
	// 		)
	// 	*/
	// ) => {
	// 	const { tx, collateralCoinType, sessionPotatoId } = inputs;
	// 	return tx.moveCall({
	// 		target: Helpers.transactions.createTxTarget(
	// 			this.addresses.perpetuals.packages.perpetuals,
	// 			PerpetualsApi.constants.moduleNames.clearingHouse,
	// 			"get_hot_potato_fields"
	// 		),
	// 		typeArguments: [collateralCoinType],
	// 		arguments: [
	// 			typeof sessionPotatoId === "string"
	// 				? tx.object(sessionPotatoId)
	// 				: sessionPotatoId,
	// 		],
	// 	});
	// };

	public placeSLTPOrderTx = (
		inputs: ApiPerpetualsSLTPOrderBody & {
			tx: Transaction;
			sessionPotatoId: TransactionObjectArgument;
		}
	) => {
		throw new Error("TODO");

		// const { tx } = inputs;

		// if ("price" in inputs) {
		// 	this.placeLimitOrderTx({ ...inputs, tx });
		// } else {
		// 	this.placeMarketOrderTx({ ...inputs, tx });
		// }

		// const orderType = PerpetualsOrderType.PostOnly;
		// const side =
		// 	inputs.side === PerpetualsOrderSide.Ask
		// 		? PerpetualsOrderSide.Bid
		// 		: PerpetualsOrderSide.Ask;

		// const orderPrice =
		// 	"price" in inputs ? inputs.price : inputs.marketPrice;

		// if (
		// 	"slPrice" in inputs &&
		// 	((inputs.side === PerpetualsOrderSide.Ask &&
		// 		inputs.slPrice > orderPrice) ||
		// 		(inputs.side === PerpetualsOrderSide.Bid &&
		// 			inputs.slPrice < orderPrice))
		// ) {
		// 	this.placeLimitOrderTx({
		// 		...inputs,
		// 		tx,
		// 		orderType,
		// 		side,
		// 		price: inputs.slPrice,
		// 	});
		// }

		// if (
		// 	"tpPrice" in inputs &&
		// 	((inputs.side === PerpetualsOrderSide.Ask &&
		// 		inputs.tpPrice < orderPrice) ||
		// 		(inputs.side === PerpetualsOrderSide.Bid &&
		// 			inputs.tpPrice > orderPrice))
		// ) {
		// 	this.placeLimitOrderTx({
		// 		...inputs,
		// 		tx,
		// 		orderType,
		// 		side,
		// 		price: inputs.tpPrice,
		// 	});
		// }
	};

	public getPositionTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		accountId: PerpetualsAccountId;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
	}) /* Position */ => {
		const { tx, marketId, collateralCoinType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_position"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: false,
				}),
				tx.pure.u64(inputs.accountId),
			],
		});
	};

	public getOrderbookTx = (inputs: {
		tx: Transaction;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}) /* Orderbook */ => {
		const { tx, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_orderbook"
			),
			typeArguments: [collateralCoinType],
			arguments: [tx.object(inputs.marketId)],
		});
	};

	public getBookPriceTx = (inputs: {
		tx: Transaction;
		marketId: PerpetualsMarketId;
		// marketInitialSharedVersion: ObjectVersion;
		collateralCoinType: CoinType;
	}) /* Option<u256> */ => {
		const { tx, marketId, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_book_price"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.object(marketId),
				// tx.sharedObjectRef({
				// 	objectId: marketId,
				// 	initialSharedVersion: inputs.marketInitialSharedVersion,
				// 	mutable: false,
				// }),
			],
		});
	};

	public getBestPriceTx = (inputs: {
		tx: Transaction;
		marketId: PerpetualsMarketId;
		marketInitialSharedVersion: ObjectVersion;
		side: PerpetualsOrderSide;
		collateralCoinType: CoinType;
	}) /* Option<u256> */ => {
		const { tx, marketId, collateralCoinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.clearingHouse,
				"get_best_price"
			),
			typeArguments: [collateralCoinType],
			arguments: [
				tx.sharedObjectRef({
					objectId: marketId,
					initialSharedVersion: inputs.marketInitialSharedVersion,
					mutable: false,
				}), // ClearingHouse
				tx.pure.bool(Boolean(inputs.side)), // side
			],
		});
	};

	public inspectOrdersTx = (inputs: {
		tx: Transaction;
		orderbookId: ObjectId | TransactionArgument;
		side: PerpetualsOrderSide;
		fromPrice: IFixed;
		toPrice: IFixed;
	}) /* vector<OrderInfo> */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.orderbook,
				"inspect_orders"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook
				tx.pure.bool(Boolean(inputs.side)), // side
				tx.pure.u64(inputs.fromPrice), // price_from
				tx.pure.u64(inputs.toPrice), // price_to
			],
		});
	};

	public getOrderSizeTx = (inputs: {
		tx: Transaction;
		orderbookId: ObjectId | TransactionArgument;
		orderId: PerpetualsOrderId;
	}) /* u64 */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.orderbook,
				"get_order_size"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId, // Orderbook
				tx.pure.u128(inputs.orderId), // order_id
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildDepositCollateralTx = async (
		inputs: ApiPerpetualsDepositCollateralBody
	): Promise<Transaction> => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const { walletAddress, collateralCoinType, amount } = inputs;
		const coinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: collateralCoinType,
			coinAmount: amount,
		});
		this.depositCollateralTx({
			tx,
			coinId,
			...inputs,
		});

		return tx;
	};

	public buildCancelOrderTx = (
		inputs: ApiPerpetualsCancelOrderBody
	): Transaction => {
		const {
			orderId,
			marketId,
			marketInitialSharedVersion,
			collateral,
			basePriceFeedId,
			collateralPriceFeedId,
			...otherInputs
		} = inputs;

		return this.buildCancelOrdersTx({
			...otherInputs,
			orderDatas: [
				{
					orderId,
					marketId,
					marketInitialSharedVersion,
					collateral,
					basePriceFeedId,
					collateralPriceFeedId,
				},
			],
		});
	};

	public buildCancelOrdersTx = (
		inputs: ApiPerpetualsCancelOrdersBody
	): Transaction => {
		const { orderDatas, collateralCoinType, accountCapId } = inputs;

		if (orderDatas.length <= 0)
			throw new Error("cannot have order datas of length zero");

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const marketIdToOrderIds = orderDatas.reduce(
			(acc, order) => {
				if (order.marketId in acc) {
					return {
						...acc,
						[order.marketId]: [...acc[order.marketId], order],
					};
				}
				return {
					...acc,
					[order.marketId]: [order],
				};
			},
			{} as Record<
				PerpetualsMarketId,
				{
					orderId: PerpetualsOrderId;
					marketId: PerpetualsMarketId;
					marketInitialSharedVersion: ObjectVersion;
					collateral: Balance;
					basePriceFeedId: ObjectId;
					collateralPriceFeedId: ObjectId;
				}[]
			>
		);

		for (const [marketId, orders] of Object.entries(marketIdToOrderIds)) {
			if (orders.length <= 0) continue;

			const marketInitialSharedVersion =
				orders[0].marketInitialSharedVersion;

			this.cancelOrdersTx({
				tx,
				collateralCoinType,
				accountCapId,
				marketId,
				marketInitialSharedVersion,
				orderIds: orders.map((order) => order.orderId),
			});
			// TODO: handle deallocating too much ?
			this.deallocateCollateralTx({
				tx,
				accountCapId,
				collateralCoinType,
				marketId,
				marketInitialSharedVersion,
				amount: Helpers.sumBigInt(
					orders.map((order) => order.collateral)
				),
				basePriceFeedId: orders[0].basePriceFeedId,
				collateralPriceFeedId: orders[0].collateralPriceFeedId,
			});
		}

		return tx;
	};

	public buildWithdrawCollateralTx = (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): Transaction => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const coin = this.withdrawCollateralTx({
			tx,
			...inputs,
		});

		tx.transferObjects([coin], inputs.walletAddress);

		return tx;
	};

	public buildCreateAccountTx = (
		inputs: ApiPerpetualsCreateAccountBody
	): Transaction => {
		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const accountCap = this.createAccountTx({
			tx,
			...inputs,
		});
		tx.transferObjects([accountCap], inputs.walletAddress);

		return tx;
	};

	public fetchBuildPlaceSLTPOrderTx = (
		inputs: ApiPerpetualsSLTPOrderBody
	): Promise<Transaction> => {
		throw new Error("TODO");

		// const { tx, sessionPotatoId } = this.createTxAndStartSession(inputs);

		// this.placeSLTPOrderTx({
		// 	...inputs,
		// 	tx,
		// 	sessionPotatoId,
		// });

		// return tx;
	};

	public buildTransferCollateralTx = (inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		fromAccountCapId: ObjectId | TransactionArgument;
		toAccountCapId: ObjectId | TransactionArgument;
		amount: Balance;
	}): Transaction => {
		const {
			walletAddress,
			collateralCoinType,
			fromAccountCapId,
			toAccountCapId,
			amount,
		} = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const coinId = this.withdrawCollateralTx({
			tx,
			collateralCoinType,
			amount,
			accountCapId: fromAccountCapId,
		});
		this.depositCollateralTx({
			tx,
			collateralCoinType,
			coinId,
			accountCapId: toAccountCapId,
		});

		return tx;
	};

	// TODO: add to sdk
	public buildAllocateCollateralTx = TransactionsApiHelpers.createBuildTxFunc(
		this.allocateCollateralTx
	);

	// TODO: add to sdk
	public buildDeallocateCollateralTx =
		TransactionsApiHelpers.createBuildTxFunc(this.deallocateCollateralTx);

	// =========================================================================
	//  Helpers
	// =========================================================================

	public getAccountCapType = (inputs: {
		collateralCoinType: CoinType;
	}): string => {
		return `${this.addresses.perpetuals.packages.perpetuals}::${PerpetualsApi.constants.moduleNames.account}::Account<${inputs.collateralCoinType}>`;
	};

	// =========================================================================
	//  Public Static Helpers
	// =========================================================================

	public static bucketOrders = (inputs: {
		orders: PerpetualsOrderInfo[];
		side: PerpetualsOrderSide;
		lotSize: number;
		tickSize: number;
		priceBucketSize: number;
		initialBucketedOrders?: OrderbookDataPoint[];
	}): OrderbookDataPoint[] => {
		const {
			orders,
			side,
			lotSize,
			tickSize,
			priceBucketSize,
			initialBucketedOrders,
		} = inputs;

		let dataPoints: OrderbookDataPoint[] = initialBucketedOrders ?? [];

		const roundPrice = (price: number, bucketSize: number): number => {
			return Math.round(price / bucketSize) * bucketSize;
		};

		const comparePrices = (
			price1: number,
			price2: number,
			bucketSize: number
		): boolean => {
			return Math.abs(price1 - price2) < bucketSize / 2;
		};

		orders.forEach((order) => {
			const actualPrice = Perpetuals.orderPriceToPrice({
				lotSize,
				tickSize: Math.abs(tickSize),
				orderPrice: order.price,
			});
			const roundedPrice = roundPrice(actualPrice, priceBucketSize);
			const size = lotSize * Number(order.size) * (tickSize < 0 ? -1 : 1);
			const sizeUsd = size * actualPrice;

			const placementIndex = dataPoints.findIndex(
				(dataPoint: OrderbookDataPoint) =>
					comparePrices(
						roundedPrice,
						dataPoint.price,
						priceBucketSize
					)
			);

			if (placementIndex < 0) {
				const newDataPoint: OrderbookDataPoint = {
					size,
					sizeUsd,
					totalSize: size,
					totalSizeUsd: sizeUsd,
					price: roundedPrice,
				};
				const insertIndex = dataPoints.findIndex((dataPoint) =>
					side === PerpetualsOrderSide.Ask
						? roundedPrice <= dataPoint.price
						: roundedPrice >= dataPoint.price
				);
				if (insertIndex < 0) {
					dataPoints.push(newDataPoint);
				} else {
					dataPoints.splice(insertIndex, 0, newDataPoint);
				}
			} else {
				dataPoints[placementIndex].size += size;
				dataPoints[placementIndex].sizeUsd += sizeUsd;
				dataPoints[placementIndex].totalSize += size;
				dataPoints[placementIndex].totalSizeUsd += sizeUsd;
			}
		});

		dataPoints = dataPoints.filter(
			(data) => data.size > 0 && data.sizeUsd > 0
		);

		for (let index = 0; index < dataPoints.length; index++) {
			if (index > 0) {
				dataPoints[index].totalSize =
					dataPoints[index - 1].totalSize + dataPoints[index].size;
				dataPoints[index].totalSizeUsd =
					dataPoints[index - 1].totalSizeUsd +
					dataPoints[index].sizeUsd;
			} else {
				dataPoints[index].totalSize = dataPoints[index].size;
				dataPoints[index].totalSizeUsd = dataPoints[index].sizeUsd;
			}
		}

		if (side === PerpetualsOrderSide.Ask) {
			dataPoints.reverse();
		}

		return dataPoints;
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private eventType = (eventName: string) =>
		EventsApiHelpers.createEventType(
			this.addresses.perpetuals.packages.events,
			PerpetualsApi.constants.moduleNames.events,
			eventName
		);

	// =========================================================================
	//  Object Types
	// =========================================================================

	// private marketObjectType = (inputs: { collateralCoinType: CoinType }) =>
	// 	`${
	// 		this.addresses.perpetuals.packages.perpetuals
	// 	}::clearing_house::ClearingHouse<${Helpers.addLeadingZeroesToType(
	// 		inputs.collateralCoinType
	// 	)}>`;
}
