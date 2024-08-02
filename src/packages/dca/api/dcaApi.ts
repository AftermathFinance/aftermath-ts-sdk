import { AftermathApi } from "../../../general/providers";
import { TransactionArgument, TransactionBlock } from "@mysten/sui.js/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Casting, Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import { Coin } from "../../coin";
import { 
    ApiDcaTransactionForCancelOrderBody, 
    ApiDcaInitializeOrdertStrategyBody, 
    ApiDcaTransactionForCreateOrderBody, 
    DcaCancelledOrderEvent, 
    DcaCreatedOrderEvent, 
    DcaExecutedTradeEvent, 
    DcaOrderObject, 
    DcaOrdersObject 
} from "../dcaTypes";
import { 
    AnyObjectType, 
    Balance, 
    CoinType, 
    DcaAddresses, 
    EventsInputs, 
    ObjectId, 
    SerializedTransaction, 
    ServiceCoinData, 
    SharedCustodyAddresses, 
    SuiAddress, 
    Timestamp 
} from "../../../types";
import { 
    DcaClosedOrderEventOnChain, 
    DcaCreatedOrderEventOnChain, 
    DcaExecutedTradeEventOnChain,
    DcaIndexerOrderCancelRequest,
    DcaIndexerOrderCancelResponse,
    DcaIndexerOrderCreateRequest,
    DcaIndexerOrderCreateResponse,
    DcaIndexerOrdersRequest, 
    DcaIndexerOrdersResponse
} from "./dcaApiCastingTypes";
import { MoveErrors } from "../../../general/types/moveErrorsInterface";
import { Transaction, TransactionObjectArgument } from "@mysten/sui/transactions";

const ED25519_PK_FLAG = 0x00;
const GAS_SUI_AMOUNT = BigInt(5_000_000);                   // 0.005 SUI
const ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS = BigInt(10000);     // Maximum valued
const MAX_AMOUNT_OUT = 2 ** 52;
    
export class DcaApi {

    // =========================================================================
    // Constants
    // =========================================================================

    private static readonly constants = {
        moduleNames: {
            dca: "order",
            events: "events",
            config: "config"
        },
        eventNames: {
            createdOrder: "CreatedOrderEvent",
            closedOrder: "CancelledOrderEvent",
            executedTrade: "ExecutedTradeEvent",
        }
    }

    // =========================================================================
    // Class Members
    // =========================================================================

    public readonly addresses: DcaAddresses;
    public readonly sharedCustodyAddresses: SharedCustodyAddresses;
    public readonly moveErrors: MoveErrors;

    public readonly eventTypes: {
        createdOrder: AnyObjectType;
        closedOrder: AnyObjectType;
        executedTrade: AnyObjectType;
    }

