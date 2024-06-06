import { TransactionBlock } from "@mysten/sui.js/transactions";
import { ApiDcaInitializeOrderBody, ApiDcaInitializeOrdertStrategyBody, DcaCancelledOrderEvent, DcaCreatedOrderEvent, DcaExecutedTradeEvent, DcaOrdersOjbect } from "../dcaTypes";
import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, Balance, CoinType, DcaAddresses, EventsInputs, ObjectId, SuiAddress, Timestamp } from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { DcaCancelledOrderEventOnChain, DcaCreatedOrderEventOnChain, DcaExecutedTradeEventOnChain } from "./dcaApiCastingTypes";
import { Casting, Helpers } from "../../../general/utils";
import { Sui } from "../../sui";

    
export class DcaApi {

    // =========================================================================
    // Constants
    // =========================================================================

    private static readonly constants = {
        moduleNames: {
            dca: "dca",
        },
        eventNames: {
            createdOrder: "CreatedOrderEvent",
            canceledOrder: "CancelledOrderEvent",
            executedTrade: "ExecutedTradeEvent",
        }
    }

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
    }

    private test = async (inputs: {
        walletAddress: SuiAddress;   
    }) => {
        const t = await this.Provider.Objects().fetchOwnedObjects(inputs);
        console.log(t);
    }

    // =========================================================================
	//  Public Methods
	// =========================================================================

    public fetchBuildCreateOrder = async (
        inputs: ApiDcaInitializeOrderBody
    ): Promise<TransactionBlock> => {
        const { walletAddress } = inputs;
        const tx = new TransactionBlock();
        tx.setSender(walletAddress);

        const gasCoinAmount: Balance = BigInt(0.5 * 1e9); // Todo - Calculate it dynamicaly 

        const inputCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.allocateCoinType,
			coinAmount: inputs.allocateCoinAmount,
            isSponsoredTx: inputs.isSponsoredTx
		});

        const gasCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.allocateCoinType,
			coinAmount: gasCoinAmount,                    
            isSponsoredTx: inputs.isSponsoredTx
		});
        
        const orderId = this.createNewOrderTx({
			...inputs,
			tx,
            inputCoinId,
            gasCoinId
		});

        const result = this.createMoveNewOrderTx({
            ...inputs,
            tx,
            orderId,
            walletAddress
        })

        console.log({
            orderId: orderId,
            result: result
        })
        
        return tx;
    };

    public createNewOrderTx = (inputs: {
        tx: TransactionBlock,
        inputCoinId: ObjectId,
        gasCoinId: bigint,
        walletAddress: SuiAddress,
        allocateCoinType: CoinType,
        allocateCoinAmount: Balance,
        buyCoinType: CoinType,
        timeInterval: Timestamp,
        orderCount: Timestamp,
        straregy?: ApiDcaInitializeOrdertStrategyBody,
    }) => {
        const {
            tx,
            inputCoinId,
            gasCoinId
         } = inputs;

        const prepared = {
            inputCoinId: inputCoinId,
            config: this.addresses.objects.config,
            gas: inputs.allocateCoinType,
            clock: Sui.constants.addresses.suiClockId,
            frequency_ms: inputs.timeInterval,
            allowable_deviation_ms: 0,
            delay_timestamp_ms: 0,
            amount_per_trade: 0,
            max_allowable_slippage_bps: 0,
            min_amount_out: inputs.straregy?.priceMin || 0,
            max_amount_out: inputs.straregy?.priceMin || 0,
            number_of_trades: inputs.orderCount
        }

        const result = tx.moveCall({
            target: Helpers.transactions.createTxTarget(
                this.addresses.packages.dca,
                DcaApi.constants.moduleNames.dca,
                "create_order"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
                tx.object(prepared.config),
                tx.object(inputCoinId),
                tx.object(gasCoinId),
                tx.object(prepared.clock),
                tx.pure(prepared.frequency_ms, "u64"),
                tx.pure(prepared.delay_timestamp_ms, "u64"),
                tx.pure(prepared.allowable_deviation_ms, "u64"),
                tx.pure(prepared.amount_per_trade, "u64"),
                tx.pure(prepared.max_allowable_slippage_bps, "u16"),
                tx.pure(prepared.min_amount_out, "u64"),
                tx.pure(prepared.max_amount_out, "u64"),
                tx.pure(prepared.number_of_trades, "u8"),
            ],
        });
        console.log({
            prepared: prepared,
            result: result
        })

        return result;
    }

    public createMoveNewOrderTx = (inputs: {
        tx: TransactionBlock,
        orderId: ObjectId,
        allocateCoinType: CoinType,
        buyCoinType: CoinType,
        walletAddress: SuiAddress
    }) => {
        const { tx } = inputs;
        return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
                this.addresses.packages.dca,
                DcaApi.constants.moduleNames.dca,
                "transfer"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
                tx.object(inputs.orderId),
                tx.object(this.addresses.objects.config),
                tx.pure(inputs.walletAddress)
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
        // if (!walletAddress) return Promise.reject(new Error('walletAddress is undefined'));


        // const objectIds = (
		// 	await this.Provider.Events().fetchAllEvents({
		// 		fetchEventsFunc: (eventInputs) =>
		// 			this.fetchCreatedDcaOrdersEvents(eventInputs),
		// 	})
		// );

        // console.log({
        //     objectIds: objectIds
        // })

        return Promise.resolve({
            active: [
                {
                    overview: {
                        allocatedCoin: {
                            coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            amount: 1000
                        },
                        buyCoin: {
                            coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            amount: 100
                        },
                        allocatedCoinStartAmount: BigInt(1000000000000),
                        progress: 0.7,
                        widthrowAmount: BigInt(1000000000000),
                        totalDeposited: BigInt(1000000000000),
                        totalSpent: BigInt(1000000000000),
                        averagePrice: BigInt(1000000000000),
                        totalOrders: 6,
                        interval: BigInt(1000000000000),
                        ordersRemaining: 4,
                        eachOrderSize: BigInt(0),
                        created: 1715360395000,
                        tnxDigest: ""
                    },
                    trades: [
                        {
                            allocatedCoin: {
                                coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                                amount: 1000
                            },
                            buyCoin: {
                                coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                                amount: 100
                            },
                            buyDate: 1715456204000,
                            rate: 1.14
                        },
                        {
                            allocatedCoin: {
                                coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                                amount: 1000
                            },
                            buyCoin: {
                                coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                                amount: 100
                            },
                            buyDate: 1715456204000,
                            rate: 1.45
                        }
                    ]
                },
                {
                    overview: {
                        allocatedCoin: {
                            coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            amount: 1000
                        },
                        buyCoin: {
                            coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            amount: 100
                        },
                        allocatedCoinStartAmount: BigInt(1000000000000),
                        progress: 0.7,
                        widthrowAmount: BigInt(1000000000000),
                        totalDeposited: BigInt(1000000000000),
                        totalSpent: BigInt(1000000000000),
                        averagePrice: BigInt(1000000000000),
                        totalOrders: 6,
                        interval: BigInt(1000000000000),
                        ordersRemaining: 4,
                        eachOrderSize: BigInt(0),
                        created: 1715360395000,
                        tnxDigest: ""
                    },
                    trades: [
                        {
                            allocatedCoin: {
                                coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                                amount: 1000
                            },
                            buyCoin: {
                                coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                                amount: 100
                            },
                            buyDate: 1715456204000,
                            rate: 1.14
                        },
                        {
                            allocatedCoin: {
                                coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                                amount: 1000
                            },
                            buyCoin: {
                                coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                                amount: 100
                            },
                            buyDate: 1715456204000,
                            rate: 1.45
                        }
                    ]
                }
            ],
            past: [
                {
                    overview: {
                        allocatedCoin: {
                            coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            amount: 1000
                        },
                        buyCoin: {
                            coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            amount: 100
                        },
                        allocatedCoinStartAmount: BigInt(1000000000000),
                        progress: 0.7,
                        widthrowAmount: BigInt(1000000000000),
                        totalDeposited: BigInt(1000000000000),
                        totalSpent: BigInt(1000000000000),
                        averagePrice: BigInt(1000000000000),
                        totalOrders: 6,
                        interval: BigInt(1000000000000),
                        ordersRemaining: 4,
                        eachOrderSize: BigInt(0),
                        created: 1715360395000,
                        tnxDigest: ""
                    },
                    trades: [
                        {
                            allocatedCoin: {
                                coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                                amount: 1000
                            },
                            buyCoin: {
                                coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                                amount: 100
                            },
                            buyDate: 1715456204000,
                            rate: 1.14
                        },
                        {
                            allocatedCoin: {
                                coin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                                amount: 1000
                            },
                            buyCoin: {
                                coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                                amount: 100
                            },
                            buyDate: 1715456204000,
                            rate: 1.45
                        }
                    ]
                }
            ]
        });
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
			DcaApi.constants.moduleNames.dca,
			DcaApi.constants.eventNames.createdOrder
		);
    
    private canceledOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.dca,
			DcaApi.constants.eventNames.canceledOrder
		);

    private executedOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.dca,
			DcaApi.constants.eventNames.executedTrade
		);
}
    


// const payload = {
//     type: "entry_function_payload",
//     function: `${contractAddress}::${moduleName}::${functionName}`,
//     arguments: [
//         witness, // передаем witness как аргумент
//         ctx // передаем ctx как аргумент
//     ],
//     type_arguments: []
// };