import { TransactionArgument, TransactionBlock } from "@mysten/sui.js/transactions";
import { ApiDcaCancelOrderBody, ApiDcaInitializeOrderBody, ApiDcaInitializeOrdertStrategyBody, DcaCancelledOrderEvent, DcaCreatedOrderEvent, DcaExecutedTradeEvent, DcaOrdersOjbect } from "../dcaTypes";
import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, Balance, CoinType, DcaAddresses, EventsInputs, IFixed, ObjectId, SuiAddress, Timestamp } from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { DcaCancelledOrderEventOnChain, DcaCreatedOrderEventOnChain, DcaExecutedTradeEventOnChain } from "./dcaApiCastingTypes";
import { Casting, Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import { Coin } from "../../coin";

const ED25519_PK_FLAG = 0x00;
const GAS_SUI_AMOUNT = BigInt(50_000_000);                  // 0.05 SUI
const ALLOWABLE_DEVIATION_MS = BigInt(0.1 * 1e9);
const ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS = BigInt(10000);     // Maximum valued
    
export class DcaApi {

    // =========================================================================
    // Constants
    // =========================================================================

    private static readonly constants = {
        moduleNames: {
            dca: "dca",
            events: "events"
        },
        eventNames: {
            createdOrder: "CreatedOrderEvent",
            canceledOrder: "CancelledOrderEvent",
            executedTrade: "ExecutedTradeEvent",
        }
    }

    public readonly objectTypes: {
		order: AnyObjectType;
		trade: AnyObjectType;
	};

    // =========================================================================
    // Class Members
    // =========================================================================

    public readonly addresses: DcaAddresses;

    public readonly eventTypes: {
        createdOrder: AnyObjectType;
        canceledOrder: AnyObjectType;
        executedTrade: AnyObjectType;
    }

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
            canceledOrder: this.canceledOrderEventType(),
            executedTrade: this.executedOrderEventType(),
        }

        this.objectTypes = {
            order: `${addresses.packages.dca}::${DcaApi.constants.moduleNames.dca}::Order`,
            trade: `${addresses.packages.dca}::${DcaApi.constants.moduleNames.dca}::trade`,
        }
    }

    // =========================================================================
	//  Public Transaction Methods
	// =========================================================================

    public fetchBuildCreateOrderTx = async (
        inputs: ApiDcaInitializeOrderBody
    ): Promise<TransactionBlock> => {
        const { walletAddress } = inputs;
        const tx = new TransactionBlock();
        tx.setSender(walletAddress);

        const gasCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: Coin.constants.suiCoinType,
			coinAmount: GAS_SUI_AMOUNT,                    
            isSponsoredTx: inputs.isSponsoredTx
		});

        const inputCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.allocateCoinType,
			coinAmount: inputs.allocateCoinAmount,
            isSponsoredTx: inputs.isSponsoredTx
		});

        const orderAmountPerTrade = inputs.allocateCoinAmount / BigInt(inputs.tradesAmount);
        
        this.createNewOrderTx({
            ...inputs,
            tx,
            gasCoinId,
            inputCoinId,
            orderAmountPerTrade
        });

        return tx;
    };

    public fetchBuildCancelOrderTx = async (
        inputs: ApiDcaCancelOrderBody
    ): Promise<TransactionBlock> => {
        const { walletAddress } = inputs;
        const tx = new TransactionBlock();
        tx.setSender(walletAddress);
        this.createCancelOrderTx({
            ...inputs,
            tx,
        });
        return tx;
    }

    // =========================================================================
    // Transaction Commands
    // =========================================================================

    public createNewOrderTx = (inputs: {
        tx: TransactionBlock,
        walletAddress: SuiAddress,
        allocateCoinType: CoinType,
        allocateCoinAmount: Balance,
        buyCoinType: CoinType,
        inputCoinId: ObjectId,
        gasCoinId: ObjectId | TransactionArgument,
        frequencyMs: Timestamp,
        delayTimeMs: Timestamp,
        coinPerTradeAmount: Balance,
        maxAllowableSlippageBps: Balance,
        tradesAmount: number,
        publicKey: Uint8Array,
        orderAmountPerTrade: Balance;
        straregy?: ApiDcaInitializeOrdertStrategyBody,
    }) => {
        const { tx } = inputs;

        // Todo: - Do we need it here? Added ED25519 flag at the beggining of the array. 
        const publicKeyPrepared = Array.from(Buffer.concat([Buffer.from([ED25519_PK_FLAG]), inputs.publicKey]));

        return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
                this.addresses.packages.dca,
                DcaApi.constants.moduleNames.dca,
                "create_order"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
                tx.object(this.addresses.objects.config),
                tx.object(inputs.inputCoinId),
                tx.object(inputs.gasCoinId),
                tx.object(Sui.constants.addresses.suiClockId),
                tx.pure(publicKeyPrepared, "vector<u8>"),
                tx.pure(inputs.frequencyMs, "u64"),
                tx.pure(inputs.delayTimeMs, "u64"),
                tx.pure(ALLOWABLE_DEVIATION_MS, "u64"),
                tx.pure(inputs.orderAmountPerTrade, "u64"),
                tx.pure(ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS, "u16"),
                tx.pure(inputs.straregy?.priceMin ?? 0, "u64"),
                tx.pure(inputs.straregy?.priceMax ?? Casting.u64MaxBigInt, "u64"),
                tx.pure(inputs.tradesAmount, "u8"),
            ],
        });
    }

    public createCancelOrderTx = (inputs: {
        tx: TransactionBlock,
        allocateCoinType: CoinType,
        buyCoinType: CoinType,
        orderId: ObjectId | TransactionArgument
    }) => {
        const { tx } = inputs;
        return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
                this.addresses.packages.dca,
                DcaApi.constants.moduleNames.dca,
                "cancel_order"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
                tx.object(this.addresses.objects.config),
                tx.object(inputs.orderId),
            ],
        });
    }

    // =========================================================================
    // Class Objects
    // =========================================================================

    public fetchDcaOrdersObject = async (inputs: {
        walletAddress: SuiAddress;   
    }): Promise<DcaOrdersOjbect> => {
        const { walletAddress } = inputs;

        const [createdOrderEvents, allTrades] = await Promise.all([
            (
                await this.Provider.Events().fetchAllEvents({
                    fetchEventsFunc: (eventInputs) =>
                        this.fetchCreatedDcaOrdersEvents(eventInputs),
                })
            ).filter(order => order.owner == walletAddress),
            this.fetchAllDcaOrderTradesObject()
        ])

        const createdOrderEventsIds = createdOrderEvents.map(order => order.orderId)

        const partialCreatedOrderObjects =
			await this.Provider.Objects().fetchCastObjectBatch({
                objectIds: createdOrderEventsIds,
                objectFromSuiObjectResponse: Casting.dca.partialOrdersObjectFromSuiObjectResponse,
            });

        const createdOrderObjects = partialCreatedOrderObjects.map(order => {
            const eventOrder = createdOrderEvents.find(eventOrder => eventOrder.orderId == order.objectId);
            var orderTrades = allTrades.filter(trade => trade.orderId == order.objectId)
            order.overview.tnxDigest = eventOrder?.txnDigest ?? "";
            order.overview.created = Number(eventOrder?.timestamp);
            order.overview.totalOrders = order.overview.ordersRemaining + orderTrades.length;

            // FOR TEST PURPOSE ONLY
            orderTrades.push(this.getTestTradeEvent(BigInt(100_000_000)));
            orderTrades.push(this.getTestTradeEvent(BigInt(200_000_000)));
            orderTrades.push(this.getTestTradeEvent(BigInt(300_000_000)));

            var totalTradesPriceValue: Balance = BigInt(0);
            orderTrades.map(trade => {
                totalTradesPriceValue += trade.inputAmount;
                order.trades.push(Casting.dca.tradeEventToObject(trade))
            })
            order.overview.averagePrice = totalTradesPriceValue /= BigInt(orderTrades.length);
            return order;
        })

        return Promise.resolve({
            active: createdOrderObjects,
            past: []
        });
    }

    // Todo: - Change it with cursor fetching
    public fetchAllDcaOrderTradesObject = async (): Promise<DcaExecutedTradeEvent[]> => {
        return (
			await this.Provider.Events().fetchAllEvents({
				fetchEventsFunc: (eventInputs) =>
					this.fetchExecutedTradeEvents(eventInputs),
			})
		)
    }

    public fetchDcaOrderTradesObject = async (inputs: {
        orderId: ObjectId
    }): Promise<DcaExecutedTradeEvent[]> => {
        return (
			await this.Provider.Events().fetchAllEvents({
				fetchEventsFunc: (eventInputs) =>
					this.fetchExecutedTradeEvents(eventInputs),
			})
		).filter(trade => trade.orderId == inputs.orderId)
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
			DcaCancelledOrderEventOnChain,
			DcaCancelledOrderEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.canceledOrder,
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
    // Order Creation
    // =========================================================================

    private createdOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrder
		);
    
    private canceledOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.canceledOrder
		);

    private executedOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.executedTrade
		);

    private getTestTradeEvent = (amount: bigint) => {
        return {
            orderId: "0x577aedab658687dd03c41a566928c98cd85c96885fb43b17a8bc7568da1d876b",
            owner: "0x45c7d4f327ec05e35ced427b44241dd932e7c8532b5d3791fe0e5c7277ce3c4a",
            inputType: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
            inputAmount: amount,
            outputType: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
            outputAmount: amount,
            type: "",
            timestamp: 1715456204000,
            txnDigest: ""
        }
    }
}



// const canceledObjectIds = (
// 	await this.Provider.Events().fetchAllEvents({
// 		fetchEventsFunc: (eventInputs) =>
// 			this.fetchCanceledDcaOrdersEvents(eventInputs),
// 	})
// ).map(order => order.orderId);


// const partialCreatedOrders =
// 	await this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
//         walletAddress: walletAddress,
//         objectType: this.objectTypes.order,
//         objectFromSuiObjectResponse: Casting.dca.partialOrdersObjectFromSuiObjectResponse,
//     });