    // =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
        const addresses = this.Provider.addresses.dca;
        const sharedCustodyAddresses = this.Provider.addresses.sharedCustody;
		if (!addresses || !sharedCustodyAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
        this.sharedCustodyAddresses = sharedCustodyAddresses;
        this.eventTypes = {
            createdOrder: this.createdOrderEventType(),
            closedOrder: this.closedOrderEventType(),
            executedTrade: this.executedOrderEventType(),
        }
        this.moveErrors = {
			[this.addresses.packages.dca]: {
				[DcaApi.constants.moduleNames.dca]: {
                    /// A trade resulted in a price outside of the maximum slippage.
                    0: "Invalid slippage",
                    // A user tried to create an `Order` by passing an `input_coin` with a value of zero.
                    1: "Input coin has zero value",
                    /// A user tried to perform a DCA trade that results in a `coin_out` with a value:
                    ///   i. less than the permissible minimum amount out (`order.min_amount_out`), or 
                    ///  ii. greater than the permissible maximum amount out (`order.max_amount_out`).
                    2: "Invalid strategy min or max values",
                    /// A user tried to execute a DCA tx on an `order` that has no balance left to trade.
                    3: "Not enough balance",
                    /// A user tried to send themselves the same coin type over time using this DCA package.
                    4: "Sending same coin type to same address is prohibited"
                },
                [DcaApi.constants.moduleNames.config]: {
                    /// A user tried to interact with an old contract.
                    0: "Invalid contract version",
                    /// A user tried to create an order with a `frequncy_ms` value smaller than the minimum permissible
                    ///  trading frequency.
                    1: "Invalid frequency value. Value is smaller then the minimum permissible.",
                    /// A user tried to create an `Order` but didn't provide enough SUI to cover the expected gas for
                    ///  all of the dca trades.
                    2: "Not enough gas to cover all dca trades",
                    /// `create_package_config` has been called outside of this packages `init` function.
                    3: "Incorrect create package config call. Called outside the packages `init` function",
                }
            }
        }
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
        const orderAmountPerTrade = inputs.allocateCoinAmount / BigInt(inputs.tradesAmount);
        const recipientAddress = inputs.customRecipient ? inputs.customRecipient : walletAddress;

        const [gasCoinTxArg, inputCoinTxArg] = await Promise.all([
            this.Provider.Coin().fetchCoinWithAmountTx({
                tx,
                walletAddress,
                coinType: Coin.constants.suiCoinType,
                coinAmount: tradesGasAmount,                    
                isSponsoredTx: inputs.isSponsoredTx
            }),
            this.Provider.Coin().fetchCoinWithAmountTx({
                tx,
                walletAddress,
                coinType: inputs.allocateCoinType,
                coinAmount: inputs.allocateCoinAmount,
                isSponsoredTx: inputs.isSponsoredTx
            })
        ])
        
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

    public fetchBuildCancelOrderTx = async (
        inputs: ApiDcaTransactionForCancelOrderBody
        ): Promise<Transaction> =>  {
        const { walletAddress } = inputs;
        const tx = await this.getSponsorTransaction(walletAddress);
        this.createCancelOrderTx({
            ...inputs,
            tx,
        });
        return tx;
    }

    // =========================================================================
    // Transaction Commands
    // =========================================================================

    public createNewOrderTx = async (inputs: {
        tx: Transaction,
        inputCoinTxArg: TransactionObjectArgument,
        gasCoinTxArg: TransactionObjectArgument,
        recipientAddress: SuiAddress,
        orderAmountPerTrade: Balance,
    } & ApiDcaTransactionForCreateOrderBody) => {
        const initTx = inputs.tx ?? new Transaction();

        const txBytes = await initTx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});

		const b64TxBytes = Buffer.from(txBytes).toString("base64");

        const { tx_data } =
			await this.Provider.indexerCaller.fetchIndexer<
                DcaIndexerOrderCreateResponse,
                DcaIndexerOrderCreateRequest
			>(
				"dca/create",
				{
                    tx_kind: b64TxBytes,
					order: {
                        input_coin: Helpers.transactions.serviceCoinDataFromCoinTxArg({
                            coinTxArg: inputs.inputCoinTxArg,
                        }),
                        input_coin_type: inputs.allocateCoinType,
                        output_coin_type: inputs.buyCoinType,
                        gas_coin: Helpers.transactions.serviceCoinDataFromCoinTxArg({
                            coinTxArg: inputs.gasCoinTxArg,
                        }),
                        owner: inputs.walletAddress,
                        user_pk: inputs.publicKey,
                        recipient: inputs.recipientAddress,
                        frequency_ms: inputs.frequencyMs,
                        delay_timestamp_ms: inputs.delayTimeMs,
                        amount_per_trade: Number(inputs.orderAmountPerTrade),
                        max_allowable_slippage_bps: Number(ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS),
                        min_amount_out: Number(inputs.straregy?.priceMin ?? 0),
                        max_amount_out: Number(inputs.straregy?.priceMax ?? MAX_AMOUNT_OUT),
                        number_of_trades: Number(inputs.tradesAmount)
                    }
				},
				undefined,
				undefined,
				undefined,
				true
			);

