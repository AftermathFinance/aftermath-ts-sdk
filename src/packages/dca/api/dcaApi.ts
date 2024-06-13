import { TransactionArgument, TransactionBlock } from "@mysten/sui.js/transactions";
import { ApiDcaInitializeOrderBody, ApiDcaInitializeOrdertStrategyBody, DcaCancelledOrderEvent, DcaCreatedOrderEvent, DcaExecutedTradeEvent, DcaOrdersOjbect } from "../dcaTypes";
import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, Balance, CoinType, DcaAddresses, EventsInputs, IFixed, ObjectId, SuiAddress, Timestamp } from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { DcaCancelledOrderEventOnChain, DcaCreatedOrderEventOnChain, DcaExecutedTradeEventOnChain } from "./dcaApiCastingTypes";
import { Casting, Helpers } from "../../../general/utils";
import { Sui } from "../../sui";

const GAS_SUI_AMOUNT = BigInt(50_000_000);                  // 0.5 SUI
const ALLOWABLE_DEVIATION_MS = BigInt(0.1 * 1e9);
const ORDER_MAX_AMOUNT_OUT = BigInt(18_446_744_073_709_551_615);

const SUI_COIN_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';       //SUI
    
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

    public fetchBuildCreateOrderTx = async (
        inputs: ApiDcaInitializeOrderBody
    ): Promise<TransactionBlock> => {
        const { walletAddress } = inputs;
        const tx = new TransactionBlock();
        tx.setSender(walletAddress);

        const gasCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: SUI_COIN_TYPE,
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
        
        const [orderId] = this.createNewOrderTx({
            ...inputs,
            tx,
            gasCoinId,
            inputCoinId
        });

        this.createtTransferNewOrderTx({
            ...inputs,
            tx,
            orderId,
            recipientAddress: walletAddress
        })
        
        return tx;
    };

    public createNewOrderTx = (inputs: {
        tx: TransactionBlock,
        walletAddress: SuiAddress,
        allocateCoinType: CoinType,
        allocateCoinAmount: Balance,
        buyCoinType: CoinType,
        inputCoinId: ObjectId,
        gasCoinId: bigint,
        frequencyMs: Timestamp,
        delayTimeMs: Timestamp,
        coinPerTradeAmount: Balance
        maxAllowableSlippageBps: Balance,
        tradesAmount: number,
        straregy?: ApiDcaInitializeOrdertStrategyBody,
    }) => {
        const { tx } = inputs;

        const ORDER_AMOUNT_PER_TRADE = BigInt(250_000_000);         // 0.25 SUI (1 SUI = 10^9)
        const ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS = BigInt(10000);     // Maximum value

        const moveOject = {
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
                tx.pure(inputs.frequencyMs, "u64"),
                tx.pure(inputs.delayTimeMs, "u64"),
                tx.pure(ALLOWABLE_DEVIATION_MS, "u64"),
                tx.pure(ORDER_AMOUNT_PER_TRADE, "u64"),
                tx.pure(ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS, "u16"),
                tx.pure(inputs.straregy?.priceMin ?? 0, "u64"),
                tx.pure(inputs.straregy?.priceMax ?? ORDER_MAX_AMOUNT_OUT, "u64"),
                tx.pure(inputs.tradesAmount, "u8"),
            ],
        }

        console.log("max strategy", inputs.straregy?.priceMax ?? ORDER_MAX_AMOUNT_OUT);
        const result = tx.moveCall(moveOject);
        return result;
    }

    public createtTransferNewOrderTx = (inputs: {
        tx: TransactionBlock,
        orderId: ObjectId | TransactionArgument,
        allocateCoinType: CoinType,
        buyCoinType: CoinType,
        recipientAddress: SuiAddress
    }) => {
        const { tx, orderId } = inputs;
        const moveOject = {
            target: Helpers.transactions.createTxTarget(
                this.addresses.packages.dca,
                DcaApi.constants.moduleNames.dca,
                "transfer"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
                typeof orderId === "string"
					? tx.object(orderId)
					: orderId,
                tx.object(this.addresses.objects.config),
                tx.pure(inputs.recipientAddress, "address")
            ],
        }
        console.log(moveOject)
        return tx.moveCall(moveOject);
    }

    public fetchBuildCancelOrderTx = async (
        inputs: ApiDcaInitializeOrderBody
    ): Promise<TransactionBlock> => {
        const { walletAddress } = inputs;
        const tx = new TransactionBlock();
        tx.setSender(walletAddress);
        return tx;
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
// /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222