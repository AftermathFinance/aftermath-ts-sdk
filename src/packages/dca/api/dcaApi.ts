import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../../coin";
import {
	ApiDcaCreateUserBody,
	ApiDCAsOwnedBody,
	ApiDcaTransactionForCloseOrderBody,
	ApiDcaTransactionForCreateOrderBody,
	DcaOrderObject,
	DcaOrdersObject,
	DcaOrderTradeObject,
} from "../dcaTypes";
import {
	AnyObjectType,
	Balance,
	DcaAddresses,
	SuiAddress,
} from "../../../types";
import {
	DcaIndexerCreateUserRequest,
	DcaIndexerCreateUserResponse,
	DcaIndexerOrderCloseRequest,
	DcaIndexerOrderCloseResponse,
	DcaIndexerOrderCreateRequest,
	DcaIndexerOrderCreateResponse,
	DcaIndexerOrdersRequest,
	DcaIndexerOrdersResponse,
	DcaIndexerUserRequest,
	DcaIndexerUserResponse,
} from "./dcaApiCastingTypes";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";

const GAS_SUI_AMOUNT = BigInt(50_000_000); // 0.05 SUI

export class DcaApi {
	// =========================================================================
	// Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			dca: "order",
			events: "events",
			config: "config",
		},
		eventNames: {
			createdOrder: "CreatedOrderEvent",
			closedOrder: "ClosedOrderEvent",
			executedTrade: "ExecutedTradeEvent",
		},
	};

	// =========================================================================
	// Class Members
	// =========================================================================

	public readonly addresses: DcaAddresses;
	public readonly eventTypes: {
		createdOrder: AnyObjectType;
		closedOrder: AnyObjectType;
		executedTrade: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.dca;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
		this.eventTypes = {
			createdOrder: this.createdOrderEventType(),
			closedOrder: this.closedOrderEventType(),
			executedTrade: this.executedOrderEventType(),
		};
	}

	// =========================================================================
	//  Public Transaction Methods
	// =========================================================================

	public fetchBuildCreateOrderTx = async (
		inputs: ApiDcaTransactionForCreateOrderBody
	): Promise<Transaction> => {
		const { walletAddress } = inputs;
		const tx = new Transaction();
		tx.setSender(walletAddress);

		const tradesGasAmount = BigInt(inputs.tradesAmount) * GAS_SUI_AMOUNT;
		const orderAmountPerTrade =
			inputs.allocateCoinAmount / BigInt(inputs.tradesAmount);
		const recipientAddress = inputs.customRecipient
			? inputs.customRecipient
			: walletAddress;

		const [gasCoinTxArg, inputCoinTxArg] = await Promise.all([
			this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: Coin.constants.suiCoinType,
				coinAmount: tradesGasAmount,
				isSponsoredTx: inputs.isSponsoredTx,
			}),
			this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: inputs.allocateCoinType,
				coinAmount: inputs.allocateCoinAmount,
				isSponsoredTx: inputs.isSponsoredTx,
			}),
		]);

		const resultTx = await this.createNewOrderTx({
			...inputs,
			tx,
			gasCoinTxArg,
			inputCoinTxArg,
			orderAmountPerTrade,
			recipientAddress,
		});

		return resultTx;
	};

	// =========================================================================
	// Transaction Commands
	// =========================================================================

	public createNewOrderTx = async (
		inputs: {
			tx: Transaction;
			inputCoinTxArg: TransactionObjectArgument;
			gasCoinTxArg: TransactionObjectArgument;
			recipientAddress: SuiAddress;
			orderAmountPerTrade: Balance;
		} & ApiDcaTransactionForCreateOrderBody
	) => {
		const initTx = inputs.tx ?? new Transaction();

		const txBytes = await initTx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});

		const b64TxBytes = Buffer.from(txBytes).toString("base64");

		const { tx_data } = await this.Provider.indexerCaller.fetchIndexer<
			DcaIndexerOrderCreateResponse,
			DcaIndexerOrderCreateRequest
		>(
			"dca/create",
			{
				tx_kind: b64TxBytes,
				order: {
					input_coin:
						Helpers.transactions.serviceCoinDataFromCoinTxArg({
							coinTxArg: inputs.inputCoinTxArg,
						}),
					input_coin_type: inputs.allocateCoinType,
					output_coin_type: inputs.buyCoinType,
					gas_coin: Helpers.transactions.serviceCoinDataFromCoinTxArg(
						{
							coinTxArg: inputs.gasCoinTxArg,
						}
					),
					owner: inputs.walletAddress,
					recipient: inputs.recipientAddress,
					frequency_ms: inputs.frequencyMs.toString(),
					delay_timestamp_ms: inputs.delayTimeMs.toString(),
					amount_per_trade: inputs.orderAmountPerTrade.toString(),
					max_allowable_slippage_bps: inputs.maxAllowableSlippageBps,
					min_amount_out: (inputs.strategy?.priceMin ?? 0)
						.toString()
						.replace("n", ""),
					max_amount_out: (
						inputs.strategy?.priceMax ?? Casting.u64MaxBigInt
					)
						.toString()
						.replace("n", ""),
					number_of_trades: Number(inputs.tradesAmount),
				},
			},
			undefined,
			undefined,
			undefined,
			true
		);

		const tx = Transaction.fromKind(tx_data);
		TransactionsApiHelpers.transferTxMetadata({
			initTx,
			newTx: tx,
		});
		return tx;
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchCloseDcaOrder = async (
		inputs: ApiDcaTransactionForCloseOrderBody
	): Promise<boolean> => {
		return this.Provider.indexerCaller.fetchIndexer<
			DcaIndexerOrderCloseResponse,
			DcaIndexerOrderCloseRequest
		>(
			`dca/cancel`,
			{
				wallet_address: inputs.walletAddress,
				signature: inputs.signature,
				bytes: inputs.bytes,
			},
			undefined,
			undefined,
			undefined,
			true
		);
	};

	// =========================================================================
	// User Public Key
	// =========================================================================

	public fetchUserPublicKey = async (
		inputs: ApiDCAsOwnedBody
	): Promise<string | undefined> => {
		const data = await this.Provider.indexerCaller.fetchIndexer<
			DcaIndexerUserResponse,
			DcaIndexerUserRequest
		>(
			`dca/user/get`,
			{
				wallet_address: inputs.walletAddress,
			},
			undefined,
			undefined,
			undefined,
			true
		);
		return data.public_key;
	};

	public fetchCreateUserPublicKey = async (
		inputs: ApiDcaCreateUserBody
	): Promise<boolean> => {
		return this.Provider.indexerCaller.fetchIndexer<
			DcaIndexerCreateUserResponse,
			DcaIndexerCreateUserRequest
		>(
			`dca/user/add`,
			{
				wallet_address: inputs.walletAddress,
				signature: inputs.signature,
				bytes: inputs.bytes,
			},
			undefined,
			undefined,
			undefined,
			true
		);
	};

	// =========================================================================
	// Class Objects
	// =========================================================================

	public fetchAllOrdersObjects = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<DcaOrdersObject> => {
		const [activeOrders = [], pastOrders = []] = await Promise.all([
			this.fetchActiveOrdersObjects(inputs),
			this.fetchPastOrdersObjects(inputs),
		]);
		return {
			active: activeOrders,
			past: pastOrders,
		};
	};

	public fetchActiveOrdersObjects = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<DcaOrderObject[]> => {
		return this.fetchOrdersObjectsByType({
			...inputs,
			type: "active",
		});
	};

	public fetchPastOrdersObjects = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<DcaOrderObject[]> => {
		return this.fetchOrdersObjectsByType({
			...inputs,
			type: "past",
		});
	};

	public fetchOrdersObjectsByType = async (inputs: {
		walletAddress: SuiAddress;
		type: "active" | "past";
	}): Promise<DcaOrderObject[]> => {
		const { type, walletAddress } = inputs;
		const uncastedResponse = await this.Provider.indexerCaller.fetchIndexer<
			DcaIndexerOrdersResponse,
			DcaIndexerOrdersRequest
		>(
			`dca/get/${type}`,
			{
				sender: walletAddress,
			},
			undefined,
			undefined,
			undefined,
			true
		);
		const orders = uncastedResponse.orders
			.sort((lhs, rhs) => rhs.created.timestamp - lhs.created.timestamp)
			.map((order) => Casting.dca.createdOrderEventOnIndexer(order));

		await Promise.all(
			orders.map(async (order) => {
				await Promise.all(
					order.trades.map(async (trade) => {
						trade.rate = await this.getRate(trade);
						return trade;
					})
				);

				return order;
			})
		);

		return orders;
	};

	private getRate = async (trade: DcaOrderTradeObject) => {
		const allocatedCoinType = Helpers.addLeadingZeroesToType(
			trade.allocatedCoin.coin
		);
		const buyCoinType = Helpers.addLeadingZeroesToType(trade.buyCoin.coin);

		const [allocateCoinDecimals, buyCoinDecimals] = await Promise.all([
			(
				await this.Provider.Coin().fetchCoinMetadata({
					coin: allocatedCoinType,
				})
			).decimals,
			(
				await this.Provider.Coin().fetchCoinMetadata({
					coin: buyCoinType,
				})
			).decimals,
		]);

		const allocatedBalance = Coin.balanceWithDecimals(
			trade.allocatedCoin.amount,
			allocateCoinDecimals
		);

		const buyBalance = Coin.balanceWithDecimals(
			trade.buyCoin.amount,
			buyCoinDecimals
		);

		return allocatedBalance !== 0
			? buyBalance / allocatedBalance
			: undefined;
	};

	// =========================================================================
	// Events
	// =========================================================================

	private createdOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrder
		);

	private closedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.closedOrder
		);

	private executedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.executedTrade
		);
}
