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
		// TODO: - replace fetchIndexerTest with fetchIndexer
		const { tx_data } = await this.Provider.indexerCaller.fetchIndexerTest<
			LimitIndexerOrderCreateResponse,
			LimitIndexerOrderCreateRequest
		>(
			// TODO: - add `limit/` in front for AF-FE
			"orders/create",
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
					expiry_timestamp_ms: inputs.expiryTimestampMs,
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
		// TODO: - replace fetchIndexerTest with fetchIndexer
		return this.Provider.indexerCaller.fetchIndexerTest<
			LimitIndexerOrderCancelResponse,
			LimitIndexerOrderCancelRequest
		>(
			// TODO: - add `limit/` in front for AF-FE
			`orders/close`,
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
	}): Promise<LimitOrdersObject> => {
		const [activeOrders = [], pastOrders = []] = await Promise.all([
			this.fetchActiveOrdersObjects(inputs),
			this.fetchExecutedOrdersObjects(inputs),
		]);
		return {
			active: activeOrders,
			executed: pastOrders,
		};
	};

	public fetchActiveOrdersObjects = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<LimitOrderObject[]> => {
		return this.fetchOrdersObjectsByType({
			...inputs,
			type: "active",
		});
	};

	public fetchExecutedOrdersObjects = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<LimitOrderObject[]> => {
		return this.fetchOrdersObjectsByType({
			...inputs,
			type: "executed",
		});
	};

	public fetchOrdersObjectsByType = async (inputs: {
		walletAddress: SuiAddress;
		type: "active" | "executed";
	}): Promise<LimitOrderObject[]> => {
		const { type, walletAddress } = inputs;
		const uncastedResponse =
			// TODO: - replace fetchIndexerTest with fetchIndexer
			await this.Provider.indexerCaller.fetchIndexerTest<
				LimitIndexerOrderResponse[],
				LimitIndexerOrdersRequest
			>(
				// TODO: - add `limit/` in front for AF-FE
				`orders/${type}/${walletAddress}`,
				{
					sender: walletAddress,
				},
				undefined,
				undefined,
				undefined,
				true
			);
		const orders = uncastedResponse
			.sort(
				(lhs, rhs) =>
					rhs.create_order_tx_info.timestamp -
					lhs.create_order_tx_info.timestamp
			)
			.map((order) => Casting.limit.createdOrderEventOnIndexer(order));
		return orders;
		// return this.getMockOrders(type);
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

	private getMockOrders(type: string) {
		return [
			type === "active"
				? {
						objectId: "test_active",
						allocatedCoin: {
							coin: Coin.constants.suiCoinType,
							amount: BigInt(50_000_000),
						},
						buyCoin: {
							coin: "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK",
							amount: BigInt(50_000_000),
						},
						created: {
							time: 321,
							tnxDigest: "",
						},
				  }
				: {
						objectId: "test_executed",
						allocatedCoin: {
							coin: "0x76cb819b01abed502bee8a702b4c2d547532c12f25001c9dea795a5e631c26f1::fud::FUD",
							amount: BigInt(500_000_000),
						},
						buyCoin: {
							coin: Coin.constants.suiCoinType,
							amount: BigInt(500_000_000),
						},
						recipient:
							"0xe374570e5da1c1776ef5f99148b4319707b1f25ccc9c148e827add8cc782f818",
						created: {
							time: 123,
							tnxDigest: "",
						},
				  },
		];
	}
}
