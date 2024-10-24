import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, LimitAddresses, SuiAddress } from "../../../types";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import {
	ApiLimitTransactionForCancelOrderBody,
	ApiLimitTransactionForCreateOrderBody,
	LimitOrderObject,
	LimitOrdersObject,
} from "../limitTypes";
import { Coin } from "../../coin";
import {
	LimitIndexerActiveOrdersRequest,
	LimitIndexerOrderCancelRequest,
	LimitIndexerOrderCancelResponse,
	LimitIndexerOrderCreateRequest,
	LimitIndexerOrderCreateResponse,
	LimitIndexerOrderResponse,
	LimitIndexerOrdersRequest,
} from "./limitApiCastingTypes";
import { Casting, Helpers } from "../../../general/utils";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import { Limit } from "../limit";

export class LimitApi {
	// =========================================================================
	// Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			limit: "order",
			events: "events",
		},
		eventNames: {
			createdOrder: "CreatedOrderEvent",
		},
	};

	// =========================================================================
	// Class Members
	// =========================================================================

	public readonly addresses: LimitAddresses;
	public readonly eventTypes: {
		createdOrder: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.limit;
		if (!addresses) {
			throw new Error(
				"not all required addresses have been set in provider"
			);
		}

		this.addresses = addresses;
		this.eventTypes = {
			createdOrder: this.createdOrderEventType(),
		};
	}

	// =========================================================================
	//  Public Transaction Methods
	// =========================================================================

	public fetchBuildCreateOrderTx = async (
		inputs: ApiLimitTransactionForCreateOrderBody
	): Promise<Transaction> => {
		const { walletAddress } = inputs;
		const tx = new Transaction();
		tx.setSender(walletAddress);

		const gasAmount = Limit.constants.gasAmount;
		const recipientAddress = inputs.customRecipient
			? inputs.customRecipient
			: walletAddress;

		const [gasCoinTxArg, inputCoinTxArg] = await Promise.all([
			this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: Coin.constants.suiCoinType,
				coinAmount: gasAmount,
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
		} & ApiLimitTransactionForCreateOrderBody
	) => {
		const initTx = inputs.tx ?? new Transaction();

		const txBytes = await initTx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});

		const b64TxBytes = Buffer.from(txBytes).toString("base64");
		const { tx_data } = await this.Provider.indexerCaller.fetchIndexer<
			LimitIndexerOrderCreateResponse,
			LimitIndexerOrderCreateRequest
		>(
			"limit/create",
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
					min_amount_out: inputs.minAmountOut
						.toString()
						.replace("n", ""),
					expiry_interval_ms: inputs.expiryTimestampMs,
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

	public fetchCancelLimitOrder = async (
		inputs: ApiLimitTransactionForCancelOrderBody
	): Promise<boolean> => {
		return this.Provider.indexerCaller.fetchIndexer<
			LimitIndexerOrderCancelResponse,
			LimitIndexerOrderCancelRequest
		>(
			`limit/cancel`,
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

	public fetchActiveOrdersObjects = async (inputs: {
		walletAddress: SuiAddress;
		bytes: string;
		signature: string;
	}): Promise<LimitOrderObject[]> => {
		const { walletAddress, bytes, signature } = inputs;
		const uncastedResponse = await this.Provider.indexerCaller.fetchIndexer<
			{
				orders: LimitIndexerOrderResponse[];
			},
			LimitIndexerActiveOrdersRequest
		>(
			`limit/active`,
			{
				wallet_address: walletAddress,
				bytes,
				signature,
			},
			undefined,
			undefined,
			undefined,
			true
		);
		console.log("fetchActiveOrdersObjects", { uncastedResponse });
		const orders = uncastedResponse.orders
			.sort(
				(lhs, rhs) =>
					rhs.create_order_tx_info.timestamp -
					lhs.create_order_tx_info.timestamp
			)
			.map((order) => Casting.limit.createdOrderEventOnIndexer(order));
		return orders;
	};

	public fetchExecutedOrdersObjects = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<LimitOrderObject[]> => {
		const { walletAddress } = inputs;
		const uncastedResponse = await this.Provider.indexerCaller.fetchIndexer<
			{
				orders: LimitIndexerOrderResponse[];
			},
			LimitIndexerOrdersRequest
		>(
			`limit/executed`,
			{
				user_address: walletAddress,
			},
			undefined,
			undefined,
			undefined,
			true
		);
		console.log("fetchExecutedOrdersObjects", { uncastedResponse });
		const orders = uncastedResponse.orders
			.sort(
				(lhs, rhs) =>
					rhs.create_order_tx_info.timestamp -
					lhs.create_order_tx_info.timestamp
			)
			.map((order) => Casting.limit.createdOrderEventOnIndexer(order));
		return orders;
	};

	// =========================================================================
	// Events
	// =========================================================================

	private createdOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.limit,
			LimitApi.constants.moduleNames.events,
			LimitApi.constants.eventNames.createdOrder
		);
}