        const tx = Transaction.fromKind(tx_data);
        DcaApi.transferTxMetadata({
			initTx,
			newTx: tx,
		});
        return tx;
    }

    public createCancelOrderTx = (inputs: {
        tx: Transaction | TransactionBlock,
        allocateCoinType: CoinType,
        buyCoinType: CoinType,
        orderId: ObjectId | TransactionArgument
    }) => {
        const { tx } = inputs;
        return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
                this.addresses.packages.dca,
                DcaApi.constants.moduleNames.dca,
                "close_order"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
                tx.object(inputs.orderId),
                tx.object(this.addresses.objects.config),
            ],
        });
    }

    // =========================================================================
    // Class Objects
    // =========================================================================

    public fetchAllOrdersObjects = async (inputs: {
        walletAddress: SuiAddress;
    }): Promise<DcaOrdersObject> => {
        const [
            activeOrders = [], 
            pastOrders = []
        ] = await Promise.all([
            this.fetchActiveOrdersObjects(inputs),
            this.fetchPastOrdersObjects(inputs)
        ])
        return {
            active: activeOrders,
            past: pastOrders
        }
    }

    public fetchActiveOrdersObjects = async (inputs: {
        walletAddress: SuiAddress
    }): Promise<DcaOrderObject[]> => {
        return this.fetchOrdersObjectsByType({
            ...inputs, 
            type: "active"
        });
    }

    public fetchPastOrdersObjects = async (inputs: {
        walletAddress: SuiAddress
    }): Promise<DcaOrderObject[]> => {
        return this.fetchOrdersObjectsByType({
            ...inputs, 
            type: "past"
        });
    }

    public fetchOrdersObjectsByType = async (inputs: {
        walletAddress: SuiAddress,
        type: "active" | "past"
    }): Promise<DcaOrderObject[]> => {
        const {
            type,
            walletAddress
        } = inputs;
        const uncastedResponse = 
            await this.Provider.indexerCaller.fetchIndexer<
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
        return uncastedResponse.orders
            .sort((lhs, rhs) => rhs.created.timestamp - lhs.created.timestamp)
            .map(order => Casting.dca.createdOrderEventOnIndexer(order));
    }

    public fetchOrderExecutionPause = async (
		inputs: DcaIndexerOrderCancelRequest
	): Promise<DcaIndexerOrderCancelResponse> => {
        const { order_object_id } = inputs;
        return this.Provider.indexerCaller.fetchIndexer<
            DcaIndexerOrderCancelResponse,
            DcaIndexerOrderCancelRequest
        >(
            "dca/cancel", 
            {
                order_object_id
            },
            undefined,
            undefined,
            undefined,
            true
        );
    }

    // =========================================================================
    // Onchain Objects Fetch
    // =========================================================================

    public fetchAllOrdersObjectsOnChain = async (inputs: {
        walletAddress: SuiAddress
    }): Promise<DcaOrdersObject> => {
        const { walletAddress } = inputs;

        const [allEventOrders, allExecutedTrades] = await Promise.all([
            (
                await this.Provider.Events().fetchAllEvents({
                    fetchEventsFunc: (eventInputs) =>
                        this.fetchCreatedDcaOrdersEvents(eventInputs),
                })
            ).filter(order => order.owner == walletAddress), // Is it good to fetch all and then filter?
            this.fetchAllTradesObjectsOnChain()
        ]);

        const allEventOrdersIds = allEventOrders.map(order => order.orderId)

        const partialCreatedOrderObjects =
			await this.Provider.Objects().fetchCastObjectBatch({
                objectIds: allEventOrdersIds,
                objectFromSuiObjectResponse: Casting.dca.partialOrdersObjectFromSuiObjectResponse,
            });

        const createdOrderObjects = partialCreatedOrderObjects
        .filter(order => order != undefined)
        .map(
            order => this.preparePartialDcaOrder(order, allEventOrders, allExecutedTrades)
        );

        const activeOrdersObjects = createdOrderObjects.filter(
            order => order.overview.tradesRemaining != 0
        );
        
        const pastOrdersObjects = createdOrderObjects.filter(
            order => order.overview.tradesRemaining == 0
        );

        return Promise.resolve({
            active: activeOrdersObjects,
            past: pastOrdersObjects
        });
    }

    public fetchActiveOrdersObjectsOnChain = async (inputs: {
        walletAddress: SuiAddress
    }): Promise<DcaOrderObject[]> => {
        const allOrders = await this.fetchAllOrdersObjectsOnChain(inputs);
        return allOrders.active;
    }

    public fetchPastOrdersObjectsOnChain = async (inputs: {
        walletAddress: SuiAddress
    }): Promise<DcaOrderObject[]> => {
        const allOrders = await this.fetchAllOrdersObjectsOnChain(inputs);
        return allOrders.past;
    }

    public fetchAllTradesObjectsOnChain = async (): Promise<DcaExecutedTradeEvent[]> => {
        return (
			await this.Provider.Events().fetchAllEvents({
				fetchEventsFunc: (eventInputs) =>
					this.fetchExecutedTradeEvents(eventInputs),
			})
		);
    }

    // =========================================================================
    // Events
    // =========================================================================

    public fetchCreatedDcaOrdersEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			DcaCreatedOrderEventOnChain,
			DcaCreatedOrderEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.createdOrder,
			},
			eventFromEventOnChain: Casting.dca.createdDcaOrderEventFromOnChain,
		});

    public fetchCanceledDcaOrdersEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			DcaClosedOrderEventOnChain,
			DcaCancelledOrderEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.closedOrder,
			},
			eventFromEventOnChain: Casting.dca.cancelledDcaOrderEventFromChain,
		});

    public fetchExecutedTradeEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			DcaExecutedTradeEventOnChain,
			DcaExecutedTradeEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.executedTrade,
			},
			eventFromEventOnChain: Casting.dca.executedTradeEventFromChain,
		});

    // =========================================================================
    // Helpers
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

    private preparePartialDcaOrder = (
        order: DcaOrderObject,
        allEventOrders: DcaCreatedOrderEvent[],
        allExecutedTrades: DcaExecutedTradeEvent[]
    ) => {
        const eventOrder = allEventOrders.find(eventOrder => eventOrder.orderId == order.objectId);
        const executedOrders = allExecutedTrades.filter(trade => trade.orderId == order.objectId)
        const executedOrdersAmount = executedOrders.length;
        const totalTradesAmount = order.overview.tradesRemaining + executedOrdersAmount;

        const { totalSpent, totalBought } = executedOrders.reduce((total, order) => {
            total.totalSpent += order.inputAmount;
            total.totalBought += order.outputAmount;
            return total;
        }, { 
            totalSpent: BigInt(0), 
            totalBought: BigInt(0) 
        });

        const started = executedOrdersAmount > 0 ? { 
			timestamp:executedOrders[0].timestamp,
			digest:  executedOrders[0].txnDigest,
		} : undefined;

        const lastExecutedTrade = executedOrdersAmount > 0 ? { 
			timestamp: executedOrders[executedOrdersAmount - 1].timestamp,
			digest:  executedOrders[executedOrdersAmount - 1].txnDigest,
		} : undefined;

        order.trades = executedOrders.map(trade => Casting.dca.tradeEventToObject(trade))
        order.overview.totalSpent = totalSpent;
        order.overview.buyCoin.amount = totalBought;
        order.overview.totalTrades = totalTradesAmount;
        order.overview.progress = totalTradesAmount !== 0 ?
                                    (totalTradesAmount - order.overview.tradesRemaining) / totalTradesAmount
                                        :
                                    0;
        order.overview.averagePrice = executedOrdersAmount ? 
                                        totalSpent / BigInt(executedOrdersAmount) 
                                            : 
                                        BigInt(0);
        order.overview.created = {
            time:  Number(eventOrder?.timestamp),
            tnxDigest: eventOrder?.txnDigest ?? "",
        }
        order.overview.started = started ? {
            time: started.timestamp,
            tnxDigest: started.digest
        } : undefined;
        order.overview.lastExecutedTradeTime = lastExecutedTrade ? {
            time: lastExecutedTrade.timestamp,
            tnxDigest: lastExecutedTrade.digest
        } : undefined;

        return order;
    }

    private getSponsorTransaction = async (
        sponsor: SuiAddress
    ): Promise<Transaction> => {
        const txBlock = new Transaction();
        const kindBytes = await txBlock.build({ onlyTransactionKind: true });
        const tx = Transaction.fromKind(kindBytes);
        tx.setGasOwner(sponsor);
        return tx;
    }

    private static transferTxMetadata = (inputs: {
		initTx: Transaction;
		newTx: Transaction;
	}) => {
		const { initTx, newTx } = inputs;

		const sender = initTx.getData().sender;
		if (sender) newTx.setSender(sender);

		const expiration = initTx.getData().expiration;
		if (expiration) newTx.setExpiration(expiration);

		const gasData = initTx.getData().gasData;

		if (gasData.budget && typeof gasData.budget !== "string")
			newTx.setGasBudget(gasData.budget);

		if (gasData.owner) newTx.setGasOwner(gasData.owner);

		if (gasData.payment) newTx.setGasPayment(gasData.payment);

		if (gasData.price && typeof gasData.price !== "string")
			newTx.setGasPrice(gasData.price);

        console.log({
            gasData,
            budget: gasData.budget,
            owner: gasData.owner,
            payment: gasData.payment,
        })
	};
}
