import { TransactionBlock } from "@mysten/sui.js/transactions";
import { ApiDcaInitializeVaultBody, DcaCreatedVaultEvent, DcaVaultsOjbect } from "../dcaTypes";
import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, DcaAddresses, EventsInputs, SuiAddress } from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { DcaCreatedVaultEventOnChain } from "./dcaApiCastingTypes";
import { Casting } from "../../../general/utils";

    
export class DcaApi {

    // =========================================================================
    // Constants
    // =========================================================================

    private static readonly constants = {
        moduleNames: {
            events: "events",
        },
        eventNames: {
            createdVault: "CreatedVaultEvent",
        }
    }

    // =========================================================================
    // Class Members
    // =========================================================================

    public readonly addresses: DcaAddresses;

    public readonly eventTypes: {
        createdVault: AnyObjectType;
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
            // Creation
            createdVault: this.createdVaultEventType(),
        }
    }

    // =========================================================================
	//  Public Methods
	// =========================================================================

    public fetchBuildCreateVault = async (
        inputs: ApiDcaInitializeVaultBody
    ): Promise<TransactionBlock> => {
        const { walletAddress } = inputs;
        const tx = new TransactionBlock();
        tx.setSender(walletAddress);
        
        // Todo: - Setup transaction

        return tx;
    };

    // =========================================================================
    // Class Objects
    // =========================================================================

    public fetchDcaVaultsObject = async (inputs: {
        walletAddress: SuiAddress;   
    }): Promise<DcaVaultsOjbect> => {
        const { walletAddress } = inputs;
        console.log({
            function: "fetchDcaVaultObjects",
            walletAddress: walletAddress
        })
        return {
            active: [
                {
                    overview: {
                        allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                        buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                        startAllocatedCoinAmount: BigInt(1000000000000),
                        currentAllocatedCoinAmount: BigInt(1000000000000),
                        buyCoinAmount: BigInt(100000000000),
                        progress: 0.7,
                        widthrowAmount: BigInt(1000000000000),
                        totalDeposited: BigInt(1000000000000),
                        totalSpent: BigInt(1000000000000),
                        averagePrice: BigInt(1000000000000),
                        totalOrders: 6,
                        interval: BigInt(0),
                        ordersRemaining: 4,
                        eachOrderSize: BigInt(0),
                        created: 1715360395000
                    },
                    orders: [
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000,
                            rate: 1.14
                        },
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000,
                            rate: 1.45
                        }
                    ]
                },
                {
                    overview: {
                        allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                        buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                        startAllocatedCoinAmount: BigInt(0),
                        currentAllocatedCoinAmount: BigInt(0),
                        buyCoinAmount: BigInt(0),
                        progress: 0.7,
                        widthrowAmount: BigInt(0),
                        totalDeposited: BigInt(0),
                        totalSpent: BigInt(0),
                        averagePrice: BigInt(0),
                        totalOrders: 6,
                        interval: BigInt(0),
                        ordersRemaining: 4,
                        eachOrderSize: BigInt(0),
                        created: 1715360395000

                    },
                    orders: [
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000,
                            rate: 1.14
                        },
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000,
                            rate: 1.45
                        }
                    ]
                }
            ],
            past: [
                {
                    overview: {
                        allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                        buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                        startAllocatedCoinAmount: BigInt(0),
                        currentAllocatedCoinAmount: BigInt(0),
                        buyCoinAmount: BigInt(0),
                        progress: 0.7,
                        widthrowAmount: BigInt(0),
                        totalDeposited: BigInt(0),
                        totalSpent: BigInt(0),
                        averagePrice: BigInt(0),
                        totalOrders: 6,
                        interval: BigInt(0),
                        ordersRemaining: 4,
                        eachOrderSize: BigInt(0),
                        created: 1715360395000
                    },
                    orders: [
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000,
                            rate: 1.14
                        },
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000,
                            rate: 1.45
                        }
                    ]
                }
            ]
        };
    }

    // =========================================================================
    // Events
    // =========================================================================

    public fetchCreatedVaultEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			DcaCreatedVaultEventOnChain,
			DcaCreatedVaultEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.createdVault,
			},
			eventFromEventOnChain: Casting.dca.createdVaultEventFromOnChain,
		});

    // =========================================================================
    // Vault Creation
    // =========================================================================

    private createdVaultEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdVault
		);
}
    